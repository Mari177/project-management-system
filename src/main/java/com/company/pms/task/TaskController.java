package com.company.pms.task;

import com.company.pms.auth.AppUser;
import com.company.pms.auth.AppUserRepository;
import com.company.pms.milestone.Milestone;
import com.company.pms.milestone.MilestoneRepository;
import com.company.pms.milestone.MilestoneService;
import com.company.pms.project.Project;
import com.company.pms.project.ProjectRepository;
import com.company.pms.resource.ResourceEntity;
import com.company.pms.resource.ResourceRepository;
import com.company.pms.projectmember.ProjectMember;
import com.company.pms.projectmember.ProjectMemberRepository;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskRepository taskRepository;
    private final TaskCodeService taskCodeService;
    private final ProjectRepository projectRepository;
    private final MilestoneRepository milestoneRepository;
    private final ResourceRepository resourceRepository;
    private final AppUserRepository appUserRepository;
    private final MilestoneService milestoneService;
    private final ProjectMemberRepository projectMemberRepository;

    public TaskController(TaskRepository taskRepository,
            ProjectRepository projectRepository,
            MilestoneRepository milestoneRepository,
            ResourceRepository resourceRepository,
            AppUserRepository appUserRepository,
            ProjectMemberRepository projectMemberRepository,
            MilestoneService milestoneService,
            TaskCodeService taskCodeService) {
        this.taskRepository = taskRepository;
        this.projectRepository = projectRepository;
        this.milestoneRepository = milestoneRepository;
        this.resourceRepository = resourceRepository;
        this.appUserRepository = appUserRepository;
        this.milestoneService = milestoneService;
        this.projectMemberRepository = projectMemberRepository;
        this.taskCodeService = taskCodeService;
    }

    @GetMapping
    public List<TaskEntity> getAllTasks() {
        return taskRepository.findAll();
    }

    @GetMapping("/my-tasks")
    public List<TaskEntity> getMyTasks(Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        return switch (currentUser.getRole()) {
            case "ADMIN", "EXECUTIVE_VIEWER" -> taskRepository.findAll();
            case "DELIVERY_HEAD" -> getDeliveryHeadTasks(currentUser);
            case "DELIVERY_MANAGER" -> taskRepository.findByProjectDeliveryManagerUserId(currentUser.getId());
            case "TL" -> taskRepository.findByProjectTlUserId(currentUser.getId());
            case "CLIENT_VIEWER" ->  getClientTasks(currentUser);
            case "TEAM_MEMBER" -> taskRepository.findByAssignedResourceAppUserId(currentUser.getId());
            default -> List.of();
        };
    }

    @GetMapping("/{id}")
    public TaskEntity getTaskById(@PathVariable Long id) {
        return taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));
    }

    @GetMapping("/project/{projectId}")
    public List<TaskEntity> getTasksByProject(@PathVariable Long projectId) {
        return taskRepository.findByProjectId(projectId);
    }

    @GetMapping("/milestone/{milestoneId}")
    public List<TaskEntity> getTasksByMilestone(@PathVariable Long milestoneId) {
        return taskRepository.findByMilestoneId(milestoneId);
    }

    @GetMapping("/resource/{resourceId}")
    public List<TaskEntity> getTasksByResource(@PathVariable Long resourceId) {
        return taskRepository.findByAssignedResourceId(resourceId);
    }

    @PostMapping
    public TaskEntity createTask(@RequestBody TaskRequest request,
            Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new RuntimeException("Project not found"));

        validateTaskManagementPermission(currentUser, project);

        Milestone milestone = milestoneRepository.findById(request.getMilestoneId())
                .orElseThrow(() -> new RuntimeException("Milestone not found"));

        validateMilestoneBelongsToProject(milestone, project);

        ResourceEntity resource = resourceRepository.findById(request.getResourceId())
                .orElseThrow(() -> new RuntimeException("Resource not found"));

        validateTaskDates(request, project);
        validateAssigneeIsActiveProjectMember(project, resource, request);

        TaskEntity task = new TaskEntity();
        mapRequestToTask(request, task, project, milestone, resource, true);

        if (task.getTaskCode() == null || task.getTaskCode().isBlank()) {
    task.setTaskCode(taskCodeService.generateTaskCode(task.getStartDate()));
}

        TaskEntity savedTask = taskRepository.save(task);
        milestoneService.recalculateMilestoneFromTasks(savedTask.getMilestone().getId());

        return savedTask;
    }

    @PutMapping("/{id}")
    public TaskEntity updateTask(@PathVariable Long id,
            @RequestBody TaskRequest request,
            Authentication authentication) {
        TaskEntity task = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        Long oldMilestoneId = task.getMilestone() != null
                ? task.getMilestone().getId()
                : null;

        Project project = projectRepository.findById(request.getProjectId())
                .orElseThrow(() -> new RuntimeException("Project not found"));

        AppUser currentUser = getCurrentUser(authentication);
        validateTaskManagementPermission(currentUser, project);

        Milestone milestone = milestoneRepository.findById(request.getMilestoneId())
                .orElseThrow(() -> new RuntimeException("Milestone not found"));

        validateMilestoneBelongsToProject(milestone, project);

        ResourceEntity resource = resourceRepository.findById(request.getResourceId())
                .orElseThrow(() -> new RuntimeException("Resource not found"));

        validateTaskDates(request, project);
        validateAssigneeIsActiveProjectMember(project, resource, request);

        mapRequestToTask(request, task, project, milestone, resource, false);

        TaskEntity savedTask = taskRepository.save(task);

        if (oldMilestoneId != null && !oldMilestoneId.equals(savedTask.getMilestone().getId())) {
            milestoneService.recalculateMilestoneFromTasks(oldMilestoneId);
        }

        milestoneService.recalculateMilestoneFromTasks(savedTask.getMilestone().getId());

        return savedTask;
    }

    @PutMapping("/{id}/progress")
    public TaskEntity updateTaskProgress(@PathVariable Long id,
            @RequestBody TaskRequest request,
            Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        TaskEntity task = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        if (request.getProgressPercentage() == null) {
            throw new RuntimeException("Progress percentage is required");
        }

        if ("TEAM_MEMBER".equals(currentUser.getRole())) {
            boolean assignedToCurrentEmployee = task.getAssignedResource() != null
                    && task.getAssignedResource().getAppUser() != null
                    && task.getAssignedResource().getAppUser().getId().equals(currentUser.getId());

            if (!assignedToCurrentEmployee) {
                throw new RuntimeException("You can update progress only for your assigned task");
            }
        }

        task.setProgressPercentage(normalizeProgress(request.getProgressPercentage(), 0));

        if (task.getProgressPercentage() == 100) {
            task.setStatus("COMPLETED");
        } else if (task.getProgressPercentage() > 0
                && (task.getStatus() == null || "NOT_STARTED".equals(task.getStatus()))) {
            task.setStatus("IN_PROGRESS");
        }

        TaskEntity savedTask = taskRepository.save(task);

        if (savedTask.getMilestone() != null) {
            milestoneService.recalculateMilestoneFromTasks(savedTask.getMilestone().getId());
        }

        return savedTask;
    }

    @DeleteMapping("/{id}")
    public void deleteTask(@PathVariable Long id,
            Authentication authentication) {
        TaskEntity task = taskRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        AppUser currentUser = getCurrentUser(authentication);

        if (task.getProject() == null) {
            throw new RuntimeException("Task project is missing");
        }

        validateTaskManagementPermission(currentUser, task.getProject());

        Long milestoneId = task.getMilestone() != null
                ? task.getMilestone().getId()
                : null;

        taskRepository.delete(task);

        if (milestoneId != null) {
            milestoneService.recalculateMilestoneFromTasks(milestoneId);
        }
    }

    private void mapRequestToTask(TaskRequest request,
            TaskEntity task,
            Project project,
            Milestone milestone,
            ResourceEntity resource,
            boolean createMode) {
        task.setTaskName(request.getTaskName());
        task.setTaskDescription(request.getTaskDescription());
        task.setTaskType(request.getTaskType());
        task.setProject(project);
        task.setMilestone(milestone);
        task.setAssignedResource(resource);
        task.setStartDate(request.getStartDate());
        task.setEndDate(request.getEndDate());
        task.setAllocatedHours(normalizeAllocatedHours(request.getAllocatedHours()));
        task.setStatus(request.getStatus());
        task.setPriority(request.getPriority());
        task.setRemarks(request.getRemarks());

        if (createMode || request.getProgressPercentage() != null) {
            task.setProgressPercentage(normalizeProgress(request.getProgressPercentage(), 0));
        }

        task.setEscalated(request.getEscalated() != null ? request.getEscalated() : false);
        task.setEscalationReasonType(request.getEscalationReasonType());
        task.setEscalationReason(request.getEscalationReason());
        task.setEscalationSeverity(request.getEscalationSeverity());
        task.setEscalationStatus(request.getEscalationStatus());
        task.setEscalationDate(request.getEscalationDate());
    }

    private void validateMilestoneBelongsToProject(Milestone milestone, Project project) {
        if (milestone.getProject() == null || !milestone.getProject().getId().equals(project.getId())) {
            throw new RuntimeException("Selected milestone does not belong to selected project");
        }
    }

    private Double normalizeAllocatedHours(Double allocatedHours) {
        if (allocatedHours == null) {
            return 0.0;
        }

        if (allocatedHours < 0) {
            throw new RuntimeException("Allocated hours cannot be negative");
        }

        return allocatedHours;
    }

    private Integer normalizeProgress(Integer progress, int defaultValue) {
        int value = progress != null ? progress : defaultValue;

        if (value < 0 || value > 100) {
            throw new RuntimeException("Progress percentage should be between 0 and 100");
        }

        return value;
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

    private AppUser getCurrentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("User is not logged in");
        }

        return appUserRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Logged-in user not found"));
    }

    private void validateTaskManagementPermission(AppUser currentUser, Project project) {
        String role = currentUser.getRole();

        if ("ADMIN".equals(role)) {
            return;
        }

        if ("DELIVERY_MANAGER".equals(role)) {
            boolean ownsProject = project.getDeliveryManagerUser() != null
                    && project.getDeliveryManagerUser().getId().equals(currentUser.getId());

            if (ownsProject) {
                return;
            }
        }

        if ("TL".equals(role)) {
            boolean ownsProject = project.getTlUser() != null
                    && project.getTlUser().getId().equals(currentUser.getId());

            if (ownsProject) {
                return;
            }
        }

        throw new RuntimeException("You can manage tasks only for projects assigned to you");
    }

    private void validateAssigneeIsActiveProjectMember(Project project,
            ResourceEntity resource,
            TaskRequest request) {
        ProjectMember member = projectMemberRepository
                .findByProjectIdAndResourceId(project.getId(), resource.getId())
                .orElseThrow(() -> new RuntimeException(
                        "Selected assignee is not allocated to this project"));

        if (member.getActive() == null || !member.getActive()) {
            throw new RuntimeException("Selected assignee is not an active project member");
        }

        if (request.getStartDate() != null
                && member.getStartDate() != null
                && request.getStartDate().isBefore(member.getStartDate())) {
            throw new RuntimeException("Task start date cannot be before assignee allocation start date");
        }

        if (request.getEndDate() != null
                && member.getEndDate() != null
                && request.getEndDate().isAfter(member.getEndDate())) {
            throw new RuntimeException("Task end date cannot be after assignee allocation end date");
        }
    }

    private void validateTaskDates(TaskRequest request, Project project) {
        if (request.getStartDate() != null
                && request.getEndDate() != null
                && request.getEndDate().isBefore(request.getStartDate())) {
            throw new RuntimeException("Task end date cannot be before task start date");
        }

        if (project.getStartDate() != null
                && request.getStartDate() != null
                && request.getStartDate().isBefore(project.getStartDate())) {
            throw new RuntimeException("Task start date cannot be before project start date");
        }

        if (project.getEndDate() != null
                && request.getEndDate() != null
                && request.getEndDate().isAfter(project.getEndDate())) {
            throw new RuntimeException("Task end date cannot be after project end date");
        }
    }

    private List<TaskEntity> getClientTasks(AppUser currentUser) {
    if (currentUser.getClient() == null) {
        return List.of();
    }

    return taskRepository.findByProjectClientIdOrderByIdDesc(currentUser.getClient().getId());
}

}