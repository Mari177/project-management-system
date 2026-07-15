package com.company.pms.auth;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/users")
public class UserLookupController {

    private final AppUserRepository appUserRepository;

    public UserLookupController(AppUserRepository appUserRepository) {
        this.appUserRepository = appUserRepository;
    }

    /*
     * Example:
     * /api/users/by-role?role=DELIVERY_HEAD
     * /api/users/by-role?role=DELIVERY_MANAGER&country=INDIA
     * /api/users/by-role?role=TL&country=INDIA
     */
    @GetMapping("/by-role")
    public List<UserDropdownDto> getUsersByRole(@RequestParam String role,
                                                @RequestParam(required = false) String country,
                                                Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        String normalizedRole = normalizeRole(role);
        String normalizedCountry = normalizeCountry(country);

        List<AppUser> users;

        if (normalizedCountry != null) {
            users = appUserRepository.findByRoleAndCountry(normalizedRole, normalizedCountry);
        } else {
            users = appUserRepository.findByRole(normalizedRole);
        }

        return users.stream()
                .filter(user -> canViewUser(currentUser, user))
                .map(this::toDropdownDto)
                .toList();
    }

    /*
     * Example:
     * /api/users/by-manager/25
     *
     * Useful for:
     * Delivery Head -> Delivery Managers
     * Delivery Manager -> TLs
     * TL -> TEAM_MEMBERs
     */
    @GetMapping("/by-manager/{managerUserId}")
    public List<UserDropdownDto> getUsersByManager(@PathVariable Long managerUserId,
                                                   Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);

        return appUserRepository.findByManagerUserId(managerUserId)
                .stream()
                .filter(user -> canViewUser(currentUser, user))
                .map(this::toDropdownDto)
                .toList();
    }

    private AppUser getCurrentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("User is not logged in");
        }

        return appUserRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Logged-in user not found"));
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            throw new RuntimeException("Role is required");
        }

        return role.trim().toUpperCase();
    }

    private String normalizeCountry(String country) {
        if (country == null || country.isBlank()) {
            return null;
        }

        return country.trim().toUpperCase();
    }

    /*
     * Access rule for dropdown data.
     *
     * ADMIN:
     *   Can view all users.
     *
     * DELIVERY_HEAD:
     *   Can view users from same country.
     *
     * DELIVERY_MANAGER:
     *   Can view users from same country.
     *
     * TL:
     *   Can view users from same country.
     *
     * TEAM_MEMBER:
     *   Can view only himself/herself.
     */
    private boolean canViewUser(AppUser currentUser, AppUser targetUser) {
        if ("ADMIN".equals(currentUser.getRole())) {
            return true;
        }

        if ("TEAM_MEMBER".equals(currentUser.getRole())) {
            return currentUser.getId().equals(targetUser.getId());
        }

        if (currentUser.getCountry() == null || targetUser.getCountry() == null) {
            return false;
        }

        return currentUser.getCountry().equals(targetUser.getCountry());
    }

    private UserDropdownDto toDropdownDto(AppUser user) {
        Long managerUserId = user.getManagerUser() != null
                ? user.getManagerUser().getId()
                : null;

        String managerName = user.getManagerUser() != null
                ? user.getManagerUser().getName()
                : null;

        return new UserDropdownDto(
                user.getId(),
                user.getUsername(),
                user.getName(),
                user.getDesignation(),
                user.getRole(),
                getDisplayRole(user.getRole()),
                user.getCountry(),
                managerUserId,
                managerName
        );
    }

    private String getDisplayRole(String role) {
        return switch (role) {
            case "ADMIN" -> "Admin";
            case "EXECUTIVE_VIEWER" -> "Executive Viewer";
            case "DELIVERY_HEAD" -> "Delivery Head";
            case "DELIVERY_MANAGER" -> "Delivery Manager";
            case "TL" -> "TL";
            case "TEAM_MEMBER" -> "Resource / TEAM_MEMBER";
            case "CLIENT_VIEWER" -> "Client Viewer";
            default -> role;
        };
    }
}