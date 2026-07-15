package com.company.pms.timesheet;

import com.company.pms.auth.AppUser;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "timesheet_approval_history")
@Data
public class TimesheetApprovalHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "timesheet_id", nullable = false)
    @JsonIgnoreProperties({"resource", "submittedByUser", "approvedByUser", "rejectedByUser"})
    private Timesheet timesheet;

    private String action;

    @ManyToOne
    @JoinColumn(name = "action_by_user_id", nullable = false)
    @JsonIgnoreProperties({"password", "managerUser"})
    private AppUser actionByUser;

    @Column(columnDefinition = "TEXT")
    private String comments;

    private LocalDateTime actionAt;

    @PrePersist
    public void prePersist() {
        actionAt = LocalDateTime.now();
    }
}
