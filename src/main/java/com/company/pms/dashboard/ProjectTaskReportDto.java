package com.company.pms.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDate;

@Data
@AllArgsConstructor
public class ProjectTaskReportDto {

    private Long taskId;

    private String taskCode;

    private String taskName;

    private String taskDescription;

    private String taskType;

    private String taskStatus;

    private Integer taskProgressPercentage;

    private String priority;

    private Boolean escalated;

    private String resourceName;

    private String reportingManagerName;

    private String reportingManagerDesignation;

    private String resourceLocation;

    private LocalDate startDate;

    private LocalDate endDate;

    private Double taskCost;

    private Double allocatedHours;

    private Double approvedHours;

    private Double plannedCost;

    private Double actualCost;

    private Double costVariance;
}