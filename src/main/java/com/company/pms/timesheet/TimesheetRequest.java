package com.company.pms.timesheet;

import lombok.Data;

import java.time.LocalDate;

@Data
public class TimesheetRequest {

    private Long resourceId;

    private LocalDate periodStart;

    private LocalDate periodEnd;
}
