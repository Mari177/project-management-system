package com.company.pms.dashboard;

import java.time.LocalDate;

public class EscalatedTaskDto {

    private Long taskId;
    private String taskName;
    private String projectName;
    private String resourceName;
    private String escalationReasonType;
    private String escalationReason;
    private String escalationSeverity;
    private String escalationStatus;
    private LocalDate escalationDate;

    public EscalatedTaskDto(Long taskId,
                            String taskName,
                            String projectName,
                            String resourceName,
                            String escalationReasonType,
                            String escalationReason,
                            String escalationSeverity,
                            String escalationStatus,
                            LocalDate escalationDate) {
        this.taskId = taskId;
        this.taskName = taskName;
        this.projectName = projectName;
        this.resourceName = resourceName;
        this.escalationReasonType = escalationReasonType;
        this.escalationReason = escalationReason;
        this.escalationSeverity = escalationSeverity;
        this.escalationStatus = escalationStatus;
        this.escalationDate = escalationDate;
    }

    public Long getTaskId() {
        return taskId;
    }

    public String getTaskName() {
        return taskName;
    }

    public String getProjectName() {
        return projectName;
    }

    public String getResourceName() {
        return resourceName;
    }

    public String getEscalationReasonType() {
        return escalationReasonType;
    }

    public String getEscalationReason() {
        return escalationReason;
    }

    public String getEscalationSeverity() {
        return escalationSeverity;
    }

    public String getEscalationStatus() {
        return escalationStatus;
    }

    public LocalDate getEscalationDate() {
        return escalationDate;
    }
}