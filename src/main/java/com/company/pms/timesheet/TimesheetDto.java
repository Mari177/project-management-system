package com.company.pms.timesheet;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Data
@AllArgsConstructor
public class TimesheetDto {

    private Long id;

    private Long resourceId;

    private String resourceName;

    private Long reportingManagerUserId;

    private String reportingManagerName;

    private String reportingManagerDesignation;

    private Long submittedByUserId;

    private String submittedByName;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    private String status;

    private Double totalHours;

    private Double billableHours;

    private Double nonBillableHours;

    private LocalDateTime submittedAt;

    private LocalDateTime approvedAt;

    private LocalDateTime rejectedAt;

    private String approvedByName;

    private String rejectedByName;

    private String rejectionReason;

    private Long timeLogCount;

    private List<TimeLogDto> timeLogs;
}
