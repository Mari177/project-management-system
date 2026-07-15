package com.company.pms.timesheet;

import lombok.Data;

import java.time.LocalDate;

@Data
public class TimeLogRequest {

    private Long timesheetId;

    private Long taskId;

    private Long resourceId;

    private LocalDate logDate;

    private Double hours;

    private String billingType;

    private String workDescription;
}