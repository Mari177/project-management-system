package com.company.pms.supportticket;

import com.company.pms.auth.AppUser;
import com.company.pms.client.Client;
import com.company.pms.project.Project;
import com.company.pms.resource.ResourceEntity;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "support_tickets")
@Data
public class SupportTicket {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_code", unique = true, length = 40)
    private String ticketCode;

    @ManyToOne
    @JoinColumn(name = "support_project_id", nullable = false)
    @JsonIgnoreProperties({
            "client",
            "deliveryHeadUser",
            "deliveryManagerUser",
            "tlUser",
            "linkedImplementationProject"
    })
    private Project supportProject;

    @ManyToOne
    @JoinColumn(name = "client_id")
    private Client client;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "ticket_type", length = 50)
    private String ticketType;

    @Column(length = 20)
    private String priority;

    @Column(length = 50)
    private String status;

    @ManyToOne
    @JoinColumn(name = "assigned_resource_id")
    @JsonIgnoreProperties({"appUser"})
    private ResourceEntity assignedResource;

    @Column(name = "module_name", length = 120)
    private String moduleName;

    @Column(length = 80)
    private String environment;

    @Column(name = "reported_by_name", length = 150)
    private String reportedByName;

    @ManyToOne
    @JoinColumn(name = "reported_by_user_id")
    @JsonIgnoreProperties({"password", "managerUser", "client"})
    private AppUser reportedByUser;

    @Column(name = "reported_at")
    private LocalDateTime reportedAt;

    @Column(name = "first_response_at")
    private LocalDateTime firstResponseAt;

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;

    @Column(name = "closed_at")
    private LocalDateTime closedAt;

    @Column(name = "root_cause", columnDefinition = "TEXT")
    private String rootCause;

    @Column(name = "resolution_notes", columnDefinition = "TEXT")
    private String resolutionNotes;

    private Boolean billable = true;
}
