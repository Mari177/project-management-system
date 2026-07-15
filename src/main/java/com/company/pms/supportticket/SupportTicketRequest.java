package com.company.pms.supportticket;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SupportTicketRequest {

    private Long supportProjectId;

    private String title;

    private String description;

    private String ticketType;

    private String priority;

    private String status;

    private Long assignedResourceId;

    private String moduleName;

    private String environment;

    private String reportedByName;

    private LocalDateTime firstResponseAt;

    private LocalDateTime resolvedAt;

    private LocalDateTime closedAt;

    private String rootCause;

    private String resolutionNotes;

    private Boolean billable;
}
