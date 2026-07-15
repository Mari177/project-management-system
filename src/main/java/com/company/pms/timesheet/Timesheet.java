package com.company.pms.timesheet;

import com.company.pms.auth.AppUser;
import com.company.pms.resource.ResourceEntity;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "timesheets",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_timesheets_resource_period",
                        columnNames = {"resource_id", "period_start", "period_end"}
                )
        }
)
@Data
public class Timesheet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "resource_id", nullable = false)
    @JsonIgnoreProperties({"appUser"})
    private ResourceEntity resource;

    @ManyToOne
    @JoinColumn(name = "submitted_by_user_id", nullable = false)
    @JsonIgnoreProperties({"password", "managerUser"})
    private AppUser submittedByUser;

    private LocalDate periodStart;

    private LocalDate periodEnd;

    private String status = "DRAFT";

    private Double totalHours = 0.0;

    private Double billableHours = 0.0;

    private Double nonBillableHours = 0.0;

    private LocalDateTime submittedAt;

    private LocalDateTime approvedAt;

    private LocalDateTime rejectedAt;

    @ManyToOne
    @JoinColumn(name = "approved_by_user_id")
    @JsonIgnoreProperties({"password", "managerUser"})
    private AppUser approvedByUser;

    @ManyToOne
    @JoinColumn(name = "rejected_by_user_id")
    @JsonIgnoreProperties({"password", "managerUser"})
    private AppUser rejectedByUser;

    @Column(columnDefinition = "TEXT")
    private String rejectionReason;

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
