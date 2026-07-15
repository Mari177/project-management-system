package com.company.pms.auth;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class UserDropdownDto {

    private Long id;

    private String username;

    private String name;

    private String designation;

    private String role;

    private String displayRole;

    private String country;

    private Long managerUserId;

    private String managerName;
}