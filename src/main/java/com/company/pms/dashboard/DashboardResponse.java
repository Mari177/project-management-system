package com.company.pms.dashboard;

import lombok.Data;

import java.util.List;

@Data
public class DashboardResponse {

    private long totalClients;
    private long totalProjects;
    private long activeProjects;
    private long completedProjects;
    private long delayedProjects;

    private long totalMilestones;
    private long completedMilestones;

    private long totalTasks;
    private long completedTasks;
    private long delayedTasks;

    private long escalatedTasks;
    private long openEscalations;
    private long criticalEscalations;

    private long totalResources;
    private long totalAllocations;
    private Double totalCost;

    private List<ProjectSummaryDto> projectSummaries;

    private List<EscalatedTaskDto> escalatedTaskDetails;
}