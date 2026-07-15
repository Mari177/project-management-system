package com.company.pms.milestone;

import lombok.Data;

import java.time.LocalDate;

@Data
public class MilestoneRequest {

    private String milestoneName;

    private Long projectId;

    private LocalDate startDate;

    private LocalDate endDate;

    private String status;

    private Integer progressPercentage;
}