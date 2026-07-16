package com.company.pms.auth;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AuthResponse {

    private Long id;

    private String username;

    private String name;

    private String designation;

    private String role;

    private String displayRole;

    private String country;

    private Long clientId;

    private String clientName;

    private Long managerUserId;

    private String managerName;

    private String managerDesignation;

    private String managerRole;

    private String managerDisplayRole;
}