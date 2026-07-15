package com.company.pms.project;

import lombok.Data;

import java.time.LocalDate;

@Data
public class ProjectRequest {

    private String projectName;

    private Long clientId;

    private String projectType;

    private Long linkedImplementationProjectId;

    /*
     * Country / region.
     * Example: INDIA, UAE, USA, UK
     */
    private String country;

    /*
     * Delivery Head user id.
     * Optional. If not given, we can derive it from Delivery Manager's manager.
     */
    private Long deliveryHeadUserId;

    /*
     * Old display fields.
     * Kept for backward compatibility.
     */
    private String deliveryManagerName;

    private String tlName;

    /*
     * Real user mapping fields.
     */
    private Long deliveryManagerUserId;

    private Long tlUserId;

    private LocalDate startDate;

    private LocalDate endDate;

    private String status;

    private LocalDate supportStartDate;

    private LocalDate supportEndDate;

    private String supportContractType;

    private String supportCoverage;

    private String billingModel;

    private String supportStatus;
}
