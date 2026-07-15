package com.company.pms.supportticket;

import com.company.pms.auth.AppUser;
import com.company.pms.auth.AppUserRepository;
import com.company.pms.project.Project;
import com.company.pms.project.ProjectRepository;
import com.company.pms.resource.ResourceEntity;
import com.company.pms.resource.ResourceRepository;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping("/api/support-tickets")
public class SupportTicketController {

    private final SupportTicketRepository supportTicketRepository;
    private final SupportTicketCodeService supportTicketCodeService;
    private final ProjectRepository projectRepository;
    private final ResourceRepository resourceRepository;
    private final AppUserRepository appUserRepository;

    public SupportTicketController(SupportTicketRepository supportTicketRepository,
                                   SupportTicketCodeService supportTicketCodeService,
                                   ProjectRepository projectRepository,
                                   ResourceRepository resourceRepository,
                                   AppUserRepository appUserRepository) {
        this.supportTicketRepository = supportTicketRepository;
        this.supportTicketCodeService = supportTicketCodeService;
        this.projectRepository = projectRepository;
        this.resourceRepository = resourceRepository;
        this.appUserRepository = appUserRepository;
    }

    @GetMapping("/project/{projectId}")
    public List<SupportTicket> getTicketsByProject(@PathVariable Long projectId,
                                                   Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        Project supportProject = getSupportProject(projectId);

        validateCanViewSupportProject(currentUser, supportProject);

        return supportTicketRepository.findBySupportProjectIdOrderByReportedAtDesc(projectId);
    }

    @GetMapping("/{id}")
    public SupportTicket getTicket(@PathVariable Long id,
                                   Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Support ticket not found"));

        validateCanViewSupportProject(currentUser, ticket.getSupportProject());

        return ticket;
    }

    @PostMapping
    public SupportTicket createTicket(@RequestBody SupportTicketRequest request,
                                      Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        Project supportProject = getSupportProject(request.getSupportProjectId());

        validateCanCreateTicket(currentUser, supportProject);
        validateTicketRequiredFields(request);

        SupportTicket ticket = new SupportTicket();
        ticket.setTicketCode(supportTicketCodeService.generateTicketCode(LocalDate.now()));
        ticket.setSupportProject(supportProject);
        ticket.setClient(supportProject.getClient());
        ticket.setReportedByUser(currentUser);
        ticket.setReportedByName(resolveReportedByName(currentUser, request));
        ticket.setReportedAt(LocalDateTime.now());
        ticket.setStatus("NEW");

        mapRequestToTicket(request, ticket, false);

        return supportTicketRepository.save(ticket);
    }

    @PutMapping("/{id}")
    public SupportTicket updateTicket(@PathVariable Long id,
                                      @RequestBody SupportTicketRequest request,
                                      Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Support ticket not found"));

        validateCanManageTicket(currentUser, ticket.getSupportProject());
        validateTicketRequiredFields(request);

        mapRequestToTicket(request, ticket, true);
        applyStatusDates(ticket);

        return supportTicketRepository.save(ticket);
    }

    @DeleteMapping("/{id}")
    public void deleteTicket(@PathVariable Long id,
                             Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        SupportTicket ticket = supportTicketRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Support ticket not found"));

        validateCanManageTicket(currentUser, ticket.getSupportProject());

        supportTicketRepository.deleteById(id);
    }

    private void mapRequestToTicket(SupportTicketRequest request,
                                    SupportTicket ticket,
                                    boolean updateMode) {
        ticket.setTitle(request.getTitle().trim());
        ticket.setDescription(request.getDescription());
        ticket.setTicketType(normalize(request.getTicketType(), "INCIDENT"));
        ticket.setPriority(normalize(request.getPriority(), "P3"));
        ticket.setModuleName(request.getModuleName());
        ticket.setEnvironment(normalize(request.getEnvironment(), "PRODUCTION"));
        ticket.setBillable(request.getBillable() == null || request.getBillable());

        if (updateMode) {
            ticket.setStatus(normalize(request.getStatus(), ticket.getStatus() == null ? "NEW" : ticket.getStatus()));
            ticket.setFirstResponseAt(request.getFirstResponseAt());
            ticket.setResolvedAt(request.getResolvedAt());
            ticket.setClosedAt(request.getClosedAt());
            ticket.setRootCause(request.getRootCause());
            ticket.setResolutionNotes(request.getResolutionNotes());
        }

        if (request.getAssignedResourceId() != null) {
            ResourceEntity resource = resourceRepository.findById(request.getAssignedResourceId())
                    .orElseThrow(() -> new RuntimeException("Assigned resource not found"));
            ticket.setAssignedResource(resource);
        } else if (updateMode) {
            ticket.setAssignedResource(null);
        }
    }

    private void applyStatusDates(SupportTicket ticket) {
        String status = normalize(ticket.getStatus(), "NEW");
        LocalDateTime now = LocalDateTime.now();

        if (("ACKNOWLEDGED".equals(status) || "IN_PROGRESS".equals(status))
                && ticket.getFirstResponseAt() == null) {
            ticket.setFirstResponseAt(now);
        }

        if ("RESOLVED".equals(status) && ticket.getResolvedAt() == null) {
            ticket.setResolvedAt(now);
        }

        if ("CLOSED".equals(status) && ticket.getClosedAt() == null) {
            ticket.setClosedAt(now);
        }
    }

    private Project getSupportProject(Long projectId) {
        if (projectId == null) {
            throw new RuntimeException("Support project is required");
        }

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Support project not found"));

        if (!"SUPPORT".equalsIgnoreCase(project.getProjectType())) {
            throw new RuntimeException("Tickets can be created only for support projects");
        }

        return project;
    }

    private void validateTicketRequiredFields(SupportTicketRequest request) {
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new RuntimeException("Ticket title is required");
        }

        if (request.getDescription() == null || request.getDescription().isBlank()) {
            throw new RuntimeException("Ticket description is required");
        }
    }

    private void validateCanCreateTicket(AppUser currentUser, Project supportProject) {
        String role = currentUser.getRole();

        if ("CLIENT_VIEWER".equals(role)) {
            if (currentUser.getClient() != null
                    && supportProject.getClient() != null
                    && supportProject.getClient().getId().equals(currentUser.getClient().getId())) {
                return;
            }

            throw new RuntimeException("Client user can create tickets only for own support project");
        }

        validateCanManageTicket(currentUser, supportProject);
    }

    private void validateCanViewSupportProject(AppUser currentUser, Project supportProject) {
        String role = currentUser.getRole();

        if ("ADMIN".equals(role) || "EXECUTIVE_VIEWER".equals(role)) {
            return;
        }

        if ("CLIENT_VIEWER".equals(role)) {
            if (currentUser.getClient() != null
                    && supportProject.getClient() != null
                    && supportProject.getClient().getId().equals(currentUser.getClient().getId())) {
                return;
            }
        }

        if ("DELIVERY_HEAD".equals(role)
                && supportProject.getDeliveryHeadUser() != null
                && supportProject.getDeliveryHeadUser().getId().equals(currentUser.getId())) {
            return;
        }

        if ("DELIVERY_MANAGER".equals(role)
                && supportProject.getDeliveryManagerUser() != null
                && supportProject.getDeliveryManagerUser().getId().equals(currentUser.getId())) {
            return;
        }

        if ("TL".equals(role)
                && supportProject.getTlUser() != null
                && supportProject.getTlUser().getId().equals(currentUser.getId())) {
            return;
        }

        if ("TEAM_MEMBER".equals(role)) {
            List<SupportTicket> assignedTickets = supportTicketRepository
                    .findByAssignedResourceAppUserIdOrderByReportedAtDesc(currentUser.getId());
            boolean hasTicketInProject = assignedTickets.stream()
                    .anyMatch(ticket -> ticket.getSupportProject() != null
                            && ticket.getSupportProject().getId().equals(supportProject.getId()));
            if (hasTicketInProject) {
                return;
            }
        }

        throw new RuntimeException("You do not have access to this support project");
    }

    private void validateCanManageTicket(AppUser currentUser, Project supportProject) {
        String role = currentUser.getRole();

        if ("ADMIN".equals(role)) {
            return;
        }

        if ("DELIVERY_HEAD".equals(role)
                && supportProject.getDeliveryHeadUser() != null
                && supportProject.getDeliveryHeadUser().getId().equals(currentUser.getId())) {
            return;
        }

        if ("DELIVERY_MANAGER".equals(role)
                && supportProject.getDeliveryManagerUser() != null
                && supportProject.getDeliveryManagerUser().getId().equals(currentUser.getId())) {
            return;
        }

        if ("TL".equals(role)
                && supportProject.getTlUser() != null
                && supportProject.getTlUser().getId().equals(currentUser.getId())) {
            return;
        }

        throw new RuntimeException("Only internal delivery users can manage support tickets");
    }

    private String resolveReportedByName(AppUser currentUser, SupportTicketRequest request) {
        if (request.getReportedByName() != null && !request.getReportedByName().isBlank()) {
            return request.getReportedByName().trim();
        }

        return currentUser.getName();
    }

    private AppUser getCurrentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("User is not logged in");
        }

        return appUserRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Logged-in user not found"));
    }

    private String normalize(String value, String defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }

        return value.trim().toUpperCase().replace(" ", "_").replace("-", "_");
    }
}
