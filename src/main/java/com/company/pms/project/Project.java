package com.company.pms.project;

import com.company.pms.auth.AppUser;
import com.company.pms.client.Client;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDate;

@Entity
@Table(name = "projects")
@Data
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String projectName;

    @Column(name = "project_code", unique = true, length = 40)
    private String projectCode;

    @Column(name = "project_type", length = 30)
    private String projectType = "IMPLEMENTATION";

    @ManyToOne
    @JoinColumn(name = "linked_implementation_project_id")
    @JsonIgnoreProperties({
            "client",
            "deliveryHeadUser",
            "deliveryManagerUser",
            "tlUser",
            "linkedImplementationProject"
    })
    private Project linkedImplementationProject;

    @ManyToOne
    @JoinColumn(name = "client_id")
    private Client client;

    /*
     * Country / region ownership.
     * Example: INDIA, UAE, USA, UK
     */
    private String country;

    /*
     * Delivery Head mapping.
     * Later this will be used for regional filtering.
     */
    @ManyToOne
    @JoinColumn(name = "delivery_head_user_id")
    @JsonIgnoreProperties({"password", "managerUser", "client"})
    private AppUser deliveryHeadUser;

    /*
     * Old display fields.
     * Kept for UI display and backward compatibility.
     */
    private String deliveryManagerName;

    private String tlName;

    /*
     * Real user mappings.
     */
    @ManyToOne
    @JoinColumn(name = "delivery_manager_user_id")
    @JsonIgnoreProperties({"password", "managerUser", "client"})
    private AppUser deliveryManagerUser;

    @ManyToOne
    @JoinColumn(name = "tl_user_id")
    @JsonIgnoreProperties({"password", "managerUser", "client"})
    private AppUser tlUser;

    private LocalDate startDate;

    private LocalDate endDate;

    private String status;

    @Column(name = "support_start_date")
    private LocalDate supportStartDate;

    @Column(name = "support_end_date")
    private LocalDate supportEndDate;

    @Column(name = "support_contract_type", length = 50)
    private String supportContractType;

    @Column(name = "support_coverage", length = 50)
    private String supportCoverage;

    @Column(name = "billing_model", length = 50)
    private String billingModel;

    @Column(name = "support_status", length = 50)
    private String supportStatus;
}
