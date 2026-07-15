package com.company.pms.timesheet;

import lombok.Data;

@Data
public class TimesheetActionRequest {

    private String comments;

    private String rejectionReason;
}
