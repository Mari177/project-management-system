package com.company.pms.timesheet;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TimeSummaryDto {

    private Long taskId;

    private String taskName;

    private Long resourceId;

    private String resourceName;

    private String reportingManagerName;

    private String reportingManagerDesignation;

    private Double allocatedHours;

    private Double draftHours;

    private Double pendingApprovalHours;

    private Double approvedHours;

    private Double rejectedHours;

    private Double remainingHours;

    private Double overrunHours;

    private Double plannedCost;

    private Double actualCost;

    private Double costVariance;
}