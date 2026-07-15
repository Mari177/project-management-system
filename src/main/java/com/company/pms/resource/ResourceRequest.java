package com.company.pms.resource;

import lombok.Data;

@Data
public class ResourceRequest {

    private String resourceName;

    private String designation;

    private String department;

    private String skill;

    private Double monthlySalary;

    private String status;

    private String country;

    private String location;

    private Long appUserId;
}