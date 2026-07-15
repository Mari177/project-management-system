package com.company.pms.task;

import lombok.Data;

import java.time.LocalDate;

@Data
public class TaskRequest {

    private String taskName;

    private String taskDescription;

    private String taskType;

    private Long projectId;

    private Long milestoneId;

    private Long resourceId;

    private LocalDate startDate;

    private LocalDate endDate;

    private Double allocatedHours;

    private String status;

    private String priority;

    private Integer progressPercentage;

    private String remarks;

    private Boolean escalated;

    private String escalationReasonType;

    private String escalationReason;

    private String escalationSeverity;

    private String escalationStatus;

    private LocalDate escalationDate;
}