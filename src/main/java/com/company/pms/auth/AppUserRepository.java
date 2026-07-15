package com.company.pms.auth;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface AppUserRepository extends JpaRepository<AppUser, Long> {

    Optional<AppUser> findByUsername(String username);

    List<AppUser> findByRole(String role);

    List<AppUser> findByRoleAndCountry(String role, String country);

    List<AppUser> findByManagerUserId(Long managerUserId);
}