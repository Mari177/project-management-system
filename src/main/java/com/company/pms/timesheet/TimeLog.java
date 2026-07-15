package com.company.pms.timesheet;

import com.company.pms.auth.AppUser;
import com.company.pms.milestone.Milestone;
import com.company.pms.project.Project;
import com.company.pms.resource.ResourceEntity;
import com.company.pms.task.TaskEntity;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "time_logs")
@Data
public class TimeLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "timesheet_id")
    @JsonIgnoreProperties({"resource", "submittedByUser", "approvedByUser", "rejectedByUser"})
    private Timesheet timesheet;

    @ManyToOne
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({"client", "deliveryHeadUser", "deliveryManagerUser", "tlUser"})
    private Project project;

    @ManyToOne
    @JoinColumn(name = "project_milestone_status_id", nullable = false)
    @JsonIgnoreProperties({"project", "milestoneMaster"})
    private Milestone milestone;

    @ManyToOne
    @JoinColumn(name = "task_id", nullable = false)
    @JsonIgnoreProperties({"project", "milestone", "assignedResource"})
    private TaskEntity task;

    @ManyToOne
    @JoinColumn(name = "resource_id", nullable = false)
    @JsonIgnoreProperties({"appUser"})
    private ResourceEntity resource;

    @ManyToOne
    @JoinColumn(name = "logged_by_user_id", nullable = false)
    @JsonIgnoreProperties({"password", "managerUser"})
    private AppUser loggedByUser;

    private LocalDate logDate;

    private Double hours;

    private String billingType = "BILLABLE";

    @Column(columnDefinition = "TEXT")
    private String workDescription;

    private String status = "DRAFT";

    private Boolean overrun = false;

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }
}