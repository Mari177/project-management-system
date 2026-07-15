package com.company.pms.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.util.List;

@Data
@AllArgsConstructor
public class ProjectReportResponse {

    private Long projectId;

    private String projectCode;

    private String projectName;

    private String clientName;

    private String clientContactPerson;

    private String deliveryManagerName;

    private String projectStatus;

    private Double projectCost;

    private Boolean canViewCost;

    private Double overallMilestoneProgress;

    private Long totalTasks;

    private Long completedTasks;

    private Long delayedTasks;

    private Long escalatedTasks;

    private List<MilestoneReportDto> milestones;
}