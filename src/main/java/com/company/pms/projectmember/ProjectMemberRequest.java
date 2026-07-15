package com.company.pms.projectmember;

import lombok.Data;

import java.time.LocalDate;

@Data
public class ProjectMemberRequest {

    private Long projectId;

    private Long resourceId;

    private String projectRole;

    private Double allocationPercentage;

    private Boolean billable;

    private LocalDate startDate;

    private LocalDate endDate;

    private Boolean active;
}