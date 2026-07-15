package com.company.pms.dashboard;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ProjectSummaryDto {

    private Long projectId;

    private String projectCode;

    private String projectName;

    private String clientName;

    private String clientContactPerson;

    private String deliveryManagerName;

    private String status;

    private Double projectCost;

    private String milestoneStatus;

    private Double milestoneProgressPercentage;

    private Boolean canViewCost;
}