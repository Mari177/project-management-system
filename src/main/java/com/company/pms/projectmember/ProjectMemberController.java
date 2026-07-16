package com.company.pms.projectmember;

import com.company.pms.auth.AppUser;
import com.company.pms.auth.AppUserRepository;
import com.company.pms.common.PageResponse;
import com.company.pms.common.PaginationSupport;
import com.company.pms.project.Project;
import com.company.pms.project.ProjectRepository;
import com.company.pms.resource.ResourceEntity;
import com.company.pms.resource.ResourceRepository;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/project-members")
public class ProjectMemberController {

    private static final Map<String, String> PROJECT_MEMBER_SORTS = Map.of(
            "resourceName", "resource.resourceName",
            "projectRole", "projectRole",
            "allocationPercentage", "allocationPercentage",
            "startDate", "startDate",
            "id", "id"
    );

    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectRepository projectRepository;
    private final ResourceRepository resourceRepository;
    private final AppUserRepository appUserRepository;

    public ProjectMemberController(ProjectMemberRepository projectMemberRepository,
                                   ProjectRepository projectRepository,
                                   ResourceRepository resourceRepository,
                                   AppUserRepository appUserRepository) {
        this.projectMemberRepository = projectMemberRepository;
        this.projectRepository = projectRepository;
        this.resourceRepository = resourceRepository;
        this.appUserRepository = appUserRepository;
    }

    /*
     * View all members of a project.
     */
    @GetMapping("/project/{projectId}")
    public List<ProjectMember> getProjectMembers(@PathVariable Long projectId,
                                                 Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        Project project = getProject(projectId);

        if (!canViewProjectMembers(currentUser, project)) {
            throw new RuntimeException("You do not have permission to view project members");
        }

        return projectMemberRepository.findByProjectIdOrderByIdAsc(projectId);
    }

    @GetMapping("/project/{projectId}/paged")
    public PageResponse<ProjectMember> getProjectMembersPaged(
            @PathVariable Long projectId,
            Authentication authentication,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "15") Integer size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) Boolean billable,
            @RequestParam(defaultValue = "id") String sort,
            @RequestParam(defaultValue = "asc") String direction) {

        AppUser currentUser = getCurrentUser(authentication);
        Project project = getProject(projectId);

        if (!canViewProjectMembers(currentUser, project)) {
            throw new RuntimeException("You do not have permission to view project members");
        }

        Pageable pageable = PaginationSupport.pageable(
                page, size, 15, 50, sort, direction, PROJECT_MEMBER_SORTS, "id"
        );

        Specification<ProjectMember> specification = buildPagedSpecification(
                projectId, search, active, billable
        );

        Page<ProjectMember> result = projectMemberRepository.findAll(specification, pageable);
        return PageResponse.from(result);
    }

    /*
     * View only active members of a project.
     * This will be useful in Task 5 for task assignee dropdown.
     */
    @GetMapping("/project/{projectId}/active")
    public List<ProjectMember> getActiveProjectMembers(@PathVariable Long projectId,
                                                       Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        Project project = getProject(projectId);

        if (!canViewProjectMembers(currentUser, project)) {
            throw new RuntimeException("You do not have permission to view project members");
        }

        return projectMemberRepository.findByProjectIdAndActiveTrueOrderByIdAsc(projectId);
    }

    @GetMapping("/{id}")
    public ProjectMember getProjectMemberById(@PathVariable Long id,
                                              Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        ProjectMember member = projectMemberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project member not found"));

        if (!canViewProjectMembers(currentUser, member.getProject())) {
            throw new RuntimeException("You do not have permission to view this project member");
        }

        return member;
    }

    /*
     * Admin / Delivery Head / Delivery Manager can allocate people to projects.
     */
    @PostMapping
    public ProjectMember createProjectMember(@RequestBody ProjectMemberRequest request,
                                             Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        ProjectMember member = new ProjectMember();
        mapRequestToProjectMember(request, member, currentUser);

        return projectMemberRepository.save(member);
    }

    @PutMapping("/{id}")
    public ProjectMember updateProjectMember(@PathVariable Long id,
                                             @RequestBody ProjectMemberRequest request,
                                             Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        ProjectMember member = projectMemberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project member not found"));

        if (!canManageProjectMembers(currentUser, member.getProject())) {
            throw new RuntimeException("You do not have permission to update this project member");
        }

        mapRequestToProjectMember(request, member, currentUser);

        return projectMemberRepository.save(member);
    }

    @DeleteMapping("/{id}")
    public void deleteProjectMember(@PathVariable Long id,
                                    Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        ProjectMember member = projectMemberRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project member not found"));

        if (!canManageProjectMembers(currentUser, member.getProject())) {
            throw new RuntimeException("You do not have permission to delete this project member");
        }

        projectMemberRepository.delete(member);
    }

    private void mapRequestToProjectMember(ProjectMemberRequest request,
                                           ProjectMember member,
                                           AppUser currentUser) {
        if (request.getProjectId() == null) {
            throw new RuntimeException("Project is required");
        }

        if (request.getResourceId() == null) {
            throw new RuntimeException("Resource is required");
        }

        Project project = getProject(request.getProjectId());

        if (!canManageProjectMembers(currentUser, project)) {
            throw new RuntimeException("You do not have permission to manage members for this project");
        }

        ResourceEntity resource = resourceRepository.findById(request.getResourceId())
                .orElseThrow(() -> new RuntimeException("Resource not found"));

        if (resource.getStatus() == null || !"ACTIVE".equalsIgnoreCase(resource.getStatus())) {
            throw new RuntimeException("Only active resources can be allocated to a project");
        }

        validateDuplicate(project.getId(), resource.getId(), member.getId());
        validateProjectRole(request.getProjectRole());
        validateAllocationPercentage(request.getAllocationPercentage());
        validateDates(project, request.getStartDate(), request.getEndDate());

        member.setProject(project);
        member.setResource(resource);
        member.setProjectRole(normalizeProjectRole(request.getProjectRole()));
        member.setAllocationPercentage(request.getAllocationPercentage() == null
                ? 100.0
                : request.getAllocationPercentage());
        member.setBillable(request.getBillable() == null
                ? true
                : request.getBillable());
        member.setStartDate(request.getStartDate());
        member.setEndDate(request.getEndDate());
        member.setActive(request.getActive() == null
                ? true
                : request.getActive());
    }

    private void validateDuplicate(Long projectId, Long resourceId, Long currentMemberId) {
        if (currentMemberId == null) {
            projectMemberRepository.findByProjectIdAndResourceId(projectId, resourceId)
                    .ifPresent(existing -> {
                        throw new RuntimeException("This resource is already allocated to this project");
                    });

            return;
        }

        projectMemberRepository.findByProjectIdAndResourceIdAndIdNot(projectId, resourceId, currentMemberId)
                .ifPresent(existing -> {
                    throw new RuntimeException("This resource is already allocated to this project");
                });
    }

    private void validateProjectRole(String projectRole) {
        if (projectRole == null || projectRole.isBlank()) {
            throw new RuntimeException("Project role is required");
        }
    }

    private String normalizeProjectRole(String projectRole) {
        return projectRole.trim().toUpperCase().replace(" ", "_").replace("-", "_");
    }

    private void validateAllocationPercentage(Double allocationPercentage) {
        if (allocationPercentage == null) {
            return;
        }

        if (allocationPercentage <= 0 || allocationPercentage > 100) {
            throw new RuntimeException("Allocation percentage must be between 1 and 100");
        }
    }

    private void validateDates(Project project, LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            throw new RuntimeException("Member end date cannot be before start date");
        }

        if (project.getStartDate() != null
                && startDate != null
                && startDate.isBefore(project.getStartDate())) {
            throw new RuntimeException("Member start date cannot be before project start date");
        }

        if (project.getEndDate() != null
                && endDate != null
                && endDate.isAfter(project.getEndDate())) {
            throw new RuntimeException("Member end date cannot be after project end date");
        }
    }

    private Project getProject(Long projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
    }

    private Specification<ProjectMember> buildPagedSpecification(
            Long projectId,
            String search,
            Boolean active,
            Boolean billable) {

        String normalizedSearch = PaginationSupport.normalized(search);

        return (root, query, criteriaBuilder) -> {
            query.distinct(true);
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(criteriaBuilder.equal(root.get("project").get("id"), projectId));

            if (normalizedSearch != null) {
                String contains = "%" + normalizedSearch + "%";
                var resource = root.join("resource", JoinType.LEFT);
                var appUser = resource.join("appUser", JoinType.LEFT);
                var manager = appUser.join("managerUser", JoinType.LEFT);

                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(resource.get("resourceName")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(resource.get("designation")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("projectRole")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(manager.get("name")), contains)
                ));
            }

            if (active != null) {
                predicates.add(criteriaBuilder.equal(root.get("active"), active));
            }

            if (billable != null) {
                predicates.add(criteriaBuilder.equal(root.get("billable"), billable));
            }

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private AppUser getCurrentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("User is not logged in");
        }

        return appUserRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Logged-in user not found"));
    }

    private boolean canViewProjectMembers(AppUser currentUser, Project project) {
        String role = currentUser.getRole();

        if ("ADMIN".equals(role) || "EXECUTIVE_VIEWER".equals(role)) {
            return true;
        }

        if ("DELIVERY_HEAD".equals(role)) {
            if (project.getDeliveryHeadUser() != null
                    && project.getDeliveryHeadUser().getId().equals(currentUser.getId())) {
                return true;
            }

            return currentUser.getCountry() != null
                    && project.getCountry() != null
                    && currentUser.getCountry().equals(project.getCountry());
        }

        if ("DELIVERY_MANAGER".equals(role)) {
            return project.getDeliveryManagerUser() != null
                    && project.getDeliveryManagerUser().getId().equals(currentUser.getId());
        }

        if ("TL".equals(role)) {
            return project.getTlUser() != null
                    && project.getTlUser().getId().equals(currentUser.getId());
        }

        if ("TEAM_MEMBER".equals(role)) {
            return resourceRepository.findByAppUserId(currentUser.getId())
                    .map(resource -> projectMemberRepository.existsByProjectIdAndResourceId(
                            project.getId(),
                            resource.getId()
                    ))
                    .orElse(false);
        }

        return false;
    }

    private boolean canManageProjectMembers(AppUser currentUser, Project project) {
        String role = currentUser.getRole();

        if ("ADMIN".equals(role)) {
            return true;
        }

        if ("DELIVERY_HEAD".equals(role)) {
            return project.getDeliveryHeadUser() != null
                    && project.getDeliveryHeadUser().getId().equals(currentUser.getId());
        }

        if ("DELIVERY_MANAGER".equals(role)) {
            return project.getDeliveryManagerUser() != null
                    && project.getDeliveryManagerUser().getId().equals(currentUser.getId());
        }

        return false;
    }
}