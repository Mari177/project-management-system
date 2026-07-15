package com.company.pms.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;

@Data
@AllArgsConstructor
public class MilestoneReportDto {

    private Long milestoneId;

    private Integer milestoneOrder;

    private String milestoneName;

    private String milestoneStatus;

    private Integer milestoneProgressPercentage;

    private LocalDate startDate;

    private LocalDate endDate;

    private Long totalTasks;

    private Long completedTasks;

    private Long delayedTasks;

    private Long escalatedTasks;

    private List<ProjectTaskReportDto> tasks;
}