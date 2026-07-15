package com.company.pms.project;

import com.company.pms.auth.AppUser;
import com.company.pms.auth.AppUserRepository;
import com.company.pms.client.Client;
import com.company.pms.client.ClientRepository;
import com.company.pms.milestone.MilestoneService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {

    private final ProjectRepository projectRepository;
    private final ProjectCodeService projectCodeService;
    private final ClientRepository clientRepository;
    private final AppUserRepository appUserRepository;
    private final MilestoneService milestoneService;

    public ProjectController(ProjectRepository projectRepository,
                             ClientRepository clientRepository,
                             AppUserRepository appUserRepository,
                             MilestoneService milestoneService,
                             ProjectCodeService projectCodeService) {
        this.projectRepository = projectRepository;
        this.clientRepository = clientRepository;
        this.appUserRepository = appUserRepository;
        this.milestoneService = milestoneService;
        this.projectCodeService = projectCodeService;
    }

    @GetMapping
    public List<Project> getAllProjects() {
        return projectRepository.findAll();
    }

    @GetMapping("/my-projects")
    public List<Project> getMyProjects(Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        return switch (currentUser.getRole()) {
            case "ADMIN", "EXECUTIVE_VIEWER" -> projectRepository.findAll();

            case "DELIVERY_HEAD" -> getDeliveryHeadProjects(currentUser);

            case "DELIVERY_MANAGER" -> projectRepository.findByDeliveryManagerUserId(currentUser.getId());

            case "TL" -> projectRepository.findByTlUserId(currentUser.getId());

            case "CLIENT_VIEWER" -> getClientProjects(currentUser);

            case "TEAM_MEMBER" -> List.of();

            default -> List.of();
        };
    }

    @GetMapping("/{id}")
    public Project getProjectById(@PathVariable Long id,
                                  Authentication authentication) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        if (authentication != null) {
            AppUser currentUser = getCurrentUser(authentication);
            if (!canViewProject(currentUser, project)) {
                throw new RuntimeException("You do not have access to this project");
            }
        }

        return project;
    }

    @PostMapping
    public Project createProject(@RequestBody ProjectRequest request) {
        Project project = new Project();
        mapRequestToProject(request, project);

        if (project.getProjectCode() == null || project.getProjectCode().isBlank()) {
            project.setProjectCode(projectCodeService.generateProjectCode(project.getStartDate()));
        }

        Project savedProject = projectRepository.save(project);

        if (isImplementationProject(savedProject)) {
            milestoneService.ensureProjectMilestoneStatus(savedProject);
        }

        return savedProject;
    }

    @PutMapping("/{id}")
    public Project updateProject(@PathVariable Long id,
                                 @RequestBody ProjectRequest request) {
        Project project = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        mapRequestToProject(request, project);

        Project savedProject = projectRepository.save(project);

        if (isImplementationProject(savedProject)) {
            milestoneService.ensureProjectMilestoneStatus(savedProject);
        }

        return savedProject;
    }

    @PostMapping("/{id}/move-to-support")
    public Project moveToSupport(@PathVariable Long id,
                                 @RequestBody ProjectRequest request,
                                 Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        Project implementationProject = projectRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Implementation project not found"));

        if (!isImplementationProject(implementationProject)) {
            throw new RuntimeException("Only implementation projects can be moved to support");
        }

        validateCanMoveProjectToSupport(currentUser, implementationProject);
        validateImplementationReadyForSupport(implementationProject);

        if (projectRepository.existsByLinkedImplementationProjectIdAndProjectType(
                implementationProject.getId(),
                "SUPPORT")) {
            throw new RuntimeException("Support project already exists for this implementation project");
        }

        LocalDate supportStartDate = request.getSupportStartDate() != null
                ? request.getSupportStartDate()
                : LocalDate.now();

        Project supportProject = new Project();
        supportProject.setProjectName(implementationProject.getProjectName() + " - Support");
        supportProject.setProjectType("SUPPORT");
        supportProject.setLinkedImplementationProject(implementationProject);

        supportProject.setClient(implementationProject.getClient());
        supportProject.setCountry(implementationProject.getCountry());
        supportProject.setDeliveryHeadUser(implementationProject.getDeliveryHeadUser());
        supportProject.setDeliveryManagerUser(implementationProject.getDeliveryManagerUser());
        supportProject.setTlUser(implementationProject.getTlUser());
        supportProject.setDeliveryManagerName(implementationProject.getDeliveryManagerName());
        supportProject.setTlName(implementationProject.getTlName());

        supportProject.setStartDate(supportStartDate);
        supportProject.setEndDate(request.getSupportEndDate());
        supportProject.setStatus("ACTIVE");

        supportProject.setSupportStartDate(supportStartDate);
        supportProject.setSupportEndDate(request.getSupportEndDate());
        supportProject.setSupportContractType(normalizeSupportValue(request.getSupportContractType(), "WARRANTY"));
        supportProject.setSupportCoverage(normalizeSupportValue(request.getSupportCoverage(), "8X5"));
        supportProject.setBillingModel(normalizeSupportValue(request.getBillingModel(), "INCLUDED_WARRANTY"));
        supportProject.setSupportStatus("ACTIVE");

        supportProject.setProjectCode(projectCodeService.generateProjectCode(supportProject.getStartDate()));

        Project savedSupportProject = projectRepository.save(supportProject);

        implementationProject.setStatus("MOVED_TO_SUPPORT");
        projectRepository.save(implementationProject);

        return savedSupportProject;
    }

    @DeleteMapping("/{id}")
    public void deleteProject(@PathVariable Long id) {
        projectRepository.deleteById(id);
    }

    private AppUser getCurrentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("User is not logged in");
        }

        return appUserRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Logged-in user not found"));
    }

    private void mapRequestToProject(ProjectRequest request, Project project) {
        Client client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new RuntimeException("Client not found"));

        String projectType = normalizeSupportValue(request.getProjectType(), "IMPLEMENTATION");

        project.setProjectName(request.getProjectName());
        project.setProjectType(projectType);
        project.setClient(client);
        project.setCountry(request.getCountry());
        project.setStartDate(request.getStartDate());
        project.setEndDate(request.getEndDate());
        project.setStatus(request.getStatus() == null || request.getStatus().isBlank()
                ? defaultStatusForProjectType(projectType)
                : normalizeSupportValue(request.getStatus(), defaultStatusForProjectType(projectType)));

        mapLinkedImplementationProject(request, project, projectType);
        mapSupportFields(request, project, projectType);

        AppUser deliveryManagerUser = mapDeliveryManager(request, project);
        mapTeamLead(request, project);
        mapDeliveryHead(request, project, deliveryManagerUser);
    }

    private void mapLinkedImplementationProject(ProjectRequest request, Project project, String projectType) {
        if (request.getLinkedImplementationProjectId() != null) {
            Project linkedProject = projectRepository.findById(request.getLinkedImplementationProjectId())
                    .orElseThrow(() -> new RuntimeException("Linked implementation project not found"));

            if (!isImplementationProject(linkedProject)) {
                throw new RuntimeException("Linked project must be an implementation project");
            }

            project.setLinkedImplementationProject(linkedProject);
            return;
        }

        if (!"SUPPORT".equals(projectType)) {
            project.setLinkedImplementationProject(null);
        }
    }

    private void mapSupportFields(ProjectRequest request, Project project, String projectType) {
        if (!"SUPPORT".equals(projectType)) {
            project.setSupportStartDate(null);
            project.setSupportEndDate(null);
            project.setSupportContractType(null);
            project.setSupportCoverage(null);
            project.setBillingModel(null);
            project.setSupportStatus(null);
            return;
        }

        project.setSupportStartDate(request.getSupportStartDate());
        project.setSupportEndDate(request.getSupportEndDate());
        project.setSupportContractType(normalizeSupportValue(request.getSupportContractType(), "WARRANTY"));
        project.setSupportCoverage(normalizeSupportValue(request.getSupportCoverage(), "8X5"));
        project.setBillingModel(normalizeSupportValue(request.getBillingModel(), "INCLUDED_WARRANTY"));
        project.setSupportStatus(normalizeSupportValue(request.getSupportStatus(), "ACTIVE"));
    }

    private AppUser mapDeliveryManager(ProjectRequest request, Project project) {
        if (request.getDeliveryManagerUserId() == null) {
            project.setDeliveryManagerUser(null);
            project.setDeliveryManagerName(request.getDeliveryManagerName());
            return null;
        }

        AppUser deliveryManagerUser = appUserRepository.findById(request.getDeliveryManagerUserId())
                .orElseThrow(() -> new RuntimeException("Delivery Manager user not found"));

        if (!"DELIVERY_MANAGER".equals(deliveryManagerUser.getRole())) {
            throw new RuntimeException("Selected user is not a Delivery Manager");
        }

        project.setDeliveryManagerUser(deliveryManagerUser);
        project.setDeliveryManagerName(deliveryManagerUser.getName());

        if (project.getCountry() == null || project.getCountry().isBlank()) {
            project.setCountry(deliveryManagerUser.getCountry());
        }

        return deliveryManagerUser;
    }

    private void mapTeamLead(ProjectRequest request, Project project) {
        if (request.getTlUserId() == null) {
            project.setTlUser(null);
            project.setTlName(request.getTlName());
            return;
        }

        AppUser tlUser = appUserRepository.findById(request.getTlUserId())
                .orElseThrow(() -> new RuntimeException("TL user not found"));

        if (!"TL".equals(tlUser.getRole())) {
            throw new RuntimeException("Selected user is not a TL");
        }

        project.setTlUser(tlUser);
        project.setTlName(tlUser.getName());
    }

    private void mapDeliveryHead(ProjectRequest request,
                                 Project project,
                                 AppUser deliveryManagerUser) {
        if (request.getDeliveryHeadUserId() != null) {
            AppUser deliveryHeadUser = appUserRepository.findById(request.getDeliveryHeadUserId())
                    .orElseThrow(() -> new RuntimeException("Delivery Head user not found"));

            if (!"DELIVERY_HEAD".equals(deliveryHeadUser.getRole())) {
                throw new RuntimeException("Selected user is not a Delivery Head");
            }

            project.setDeliveryHeadUser(deliveryHeadUser);

            if (project.getCountry() == null || project.getCountry().isBlank()) {
                project.setCountry(deliveryHeadUser.getCountry());
            }

            return;
        }

        if (deliveryManagerUser != null
                && deliveryManagerUser.getManagerUser() != null
                && "DELIVERY_HEAD".equals(deliveryManagerUser.getManagerUser().getRole())) {

            project.setDeliveryHeadUser(deliveryManagerUser.getManagerUser());

            if (project.getCountry() == null || project.getCountry().isBlank()) {
                project.setCountry(deliveryManagerUser.getManagerUser().getCountry());
            }

            return;
        }

        project.setDeliveryHeadUser(null);
    }

    private List<Project> getDeliveryHeadProjects(AppUser currentUser) {
        List<Project> mappedProjects = projectRepository.findByDeliveryHeadUserId(currentUser.getId());

        if (!mappedProjects.isEmpty()) {
            return mappedProjects;
        }

        if (currentUser.getCountry() != null && !currentUser.getCountry().isBlank()) {
            return projectRepository.findByCountry(currentUser.getCountry());
        }

        return List.of();
    }

    private List<Project> getClientProjects(AppUser currentUser) {
        if (currentUser.getClient() == null) {
            return List.of();
        }

        return projectRepository.findByClientIdOrderByIdDesc(currentUser.getClient().getId());
    }

    private boolean canViewProject(AppUser currentUser, Project project) {
        String role = currentUser.getRole();

        if ("ADMIN".equals(role) || "EXECUTIVE_VIEWER".equals(role)) {
            return true;
        }

        if ("CLIENT_VIEWER".equals(role)) {
            return currentUser.getClient() != null
                    && project.getClient() != null
                    && project.getClient().getId().equals(currentUser.getClient().getId());
        }

        if ("DELIVERY_HEAD".equals(role)) {
            return project.getDeliveryHeadUser() != null
                    && project.getDeliveryHeadUser().getId().equals(currentUser.getId());
        }

        if ("DELIVERY_MANAGER".equals(role)) {
            return project.getDeliveryManagerUser() != null
                    && project.getDeliveryManagerUser().getId().equals(currentUser.getId());
        }

        if ("TL".equals(role)) {
            return project.getTlUser() != null
                    && project.getTlUser().getId().equals(currentUser.getId());
        }

        return false;
    }

    private void validateCanMoveProjectToSupport(AppUser currentUser, Project project) {
        String role = currentUser.getRole();

        if ("ADMIN".equals(role)) {
            return;
        }

        if ("DELIVERY_HEAD".equals(role)
                && project.getDeliveryHeadUser() != null
                && project.getDeliveryHeadUser().getId().equals(currentUser.getId())) {
            return;
        }

        if ("DELIVERY_MANAGER".equals(role)
                && project.getDeliveryManagerUser() != null
                && project.getDeliveryManagerUser().getId().equals(currentUser.getId())) {
            return;
        }

        throw new RuntimeException("Only Admin, assigned Delivery Head, or assigned Delivery Manager can move project to support");
    }

    private void validateImplementationReadyForSupport(Project project) {
        String status = normalizeSupportValue(project.getStatus(), "");

        List<String> allowedStatuses = List.of(
                "GO_LIVE",
                "POST_LIVE",
                "COMPLETED",
                "CLOSED"
        );

        if (!allowedStatuses.contains(status)) {
            throw new RuntimeException("Project can move to support only after Go-Live, Post Live, Completed, or Closed status");
        }
    }

    private boolean isImplementationProject(Project project) {
        return project == null
                || project.getProjectType() == null
                || project.getProjectType().isBlank()
                || "IMPLEMENTATION".equalsIgnoreCase(project.getProjectType());
    }

    private String defaultStatusForProjectType(String projectType) {
        return "SUPPORT".equals(projectType) ? "ACTIVE" : "NOT_STARTED";
    }

    private String normalizeSupportValue(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }

        return value.trim().toUpperCase().replace(" ", "_").replace("-", "_");
    }
}
