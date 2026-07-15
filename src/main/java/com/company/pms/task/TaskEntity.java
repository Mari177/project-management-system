package com.company.pms.task;

import com.company.pms.milestone.Milestone;
import com.company.pms.project.Project;
import com.company.pms.resource.ResourceEntity;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

@Entity
@Table(name = "tasks")
@Data
public class TaskEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String taskName;

    @Column(name = "task_code", unique = true, length = 35)
    private String taskCode;

    @Column(columnDefinition = "TEXT")
    private String taskDescription;

    private String taskType;
    // Functional / Technical

    @ManyToOne
    @JoinColumn(name = "project_id")
    private Project project;

    @ManyToOne
    @JoinColumn(name = "project_milestone_status_id")
    private Milestone milestone;

    @ManyToOne
    @JoinColumn(name = "resource_id")
    private ResourceEntity assignedResource;

    private LocalDate startDate;

    private LocalDate endDate;

    /*
     * Planned effort assigned by TL / manager.
     * Actual effort comes from approved timesheet hours.
     */
    private Double allocatedHours = 0.0;

    private String status;

    private String priority;

    private Integer progressPercentage = 0;

    private String remarks;

    private Boolean escalated = false;

    private String escalationReasonType;

    @Column(columnDefinition = "TEXT")
    private String escalationReason;

    private String escalationSeverity;

    private String escalationStatus;

    private LocalDate escalationDate;
}