package com.company.pms.resource;

import com.company.pms.auth.AppUser;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "resources")
@Data
public class ResourceEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String resourceName;

    /*
     * Employee's company designation.
     *
     * Examples:
     * Senior Developer
     * Team Lead
     * Delivery Manager
     * QA Engineer
     *
     * This is different from the application permission role.
     */
    private String designation;

    private String department;

    private String skill;

    private Double monthlySalary;

    private String status;

    /*
     * Country is used for regional visibility and filtering.
     *
     * Examples:
     * INDIA
     * UAE
     * USA
     * UK
     */
    private String country;

    /*
     * Human-readable office or working location.
     *
     * Examples:
     * Chennai
     * Bengaluru
     * Dubai
     * London
     */
    private String location;

    /*
     * A resource can optionally be connected to one application login.
     *
     * The reporting manager is obtained through:
     *
     * resources.app_user_id
     *          ↓
     * app_users.manager_user_id
     */
    @OneToOne
    @JoinColumn(name = "app_user_id", unique = true)
    @JsonIgnoreProperties({
            "password",
            "managerUser",
            "hibernateLazyInitializer",
            "handler"
    })
    private AppUser appUser;

    /*
     * These fields are read-only API values.
     *
     * They are not stored as additional columns in the resources table.
     * They are always derived from app_users.manager_user_id.
     */

    @Transient
    @JsonProperty("reportingManagerUserId")
    public Long getReportingManagerUserId() {
        if (appUser == null || appUser.getManagerUser() == null) {
            return null;
        }

        return appUser.getManagerUser().getId();
    }

    @Transient
    @JsonProperty("reportingManagerName")
    public String getReportingManagerName() {
        if (appUser == null || appUser.getManagerUser() == null) {
            return null;
        }

        return appUser.getManagerUser().getName();
    }

    @Transient
    @JsonProperty("reportingManagerDesignation")
    public String getReportingManagerDesignation() {
        if (appUser == null || appUser.getManagerUser() == null) {
            return null;
        }

        return appUser.getManagerUser().getDesignation();
    }
}