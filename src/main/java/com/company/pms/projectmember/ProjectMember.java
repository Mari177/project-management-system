package com.company.pms.projectmember;

import com.company.pms.project.Project;
import com.company.pms.resource.ResourceEntity;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

@Entity
@Table(
        name = "project_members",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_project_member_project_resource",
                        columnNames = {"project_id", "resource_id"}
                )
        }
)
@Data
public class ProjectMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /*
     * Project to which this person/resource is allocated.
     */
    @ManyToOne
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({
            "client",
            "deliveryHeadUser",
            "deliveryManagerUser",
            "tlUser"
    })
    private Project project;

    /*
     * Person/resource allocated to the project.
     */
    @ManyToOne
    @JoinColumn(name = "resource_id", nullable = false)
    @JsonIgnoreProperties({"appUser"})
    private ResourceEntity resource;

    /*
     * Role inside this project.
     * Example: PROJECT_MANAGER, TECH_LEAD, BACKEND_DEVELOPER,
     * FRONTEND_ENGINEER, QA_ENGINEER, BUSINESS_ANALYST, DEVOPS_ENGINEER.
     */
    private String projectRole;

    /*
     * Allocation percentage for capacity planning.
     * Example: 100 = full time, 50 = half allocation.
     */
    private Double allocationPercentage = 100.0;

    /*
     * Whether this person is billable in this project.
     */
    private Boolean billable = true;

    private LocalDate startDate;

    private LocalDate endDate;

    private Boolean active = true;
}