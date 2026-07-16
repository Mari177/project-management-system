package com.company.pms.dashboard;

import com.company.pms.auth.AppUser;
import com.company.pms.auth.AppUserRepository;
import com.company.pms.client.ClientRepository;
import com.company.pms.milestone.Milestone;
import com.company.pms.milestone.MilestoneRepository;
import com.company.pms.milestone.MilestoneService;
import com.company.pms.project.Project;
import com.company.pms.project.ProjectRepository;
import com.company.pms.projectmember.ProjectMember;
import com.company.pms.projectmember.ProjectMemberRepository;
import com.company.pms.resource.ResourceRepository;
import com.company.pms.task.TaskEntity;
import com.company.pms.task.TaskRepository;
import com.company.pms.timesheet.TimeLogRepository;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
public class DashboardController {

    private static final double WORKING_DAYS_PER_MONTH = 22.0;
    private static final double HOURS_PER_DAY = 8.0;
    private static final double INR_PER_USD = 83.0;

    private final ClientRepository clientRepository;
    private final ProjectRepository projectRepository;
    private final MilestoneRepository milestoneRepository;
    private final TaskRepository taskRepository;
    private final ResourceRepository resourceRepository;
    private final AppUserRepository appUserRepository;
    private final MilestoneService milestoneService;
    private final TimeLogRepository timeLogRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public DashboardController(ClientRepository clientRepository,
            ProjectRepository projectRepository,
            MilestoneRepository milestoneRepository,
            TaskRepository taskRepository,
            ResourceRepository resourceRepository,
            AppUserRepository appUserRepository,
            MilestoneService milestoneService,
            TimeLogRepository timeLogRepository,
            ProjectMemberRepository projectMemberRepository) {
        this.clientRepository = clientRepository;
        this.projectRepository = projectRepository;
        this.milestoneRepository = milestoneRepository;
        this.taskRepository = taskRepository;
        this.resourceRepository = resourceRepository;
        this.appUserRepository = appUserRepository;
        this.milestoneService = milestoneService;
        this.timeLogRepository = timeLogRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    @GetMapping("/api/dashboard")
    public DashboardResponse getDashboard(Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        List<Project> projects = getProjectsForUser(currentUser);
        List<TaskEntity> tasks = getTasksForUser(currentUser);

        List<Milestone> milestones = getMilestonesForUser(currentUser, projects, tasks);
        List<ProjectMember> activeProjectMembers = getActiveProjectMembers(projects);

        DashboardResponse response = new DashboardResponse();

        response.setTotalClients(getTotalClients(currentUser, projects));
        response.setTotalProjects(projects.size());
        response.setActiveProjects(countProjectsByStatuses(
                projects, "IN_PROGRESS", "GO_LIVE", "POST_LIVE", "ACTIVE"));
        response.setCompletedProjects(countProjectsByStatuses(
                projects, "COMPLETED", "MOVED_TO_SUPPORT", "CLOSED"));
        response.setDelayedProjects(countProjectsByStatus(projects, "DELAYED"));

        response.setTotalMilestones(milestones.size());
        response.setCompletedMilestones(countMilestonesByStatus(milestones, "COMPLETED"));

        response.setTotalTasks(tasks.size());
        response.setCompletedTasks(countTasksByStatus(tasks, "COMPLETED"));
        response.setDelayedTasks(countTasksByStatus(tasks, "DELAYED"));

        response.setEscalatedTasks(countEscalatedTasks(tasks));
        response.setOpenEscalations(countOpenEscalations(tasks));
        response.setCriticalEscalations(countCriticalEscalations(tasks));

        response.setTotalResources(getTotalResources(
                currentUser,
                activeProjectMembers,
                tasks
        ));
        response.setTotalAllocations(activeProjectMembers.size());
        response.setTotalCost(canViewProjectCost(currentUser) ? calculateTotalCost(tasks) : null);

        response.setProjectSummaries(buildProjectSummaries(currentUser, projects, tasks));
        response.setEscalatedTaskDetails(buildEscalatedTaskDetails(tasks));

        return response;
    }

    @GetMapping("/api/dashboard/project-report/{projectId}")
    public ProjectReportResponse getProjectTaskReport(@PathVariable Long projectId,
            Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        if (!canAccessProjectReport(currentUser, project)) {
            throw new RuntimeException("You do not have access to this project report");
        }

        boolean canViewCost = canViewProjectCost(currentUser);

        List<TaskEntity> projectTasks = getProjectReportTasks(currentUser, projectId);

        List<Milestone> projectMilestones = milestoneRepository
                .findByProjectIdOrderByMilestoneMasterMilestoneOrderAsc(projectId);

        List<MilestoneReportDto> milestoneReports = projectMilestones.stream()
                .map(milestone -> mapToMilestoneReportDto(milestone, projectTasks, canViewCost))
                .collect(Collectors.toList());

        String clientName = project.getClient() != null
                ? project.getClient().getClientName()
                : "N/A";

        String clientContactPerson = project.getClient() != null
                ? project.getClient().getContactPerson()
                : "N/A";

        Double projectCost = null;

        if (canViewCost) {
            projectCost = taskRepository.findByProjectId(projectId).stream()
                    .mapToDouble(this::calculateTaskCost)
                    .sum();
            projectCost = roundToTwoDecimals(projectCost);
        }

        Double overallProgress = milestoneService.calculateProjectMilestoneProgress(projectMilestones);

        long completedTasks = countTasksByStatus(projectTasks, "COMPLETED");

        long delayedTasks = projectTasks.stream()
                .filter(task -> "DELAYED".equals(task.getStatus()) || "BLOCKED".equals(task.getStatus()))
                .count();

        long escalatedTasks = projectTasks.stream()
                .filter(task -> Boolean.TRUE.equals(task.getEscalated()))
                .count();

        return new ProjectReportResponse(
                project.getId(),
                project.getProjectCode(),
                project.getProjectName(),
                clientName,
                clientContactPerson,
                project.getDeliveryManagerName(),
                project.getStatus(),
                projectCost,
                canViewCost,
                overallProgress,
                (long) projectTasks.size(),
                completedTasks,
                delayedTasks,
                escalatedTasks,
                milestoneReports);
    }

    private AppUser getCurrentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("User is not logged in");
        }

        return appUserRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Logged-in user not found"));
    }

    private List<Project> getProjectsForUser(AppUser currentUser) {
        return switch (currentUser.getRole()) {
            case "ADMIN", "EXECUTIVE_VIEWER" -> projectRepository.findAll();
            case "DELIVERY_HEAD" -> getDeliveryHeadProjects(currentUser);
            case "DELIVERY_MANAGER" -> projectRepository.findByDeliveryManagerUserId(currentUser.getId());
            case "TL" -> projectRepository.findByTlUserId(currentUser.getId());
            case "CLIENT_VIEWER" -> getClientProjects(currentUser);
            case "TEAM_MEMBER" -> getTEAM_MEMBERProjects(currentUser);
            default -> List.of();
        };
    }

    private List<Project> getClientProjects(AppUser currentUser) {
        if (currentUser.getClient() == null) {
            return List.of();
        }

        return projectRepository.findByClientIdOrderByIdDesc(currentUser.getClient().getId());
    }

    private List<TaskEntity> getTasksForUser(AppUser currentUser) {
        return switch (currentUser.getRole()) {
            case "ADMIN", "EXECUTIVE_VIEWER" -> taskRepository.findAll();
            case "DELIVERY_HEAD" -> getDeliveryHeadTasks(currentUser);
            case "DELIVERY_MANAGER" -> taskRepository.findByProjectDeliveryManagerUserId(currentUser.getId());
            case "TL" -> taskRepository.findByProjectTlUserId(currentUser.getId());
            case "TEAM_MEMBER" -> taskRepository.findByAssignedResourceAppUserId(currentUser.getId());
            default -> List.of();
        };
    }

    private List<Project> getTEAM_MEMBERProjects(AppUser currentUser) {
        Map<Long, Project> projectMap = new LinkedHashMap<>();
        List<TaskEntity> TEAM_MEMBERTasks = taskRepository.findByAssignedResourceAppUserId(currentUser.getId());

        for (TaskEntity task : TEAM_MEMBERTasks) {
            if (task.getProject() != null) {
                projectMap.put(task.getProject().getId(), task.getProject());
            }
        }

        return new ArrayList<>(projectMap.values());
    }

    private List<Milestone> getMilestonesForUser(AppUser currentUser,
            List<Project> projects,
            List<TaskEntity> tasks) {
        if ("ADMIN".equals(currentUser.getRole()) || "EXECUTIVE_VIEWER".equals(currentUser.getRole())) {
            return milestoneRepository.findAll();
        }

        if ("TEAM_MEMBER".equals(currentUser.getRole())) {
            Map<Long, Milestone> milestoneMap = new LinkedHashMap<>();

            for (TaskEntity task : tasks) {
                if (task.getMilestone() != null) {
                    milestoneMap.put(task.getMilestone().getId(), task.getMilestone());
                }
            }

            return new ArrayList<>(milestoneMap.values());
        }

        Map<Long, Milestone> milestoneMap = new LinkedHashMap<>();

        for (Project project : projects) {
            List<Milestone> projectMilestones = milestoneRepository.findByProjectId(project.getId());

            for (Milestone milestone : projectMilestones) {
                milestoneMap.put(milestone.getId(), milestone);
            }
        }

        return new ArrayList<>(milestoneMap.values());
    }

    private long getTotalClients(AppUser currentUser, List<Project> projects) {
        if ("ADMIN".equals(currentUser.getRole())) {
            return clientRepository.count();
        }

        return projects.stream()
                .map(Project::getClient)
                .filter(Objects::nonNull)
                .map(client -> client.getId())
                .distinct()
                .count();
    }

    private long getTotalResources(AppUser currentUser,
            List<ProjectMember> activeProjectMembers,
            List<TaskEntity> tasks) {
        if ("ADMIN".equals(currentUser.getRole()) || "EXECUTIVE_VIEWER".equals(currentUser.getRole())) {
            return resourceRepository.countByStatusIgnoreCase("ACTIVE");
        }

        if ("DELIVERY_HEAD".equals(currentUser.getRole())) {
            if (currentUser.getCountry() == null || currentUser.getCountry().isBlank()) {
                return 0;
            }

            return resourceRepository.findByCountryAndStatus(currentUser.getCountry(), "ACTIVE").size();
        }

        Set<Long> resourceIds = activeProjectMembers.stream()
                .map(ProjectMember::getResource)
                .filter(Objects::nonNull)
                .map(resource -> resource.getId())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());

        if (resourceIds.isEmpty()) {
            for (TaskEntity task : tasks) {
                if (task.getAssignedResource() != null) {
                    resourceIds.add(task.getAssignedResource().getId());
                }
            }
        }

        return resourceIds.size();
    }

    private List<ProjectMember> getActiveProjectMembers(List<Project> projects) {
        List<Long> projectIds = projects.stream()
                .filter(Objects::nonNull)
                .map(Project::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();

        if (projectIds.isEmpty()) {
            return List.of();
        }

        return projectMemberRepository.findByProjectIdInAndActiveTrue(projectIds);
    }

    private long countProjectsByStatus(List<Project> projects, String status) {
        return countProjectsByStatuses(projects, status);
    }

    private long countProjectsByStatuses(List<Project> projects, String... statuses) {
        Set<String> allowedStatuses = Arrays.stream(statuses)
                .filter(Objects::nonNull)
                .map(String::toUpperCase)
                .collect(Collectors.toSet());

        return projects.stream()
                .map(Project::getStatus)
                .filter(Objects::nonNull)
                .map(String::toUpperCase)
                .filter(allowedStatuses::contains)
                .count();
    }

    private long countMilestonesByStatus(List<Milestone> milestones, String status) {
        return milestones.stream()
                .filter(milestone -> status.equals(milestone.getStatus()))
                .count();
    }

    private long countTasksByStatus(List<TaskEntity> tasks, String status) {
        return tasks.stream()
                .filter(task -> status.equals(task.getStatus()))
                .count();
    }

    private long countEscalatedTasks(List<TaskEntity> tasks) {
        return tasks.stream()
                .filter(task -> Boolean.TRUE.equals(task.getEscalated()))
                .count();
    }

    private long countOpenEscalations(List<TaskEntity> tasks) {
        return tasks.stream()
                .filter(task -> Boolean.TRUE.equals(task.getEscalated()))
                .filter(task -> "OPEN".equals(task.getEscalationStatus()))
                .count();
    }

    private long countCriticalEscalations(List<TaskEntity> tasks) {
        return tasks.stream()
                .filter(task -> Boolean.TRUE.equals(task.getEscalated()))
                .filter(task -> "CRITICAL".equals(task.getEscalationSeverity()))
                .count();
    }

    private Double calculateTotalCost(List<TaskEntity> tasks) {
        double totalCost = tasks.stream()
                .mapToDouble(this::calculateTaskCost)
                .sum();

        return roundToTwoDecimals(totalCost);
    }

    private double calculateTaskCost(TaskEntity task) {
        /*
         * Actual task cost:
         * approved timesheet hours × resource hourly cost.
         */
        if (task == null
                || task.getId() == null
                || task.getAssignedResource() == null
                || task.getAssignedResource().getMonthlySalary() == null) {
            return 0.0;
        }

        Double approvedHours = timeLogRepository.sumApprovedHoursByTaskId(task.getId());

        if (approvedHours == null || approvedHours <= 0) {
            return 0.0;
        }

        double hourlyCostUsd = calculateHourlyCostUsd(task);

        return roundToTwoDecimals(hourlyCostUsd * approvedHours);
    }

    private double calculatePlannedTaskCost(TaskEntity task) {
        /*
         * Planned task cost:
         * allocated hours × resource hourly cost.
         */
        if (task == null
                || task.getAssignedResource() == null
                || task.getAssignedResource().getMonthlySalary() == null
                || task.getAllocatedHours() == null) {
            return 0.0;
        }

        double hourlyCostUsd = calculateHourlyCostUsd(task);

        return roundToTwoDecimals(hourlyCostUsd * task.getAllocatedHours());
    }

    private double calculateHourlyCostUsd(TaskEntity task) {
        if (task == null
                || task.getAssignedResource() == null
                || task.getAssignedResource().getMonthlySalary() == null) {
            return 0.0;
        }

        double monthlySalaryInr = task.getAssignedResource().getMonthlySalary();

        return monthlySalaryInr
                / WORKING_DAYS_PER_MONTH
                / HOURS_PER_DAY
                / INR_PER_USD;
    }

    private double getApprovedHours(TaskEntity task) {
        if (task == null || task.getId() == null) {
            return 0.0;
        }

        Double approvedHours = timeLogRepository.sumApprovedHoursByTaskId(task.getId());

        return approvedHours == null ? 0.0 : approvedHours;
    }

    private List<ProjectSummaryDto> buildProjectSummaries(AppUser currentUser,
            List<Project> projects,
            List<TaskEntity> tasks) {
        return projects.stream()
                .map(project -> mapToProjectSummary(currentUser, project, tasks))
                .sorted(Comparator
                        .comparingInt(this::projectAttentionRank)
                        .thenComparing(ProjectSummaryDto::getMilestoneProgressPercentage,
                                Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(ProjectSummaryDto::getProjectName,
                                Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .limit(10)
                .collect(Collectors.toList());
    }

    private List<EscalatedTaskDto> buildEscalatedTaskDetails(List<TaskEntity> tasks) {
        return tasks.stream()
                .filter(task -> Boolean.TRUE.equals(task.getEscalated()))
                .sorted(Comparator
                        .comparingInt(this::escalationAttentionRank)
                        .thenComparing(TaskEntity::getEscalationDate,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                .limit(10)
                .map(this::mapToEscalatedTaskDto)
                .collect(Collectors.toList());
    }

    private int projectAttentionRank(ProjectSummaryDto project) {
        if (project == null) {
            return 99;
        }

        String projectStatus = project.getStatus() == null
                ? ""
                : project.getStatus().toUpperCase();
        String milestoneStatus = project.getMilestoneStatus() == null
                ? ""
                : project.getMilestoneStatus().toUpperCase();

        if ("DELAYED".equals(projectStatus) || "DELAYED".equals(milestoneStatus)) {
            return 0;
        }
        if ("ON_HOLD".equals(projectStatus) || "ON_HOLD".equals(milestoneStatus)) {
            return 1;
        }
        if (List.of("IN_PROGRESS", "GO_LIVE", "POST_LIVE", "ACTIVE").contains(projectStatus)) {
            return 2;
        }
        return 3;
    }

    private int escalationAttentionRank(TaskEntity task) {
        if (task == null) {
            return 99;
        }

        String severity = task.getEscalationSeverity() == null
                ? ""
                : task.getEscalationSeverity().toUpperCase();
        String status = task.getEscalationStatus() == null
                ? ""
                : task.getEscalationStatus().toUpperCase();

        if ("CRITICAL".equals(severity) && "OPEN".equals(status)) {
            return 0;
        }
        if ("HIGH".equals(severity) && "OPEN".equals(status)) {
            return 1;
        }
        if ("OPEN".equals(status)) {
            return 2;
        }
        return 3;
    }

    private EscalatedTaskDto mapToEscalatedTaskDto(TaskEntity task) {
    String projectName = task.getProject() != null
            ? task.getProject().getProjectName()
            : "N/A";

    String resourceName = task.getAssignedResource() != null
            ? task.getAssignedResource().getResourceName()
            : "N/A";

    String reportingManagerName = task.getAssignedResource() != null
            ? task.getAssignedResource().getReportingManagerName()
            : null;

    String reportingManagerDesignation = task.getAssignedResource() != null
            ? task.getAssignedResource().getReportingManagerDesignation()
            : null;

    return new EscalatedTaskDto(
            task.getId(),
            task.getTaskName(),
            projectName,
            resourceName,
            reportingManagerName,
            reportingManagerDesignation,
            task.getEscalationReasonType(),
            task.getEscalationReason(),
            task.getEscalationSeverity(),
            task.getEscalationStatus(),
            task.getEscalationDate()
    );
}
    private ProjectSummaryDto mapToProjectSummary(AppUser currentUser,
            Project project,
            List<TaskEntity> tasks) {
        String clientName = project.getClient() != null
                ? project.getClient().getClientName()
                : "N/A";

        String clientContactPerson = project.getClient() != null
                ? project.getClient().getContactPerson()
                : "N/A";

        boolean canViewCost = canViewProjectCost(currentUser);
        Double projectCost = null;

        if (canViewCost) {
            projectCost = tasks.stream()
                    .filter(task -> task.getProject() != null)
                    .filter(task -> task.getProject().getId().equals(project.getId()))
                    .mapToDouble(this::calculateTaskCost)
                    .sum();

            projectCost = roundToTwoDecimals(projectCost);
        }

        List<Milestone> projectMilestones = milestoneRepository.findByProjectId(project.getId());

        String milestoneStatus = calculateProjectMilestoneStatus(projectMilestones);
        Double milestoneProgressPercentage = milestoneService.calculateProjectMilestoneProgress(projectMilestones);

        return new ProjectSummaryDto(
                project.getId(),
                project.getProjectCode(),
                project.getProjectName(),
                clientName,
                clientContactPerson,
                project.getDeliveryManagerName(),
                project.getStatus(),
                projectCost,
                milestoneStatus,
                milestoneProgressPercentage,
                canViewCost);
    }

    private String calculateProjectMilestoneStatus(List<Milestone> milestones) {
        if (milestones == null || milestones.isEmpty()) {
            return "NO_MILESTONES";
        }

        boolean hasDelayed = milestones.stream()
                .anyMatch(milestone -> "DELAYED".equals(milestone.getStatus()));

        if (hasDelayed) {
            return "DELAYED";
        }

        boolean allCompleted = milestones.stream()
                .allMatch(milestone -> "COMPLETED".equals(milestone.getStatus()));

        if (allCompleted) {
            return "COMPLETED";
        }

        boolean hasInProgress = milestones.stream()
                .anyMatch(milestone -> "IN_PROGRESS".equals(milestone.getStatus()));

        if (hasInProgress) {
            return "IN_PROGRESS";
        }

        boolean hasOnHold = milestones.stream()
                .anyMatch(milestone -> "ON_HOLD".equals(milestone.getStatus()));

        if (hasOnHold) {
            return "ON_HOLD";
        }

        return "NOT_STARTED";
    }

    private List<TaskEntity> getDeliveryHeadTasks(AppUser currentUser) {
        List<TaskEntity> mappedTasks = taskRepository.findByProjectDeliveryHeadUserId(currentUser.getId());

        if (!mappedTasks.isEmpty()) {
            return mappedTasks;
        }

        if (currentUser.getCountry() != null && !currentUser.getCountry().isBlank()) {
            return taskRepository.findByProjectCountry(currentUser.getCountry());
        }

        return List.of();
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

    private boolean canAccessProjectReport(AppUser user, Project project) {
        if (user == null || project == null) {
            return false;
        }

        if ("ADMIN".equals(user.getRole()) || "EXECUTIVE_VIEWER".equals(user.getRole())) {
            return true;
        }

        if ("CLIENT_VIEWER".equals(user.getRole())) {
            return user.getClient() != null
                    && project.getClient() != null
                    && project.getClient().getId().equals(user.getClient().getId());
        }

        if ("DELIVERY_HEAD".equals(user.getRole())) {
            boolean directlyMapped = project.getDeliveryHeadUser() != null
                    && project.getDeliveryHeadUser().getId().equals(user.getId());

            boolean sameCountry = user.getCountry() != null
                    && project.getCountry() != null
                    && user.getCountry().equals(project.getCountry());

            return directlyMapped || sameCountry;
        }

        if ("DELIVERY_MANAGER".equals(user.getRole())) {
            return project.getDeliveryManagerUser() != null
                    && project.getDeliveryManagerUser().getId().equals(user.getId());
        }

        if ("TL".equals(user.getRole())) {
            return project.getTlUser() != null
                    && project.getTlUser().getId().equals(user.getId());
        }

        if ("TEAM_MEMBER".equals(user.getRole())) {
            return isTEAM_MEMBERAssignedToProject(user, project.getId());
        }

        return false;
    }

    private boolean canViewProjectCost(AppUser user) {
        if (user == null || user.getRole() == null) {
            return false;
        }

        return "ADMIN".equals(user.getRole())
                || "EXECUTIVE_VIEWER".equals(user.getRole())
                || "DELIVERY_HEAD".equals(user.getRole())
                || "DELIVERY_MANAGER".equals(user.getRole());
    }

    private boolean isTEAM_MEMBERAssignedToProject(AppUser user, Long projectId) {
        if (user == null || projectId == null) {
            return false;
        }

        return taskRepository.findByProjectId(projectId).stream()
                .anyMatch(task -> task.getAssignedResource() != null
                        && task.getAssignedResource().getAppUser() != null
                        && task.getAssignedResource().getAppUser().getId().equals(user.getId()));
    }

    private List<TaskEntity> getProjectReportTasks(AppUser currentUser, Long projectId) {
        List<TaskEntity> allProjectTasks = taskRepository.findByProjectId(projectId);

        if (!"TEAM_MEMBER".equals(currentUser.getRole())) {
            return allProjectTasks;
        }

        return allProjectTasks.stream()
                .filter(task -> task.getAssignedResource() != null
                        && task.getAssignedResource().getAppUser() != null
                        && task.getAssignedResource().getAppUser().getId().equals(currentUser.getId()))
                .collect(Collectors.toList());
    }

    private MilestoneReportDto mapToMilestoneReportDto(Milestone milestone,
            List<TaskEntity> projectTasks,
            boolean canViewCost) {
        List<TaskEntity> milestoneTasks = projectTasks.stream()
                .filter(task -> task.getMilestone() != null)
                .filter(task -> task.getMilestone().getId().equals(milestone.getId()))
                .collect(Collectors.toList());

        List<ProjectTaskReportDto> taskReports = milestoneTasks.stream()
                .map(task -> mapToProjectTaskReportDto(task, canViewCost))
                .collect(Collectors.toList());

        long completedTasks = countTasksByStatus(milestoneTasks, "COMPLETED");

        long delayedTasks = milestoneTasks.stream()
                .filter(task -> "DELAYED".equals(task.getStatus()) || "BLOCKED".equals(task.getStatus()))
                .count();

        long escalatedTasks = milestoneTasks.stream()
                .filter(task -> Boolean.TRUE.equals(task.getEscalated()))
                .count();

        return new MilestoneReportDto(
                milestone.getId(),
                milestone.getMilestoneOrder(),
                milestone.getMilestoneName(),
                milestone.getStatus(),
                milestone.getProgressPercentage(),
                milestone.getStartDate(),
                milestone.getEndDate(),
                (long) milestoneTasks.size(),
                completedTasks,
                delayedTasks,
                escalatedTasks,
                taskReports);
    }
        
    private ProjectTaskReportDto mapToProjectTaskReportDto(
        TaskEntity task,
        boolean canViewCost) {

    String resourceName = task.getAssignedResource() != null
            ? task.getAssignedResource().getResourceName()
            : "N/A";

    String reportingManagerName = task.getAssignedResource() != null
            ? task.getAssignedResource().getReportingManagerName()
            : null;

    String reportingManagerDesignation = task.getAssignedResource() != null
            ? task.getAssignedResource().getReportingManagerDesignation()
            : null;

    String resourceLocation = task.getAssignedResource() != null
            ? task.getAssignedResource().getLocation()
            : "N/A";

    Integer taskProgress = task.getProgressPercentage() != null
            ? task.getProgressPercentage()
            : 0;

    Double allocatedHours = task.getAllocatedHours() != null
            ? task.getAllocatedHours()
            : 0.0;

    Double approvedHours = canViewCost
            ? getApprovedHours(task)
            : null;

    Double plannedCost = canViewCost
            ? calculatePlannedTaskCost(task)
            : null;

    Double actualCost = canViewCost
            ? calculateTaskCost(task)
            : null;

    Double costVariance = canViewCost
            ? roundToTwoDecimals(actualCost - plannedCost)
            : null;

    Double taskCost = actualCost;

    return new ProjectTaskReportDto(
            task.getId(),
            task.getTaskCode(),
            task.getTaskName(),
            task.getTaskDescription(),
            task.getTaskType(),
            task.getStatus(),
            taskProgress,
            task.getPriority(),
            task.getEscalated(),
            resourceName,
            reportingManagerName,
            reportingManagerDesignation,
            resourceLocation,
            task.getStartDate(),
            task.getEndDate(),
            taskCost,
            allocatedHours,
            approvedHours,
            plannedCost,
            actualCost,
            costVariance
    );
}

    private void recalculateMilestonesForProjects(List<Project> projects) {
        if (projects == null || projects.isEmpty()) {
            return;
        }

        for (Project project : projects) {
            if (project != null && project.getId() != null) {
                milestoneService.recalculateProjectMilestones(project.getId());
            }
        }
    }

    private double roundToTwoDecimals(double value) {
        return BigDecimal.valueOf(value)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }
}