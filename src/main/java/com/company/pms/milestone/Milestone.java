package com.company.pms.milestone;

import com.company.pms.project.Project;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

@Entity
@Table(
        name = "project_milestone_status",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_project_milestone",
                        columnNames = {"project_id", "milestone_master_id"}
                )
        }
)
@Data
public class Milestone {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "project_id", nullable = false)
    private Project project;

    @ManyToOne
    @JoinColumn(name = "milestone_master_id", nullable = false)
    private MilestoneMaster milestoneMaster;

    private LocalDate startDate;

    private LocalDate endDate;

    private String status = "NOT_STARTED";

    private Integer progressPercentage = 0;

    /*
     * These getter methods keep your existing frontend working.
     * Frontend can still use:
     * milestone.milestoneName
     * milestone.milestoneOrder
     */
    public String getMilestoneName() {
        return milestoneMaster != null ? milestoneMaster.getMilestoneName() : null;
    }

    public Integer getMilestoneOrder() {
        return milestoneMaster != null ? milestoneMaster.getMilestoneOrder() : null;
    }
}