package com.company.pms.timesheet;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDate;

@Data
@AllArgsConstructor
public class TimeLogDto {

    private Long id;

    private Long timesheetId;

    private Long projectId;

    private String projectCode;

    private String projectName;

    private Long milestoneId;

    private String milestoneName;

    private Long taskId;

    private String taskCode;

    private String taskName;

    private Long resourceId;

    private String resourceName;

    private Long loggedByUserId;

    private String loggedByName;

    private LocalDate logDate;

    private Double hours;

    private String billingType;

    private String workDescription;

    private String status;

    private Boolean overrun;
}
