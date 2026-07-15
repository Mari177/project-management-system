package com.company.pms.auth;

import com.company.pms.client.Client;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "app_users")
@Data
public class AppUser {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    private String name;

    @Column(nullable = false)
    private String role;

    private String status;

    /*
     * Country / region ownership.
     * Example: INDIA, UAE, USA, UK
     */
    private String country;

    @ManyToOne
    @JoinColumn(name = "client_id")
    @JsonIgnoreProperties({ "hibernateLazyInitializer", "handler" })
    private Client client;

    /*
     * Company designation / title.
     * Example: CEO, CTO, Delivery Head, Project Manager, Team Lead,
     * Senior Java Developer, QA Engineer.
     *
     * This is NOT used for permission checks.
     */

    private String designation;

    /*
     * User hierarchy.
     *
     * Delivery Manager -> managerUser = Delivery Head
     * TL -> managerUser = Delivery Manager
     * Team Member -> managerUser = TL
     */
    @ManyToOne
    @JoinColumn(name = "manager_user_id")
    @JsonIgnoreProperties({ "password", "managerUser" })
    private AppUser managerUser;
}