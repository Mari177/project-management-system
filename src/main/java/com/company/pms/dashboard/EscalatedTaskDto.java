package com.company.pms.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDate;

@Data
@AllArgsConstructor
public class EscalatedTaskDto {

    private Long taskId;

    private String taskName;

    private String projectName;

    private String resourceName;

    private String reportingManagerName;

    private String reportingManagerDesignation;

    private String escalationReasonType;

    private String escalationReason;

    private String escalationSeverity;

    private String escalationStatus;

    private LocalDate escalationDate;
}