package com.company.pms.config;

import com.company.pms.auth.CustomUserDetailsService;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
public class SecurityConfig {

    private final CustomUserDetailsService customUserDetailsService;

    public SecurityConfig(CustomUserDetailsService customUserDetailsService) {
        this.customUserDetailsService = customUserDetailsService;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())

                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))

                .authorizeHttpRequests(auth -> auth

                        // Public files
                        .requestMatchers(
                                "/",
                                "/login",
                                "/login.html",
                                "/favicon.ico",
                                "/css/**",
                                "/js/**",
                                "/images/**")
                        .permitAll()

                        // Auth APIs
                        .requestMatchers("/api/auth/login").permitAll()

                        // Static page restrictions
                        .requestMatchers("/dashboard", "/dashboard.html")
                        .hasAnyRole("ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL",
                                "CLIENT_VIEWER", "TEAM_MEMBER")

                        .requestMatchers("/clients", "/clients.html")
                        .hasAnyRole("ADMIN", "DELIVERY_MANAGER")

                        .requestMatchers("/resources", "/resources.html")
                        .hasAnyRole("ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL")

                        .requestMatchers("/projects", "/projects.html")
                        .hasAnyRole("ADMIN", "CLIENT_VIEWER", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL")

                        .requestMatchers("/support-tickets", "/support-tickets.html")
                        .hasAnyRole("ADMIN", "CLIENT_VIEWER", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER")

                        .requestMatchers("/tasks", "/tasks.html")
                        .hasAnyRole("ADMIN", "CLIENT_VIEWER", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL",
                                "TEAM_MEMBER")

                        .requestMatchers("/timesheets", "/timesheets.html")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER")

                        // Dashboard APIs
                        .requestMatchers(HttpMethod.GET, "/api/dashboard/project-report/**")
                        .hasAnyRole("ADMIN", "CLIENT_VIEWER", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL",
                                "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.GET, "/api/dashboard")
                        .hasAnyRole("ADMIN", "CLIENT_VIEWER", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL",
                                "TEAM_MEMBER")

                        // User lookup APIs
                        .requestMatchers(HttpMethod.GET, "/api/users", "/api/users/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL")

                        // Client APIs
                        .requestMatchers(HttpMethod.GET, "/api/clients", "/api/clients/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER")

                        .requestMatchers(HttpMethod.POST, "/api/clients", "/api/clients/**")
                        .hasAnyRole("ADMIN", "DELIVERY_MANAGER")

                        .requestMatchers(HttpMethod.PUT, "/api/clients", "/api/clients/**")
                        .hasAnyRole("ADMIN", "DELIVERY_MANAGER")

                        .requestMatchers(HttpMethod.DELETE, "/api/clients", "/api/clients/**")
                        .hasAnyRole("ADMIN", "DELIVERY_MANAGER")

                        // Resource APIs
                        .requestMatchers(HttpMethod.GET, "/api/resources", "/api/resources/**")
                        .hasAnyRole("ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL")

                        .requestMatchers(HttpMethod.POST, "/api/resources", "/api/resources/**")
                        .hasRole("ADMIN")

                        .requestMatchers(HttpMethod.PUT, "/api/resources", "/api/resources/**")
                        .hasRole("ADMIN")

                        .requestMatchers(HttpMethod.DELETE, "/api/resources", "/api/resources/**")
                        .hasRole("ADMIN")

                        // Project APIs
                        .requestMatchers(HttpMethod.GET, "/api/projects/my-projects")
                        .hasAnyRole("ADMIN", "CLIENT_VIEWER", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL",
                                "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.GET, "/api/projects")
                        .hasAnyRole("ADMIN", "EXECUTIVE_VIEWER")

                        .requestMatchers(HttpMethod.GET, "/api/projects/**")
                        .hasAnyRole("ADMIN", "CLIENT_VIEWER", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL")

                        .requestMatchers(HttpMethod.POST, "/api/projects/*/move-to-support")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER")

                        .requestMatchers(HttpMethod.POST, "/api/projects", "/api/projects/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD")

                        .requestMatchers(HttpMethod.PUT, "/api/projects", "/api/projects/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD")

                        .requestMatchers(HttpMethod.DELETE, "/api/projects", "/api/projects/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD")

                        // Support Ticket APIs
                        .requestMatchers(HttpMethod.GET, "/api/support-tickets", "/api/support-tickets/**")
                        .hasAnyRole("ADMIN", "CLIENT_VIEWER", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.POST, "/api/support-tickets", "/api/support-tickets/**")
                        .hasAnyRole("ADMIN", "CLIENT_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL")

                        .requestMatchers(HttpMethod.PUT, "/api/support-tickets", "/api/support-tickets/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL")

                        .requestMatchers(HttpMethod.DELETE, "/api/support-tickets", "/api/support-tickets/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL")

                        // Milestone APIs
                        .requestMatchers(HttpMethod.GET, "/api/milestones", "/api/milestones/**")
                        .hasAnyRole("ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL")

                        .requestMatchers(HttpMethod.POST, "/api/milestones", "/api/milestones/**")
                        .hasAnyRole("ADMIN", "DELIVERY_MANAGER", "TL")

                        .requestMatchers(HttpMethod.PUT, "/api/milestones", "/api/milestones/**")
                        .hasAnyRole("ADMIN", "DELIVERY_MANAGER", "TL")

                        .requestMatchers(HttpMethod.DELETE, "/api/milestones", "/api/milestones/**")
                        .hasAnyRole("ADMIN", "DELIVERY_MANAGER", "TL")

                        // Timesheet APIs
                        .requestMatchers(HttpMethod.GET, "/api/timesheets/my")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.GET, "/api/timesheets/pending-approval")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL")

                        .requestMatchers(HttpMethod.GET, "/api/timesheets", "/api/timesheets/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.POST, "/api/timesheets", "/api/timesheets/*/submit",
                                "/api/timesheets/*/recall")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.POST, "/api/timesheets/*/approve", "/api/timesheets/*/reject")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL")

                        .requestMatchers(HttpMethod.POST, "/api/time-logs")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.PUT, "/api/time-logs/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.DELETE, "/api/time-logs/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER")

                        // Task APIs
                        .requestMatchers(HttpMethod.GET, "/api/tasks/my-tasks")
                        .hasAnyRole("ADMIN", "CLIENT_VIEWER", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL",
                                "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.GET, "/api/tasks")
                        .hasAnyRole("ADMIN", "EXECUTIVE_VIEWER")

                        .requestMatchers(HttpMethod.GET, "/api/tasks/**")
                        .hasAnyRole("ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL",
                                "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.POST, "/api/tasks", "/api/tasks/**")
                        .hasAnyRole("ADMIN", "DELIVERY_MANAGER", "TL")

                        .requestMatchers(HttpMethod.PUT, "/api/tasks/*/progress")
                        .hasAnyRole("ADMIN", "DELIVERY_MANAGER", "TL", "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.PUT, "/api/tasks", "/api/tasks/**")
                        .hasAnyRole("ADMIN", "DELIVERY_MANAGER", "TL")

                        .requestMatchers(HttpMethod.DELETE, "/api/tasks", "/api/tasks/**")
                        .hasAnyRole("ADMIN", "DELIVERY_MANAGER", "TL")

                        // Project Member APIs
                        .requestMatchers(HttpMethod.GET, "/api/project-members", "/api/project-members/**")
                        .hasAnyRole("ADMIN", "EXECUTIVE_VIEWER", "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL",
                                "TEAM_MEMBER")

                        .requestMatchers(HttpMethod.POST, "/api/project-members", "/api/project-members/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER")

                        .requestMatchers(HttpMethod.PUT, "/api/project-members", "/api/project-members/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER")

                        .requestMatchers(HttpMethod.DELETE, "/api/project-members", "/api/project-members/**")
                        .hasAnyRole("ADMIN", "DELIVERY_HEAD", "DELIVERY_MANAGER")

                        .anyRequest().authenticated())

                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType("application/json");
                            response.getWriter().write("{\"message\":\"Please login first\"}");
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType("application/json");
                            response.getWriter()
                                    .write("{\"message\":\"You do not have permission to access this resource\"}");
                        }))

                .authenticationProvider(authenticationProvider())
                .build();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(customUserDetailsService);
        provider.setPasswordEncoder(passwordEncoder());
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
