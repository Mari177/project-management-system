package com.company.pms.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebRouteConfig implements WebMvcConfigurer {

    @Override
    public void addViewControllers(ViewControllerRegistry registry) {
        registry.addViewController("/")
                .setViewName("forward:/login.html");

        registry.addViewController("/login")
                .setViewName("forward:/login.html");

        registry.addViewController("/dashboard")
                .setViewName("forward:/dashboard.html");

        registry.addViewController("/clients")
                .setViewName("forward:/clients.html");

        registry.addViewController("/resources")
                .setViewName("forward:/resources.html");

        registry.addViewController("/projects")
                .setViewName("forward:/projects.html");

        registry.addViewController("/tasks")
                .setViewName("forward:/tasks.html");

        registry.addViewController("/timesheets")
                .setViewName("forward:/timesheets.html");

        registry.addViewController("/support-tickets")
                .setViewName("forward:/support-tickets.html");
    }
}