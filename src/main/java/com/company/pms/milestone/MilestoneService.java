package com.company.pms.milestone;

import com.company.pms.project.Project;
import com.company.pms.project.ProjectRepository;
import com.company.pms.task.TaskEntity;
import com.company.pms.task.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
public class MilestoneService {

    private final MilestoneRepository milestoneRepository;
    private final MilestoneMasterRepository milestoneMasterRepository;
    private final ProjectRepository projectRepository;
    private final TaskRepository taskRepository;

    public MilestoneService(MilestoneRepository milestoneRepository,
                            MilestoneMasterRepository milestoneMasterRepository,
                            ProjectRepository projectRepository,
                            TaskRepository taskRepository) {
        this.milestoneRepository = milestoneRepository;
        this.milestoneMasterRepository = milestoneMasterRepository;
        this.projectRepository = projectRepository;
        this.taskRepository = taskRepository;
    }

    @Transactional
    public void ensureProjectMilestoneStatus(Project project) {
        if (project == null || project.getId() == null) {
            return;
        }

        List<MilestoneMaster> masters = milestoneMasterRepository.findByActiveTrueOrderByMilestoneOrderAsc();

        for (MilestoneMaster master : masters) {
            boolean exists = milestoneRepository.existsByProjectIdAndMilestoneMasterId(
                    project.getId(),
                    master.getId()
            );

            if (!exists) {
                Milestone status = new Milestone();
                status.setProject(project);
                status.setMilestoneMaster(master);
                status.setStatus("NOT_STARTED");
                status.setProgressPercentage(0);
                milestoneRepository.save(status);
            }
        }
    }

    @Transactional
    public List<Milestone> getMilestonesByProjectId(Long projectId) {
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));

        ensureProjectMilestoneStatus(project);
        recalculateProjectMilestones(projectId);

        return milestoneRepository.findByProjectIdOrderByMilestoneMasterMilestoneOrderAsc(projectId);
    }

    @Transactional
    public List<Milestone> getAllProjectMilestoneStatuses() {
        List<Project> projects = projectRepository.findAll();

        for (Project project : projects) {
            ensureProjectMilestoneStatus(project);
            recalculateProjectMilestones(project.getId());
        }

        return milestoneRepository.findAll();
    }

    @Transactional
    public void recalculateProjectMilestones(Long projectId) {
        if (projectId == null) {
            return;
        }

        List<Milestone> milestones =
                milestoneRepository.findByProjectIdOrderByMilestoneMasterMilestoneOrderAsc(projectId);

        for (Milestone milestone : milestones) {
            recalculateMilestoneFromTasks(milestone.getId());
        }
    }

    @Transactional
    public Milestone recalculateMilestoneFromTasks(Long milestoneId) {
        Milestone milestone = milestoneRepository.findById(milestoneId)
                .orElseThrow(() -> new RuntimeException("Project milestone status not found"));

        List<TaskEntity> tasks = taskRepository.findByMilestoneId(milestoneId);

        if (tasks == null || tasks.isEmpty()) {
            milestone.setProgressPercentage(0);
            milestone.setStatus("NOT_STARTED");
            return milestoneRepository.save(milestone);
        }

        double totalWeight = 0.0;
        double weightedProgress = 0.0;

        for (TaskEntity task : tasks) {
            double taskWeight = calculateTaskWeight(task);
            int taskProgress = getTaskProgress(task);

            totalWeight += taskWeight;
            weightedProgress += taskProgress * taskWeight;
        }

        int milestoneProgress = totalWeight == 0
                ? 0
                : (int) Math.round(weightedProgress / totalWeight);

        milestoneProgress = clampProgress(milestoneProgress);

        milestone.setProgressPercentage(milestoneProgress);
        milestone.setStatus(calculateMilestoneStatus(tasks, milestoneProgress));

        return milestoneRepository.save(milestone);
    }

    public Double calculateProjectMilestoneProgress(List<Milestone> milestones) {
        if (milestones == null || milestones.isEmpty()) {
            return 0.0;
        }

        double totalWeight = 0.0;
        double weightedProgress = 0.0;

        for (Milestone milestone : milestones) {
            double milestoneWeight = getMilestoneWeight(milestone, milestones.size());
            int progress = milestone.getProgressPercentage() != null
                    ? milestone.getProgressPercentage()
                    : 0;

            totalWeight += milestoneWeight;
            weightedProgress += progress * milestoneWeight;
        }

        if (totalWeight == 0) {
            return 0.0;
        }

        return roundToTwoDecimals(weightedProgress / totalWeight);
    }

    private double calculateTaskWeight(TaskEntity task) {
        if (task == null || task.getStartDate() == null || task.getEndDate() == null) {
            return 1.0;
        }

        long days = ChronoUnit.DAYS.between(task.getStartDate(), task.getEndDate()) + 1;

        return days > 0 ? days : 1.0;
    }

    private int getTaskProgress(TaskEntity task) {
        if (task == null) {
            return 0;
        }

        if (task.getProgressPercentage() != null) {
            return clampProgress(task.getProgressPercentage());
        }

        if ("COMPLETED".equals(task.getStatus())) {
            return 100;
        }

        return 0;
    }

    private String calculateMilestoneStatus(List<TaskEntity> tasks, int milestoneProgress) {
        boolean hasDelayedOrBlocked = tasks.stream()
                .anyMatch(task ->
                        "DELAYED".equals(task.getStatus()) ||
                        "BLOCKED".equals(task.getStatus())
                );

        if (hasDelayedOrBlocked) {
            return "DELAYED";
        }

        boolean allCompleted = tasks.stream()
                .allMatch(task ->
                        "COMPLETED".equals(task.getStatus()) ||
                        getTaskProgress(task) == 100
                );

        if (allCompleted && milestoneProgress == 100) {
            return "COMPLETED";
        }

        boolean hasOnHold = tasks.stream()
                .anyMatch(task -> "ON_HOLD".equals(task.getStatus()));

        if (hasOnHold) {
            return "ON_HOLD";
        }

        boolean hasInProgress = tasks.stream()
                .anyMatch(task -> "IN_PROGRESS".equals(task.getStatus()));

        if (hasInProgress || milestoneProgress > 0) {
            return "IN_PROGRESS";
        }

        return "NOT_STARTED";
    }

    private double getMilestoneWeight(Milestone milestone, int milestoneCount) {
        if (milestone != null &&
                milestone.getMilestoneMaster() != null &&
                milestone.getMilestoneMaster().getWeightPercentage() != null &&
                milestone.getMilestoneMaster().getWeightPercentage() > 0) {
            return milestone.getMilestoneMaster().getWeightPercentage();
        }

        if (milestoneCount <= 0) {
            return 0.0;
        }

        return 100.0 / milestoneCount;
    }

    private int clampProgress(Integer progress) {
        if (progress == null) {
            return 0;
        }

        if (progress < 0) {
            return 0;
        }

        if (progress > 100) {
            return 100;
        }

        return progress;
    }

    private double roundToTwoDecimals(double value) {
        return BigDecimal.valueOf(value)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }
}