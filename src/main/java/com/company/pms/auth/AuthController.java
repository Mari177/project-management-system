
package com.company.pms.auth;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

        private final AuthenticationManager authenticationManager;
        private final AppUserRepository appUserRepository;

        public AuthController(AuthenticationManager authenticationManager,
                        AppUserRepository appUserRepository) {
                this.authenticationManager = authenticationManager;
                this.appUserRepository = appUserRepository;
        }

        @PostMapping("/login")
        public AuthResponse login(@RequestBody LoginRequest request,
                        HttpServletRequest httpServletRequest) {

                Authentication authentication = authenticationManager.authenticate(
                                new UsernamePasswordAuthenticationToken(
                                                request.getUsername(),
                                                request.getPassword()));

                SecurityContext securityContext = SecurityContextHolder.createEmptyContext();
                securityContext.setAuthentication(authentication);
                SecurityContextHolder.setContext(securityContext);

                HttpSession session = httpServletRequest.getSession(true);
                session.setAttribute(
                                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                                securityContext);

                AppUser appUser = appUserRepository.findByUsername(request.getUsername())
                                .orElseThrow(() -> new RuntimeException("User not found"));

                return toResponse(appUser);
        }

        @GetMapping("/me")
        public AuthResponse me(Authentication authentication) {
                AppUser appUser = appUserRepository.findByUsername(authentication.getName())
                                .orElseThrow(() -> new RuntimeException("User not found"));

                return toResponse(appUser);
        }

        @PostMapping("/logout")
        public String logout(HttpServletRequest request) {
                request.getSession().invalidate();
                SecurityContextHolder.clearContext();
                return "Logged out successfully";
        }

        private AuthResponse toResponse(AppUser appUser) {
                Long managerUserId = appUser.getManagerUser() != null
                                ? appUser.getManagerUser().getId()
                                : null;

                String managerName = appUser.getManagerUser() != null
                                ? appUser.getManagerUser().getName()
                                : null;

                Long clientId = appUser.getClient() != null ? appUser.getClient().getId() : null;
                String clientName = appUser.getClient() != null ? appUser.getClient().getClientName() : null;

                return new AuthResponse(
                                appUser.getId(),
                                appUser.getUsername(),
                                appUser.getName(),
                                appUser.getDesignation(),
                                appUser.getRole(),
                                getDisplayRole(appUser.getRole()),
                                appUser.getCountry(),
                                clientId,
                                clientName,
                                managerUserId,
                                managerName);
        }

        private String getDisplayRole(String role) {
                return switch (role) {
                        case "ADMIN" -> "Admin";
                        case "EXECUTIVE_VIEWER" -> "Executive Viewer";
                        case "DELIVERY_HEAD" -> "Delivery Head";
                        case "DELIVERY_MANAGER" -> "Delivery Manager";
                        case "TL" -> "Team Lead";
                        case "TEAM_MEMBER" -> "Team Member";
                        case "CLIENT_VIEWER" -> "Client Viewer";
                        default -> role;
                };
        }
}