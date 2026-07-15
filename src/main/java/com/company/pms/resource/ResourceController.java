package com.company.pms.resource;

import com.company.pms.auth.AppUser;
import com.company.pms.auth.AppUserRepository;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/resources")
public class ResourceController {

    private final ResourceRepository resourceRepository;
    private final AppUserRepository appUserRepository;

    public ResourceController(ResourceRepository resourceRepository,
                              AppUserRepository appUserRepository) {
        this.resourceRepository = resourceRepository;
        this.appUserRepository = appUserRepository;
    }

@GetMapping
public List<ResourceEntity> getAllResources(Authentication authentication) {
    AppUser currentUser = getCurrentUser(authentication);

    return switch (currentUser.getRole()) {
       case "ADMIN", "EXECUTIVE_VIEWER" -> resourceRepository.findAll();

        case "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL" ->
                getResourcesByUserCountry(currentUser);

        case "TEAM_MEMBER" ->
                List.of();

        default ->
                List.of();
    };
}

    @GetMapping("/{id}")
    public ResourceEntity getResourceById(@PathVariable Long id) {
        return resourceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Resource not found"));
    }

    @PostMapping
    public ResourceEntity createResource(@RequestBody ResourceRequest request) {
        ResourceEntity resource = new ResourceEntity();
        mapRequestToResource(request, resource);
        return resourceRepository.save(resource);
    }

    @PutMapping("/{id}")
    public ResourceEntity updateResource(@PathVariable Long id,
                                         @RequestBody ResourceRequest request) {
        ResourceEntity resource = resourceRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Resource not found"));

        mapRequestToResource(request, resource);

        return resourceRepository.save(resource);
    }

    @DeleteMapping("/{id}")
    public void deleteResource(@PathVariable Long id) {
        resourceRepository.deleteById(id);
    }

   private void mapRequestToResource(ResourceRequest request,
                                  ResourceEntity resource) {
    resource.setResourceName(request.getResourceName());
    resource.setDesignation(request.getDesignation());
    resource.setDepartment(request.getDepartment());
    resource.setSkill(request.getSkill());
    resource.setMonthlySalary(request.getMonthlySalary());
    resource.setStatus(request.getStatus());
    resource.setLocation(request.getLocation());

    Long appUserId = request.getAppUserId();

    AppUser appUser = null;

    if (appUserId != null && appUserId > 0) {
        appUser = appUserRepository.findById(appUserId)
                .orElseThrow(() -> new RuntimeException("App user not found"));

        if ("ADMIN".equals(appUser.getRole())) {
        throw new RuntimeException("System admin login cannot be mapped as a project resource");
    }

        validateAppUserNotAlreadyLinked(appUserId, resource.getId());

        resource.setAppUser(appUser);
    } else {
        resource.setAppUser(null);
    }

    String requestedCountry = normalizeCountry(request.getCountry());

    /*
     * Country rule:
     * 1. If UI gives country, use it.
     * 2. If UI country is empty and login is linked, derive from AppUser country.
     * 3. If both are present and different, reject.
     * 4. If no login is linked, country is mandatory.
     */
    if (requestedCountry != null) {
        if (appUser != null
                && appUser.getCountry() != null
                && !requestedCountry.equals(appUser.getCountry())) {
            throw new RuntimeException("Resource country and linked login country do not match");
        }

        resource.setCountry(requestedCountry);
        return;
    }

    if (appUser != null && appUser.getCountry() != null && !appUser.getCountry().isBlank()) {
        resource.setCountry(appUser.getCountry());
        return;
    }

    throw new RuntimeException("Country is required when no login account is linked");
}

    private AppUser getCurrentUser(Authentication authentication) {
    if (authentication == null || authentication.getName() == null) {
        throw new RuntimeException("User is not logged in");
    }

    return appUserRepository.findByUsername(authentication.getName())
            .orElseThrow(() -> new RuntimeException("Logged-in user not found"));
}

private List<ResourceEntity> getResourcesByUserCountry(AppUser currentUser) {
    if (currentUser.getCountry() == null || currentUser.getCountry().isBlank()) {
        return List.of();
    }

    return resourceRepository.findByCountry(currentUser.getCountry());
}

private void validateAppUserNotAlreadyLinked(Long appUserId, Long currentResourceId) {
    if (currentResourceId == null) {
        resourceRepository.findByAppUserId(appUserId)
                .ifPresent(existingResource -> {
                    throw new RuntimeException("This login is already linked to another resource");
                });

        return;
    }

    resourceRepository.findByAppUserIdAndIdNot(appUserId, currentResourceId)
            .ifPresent(existingResource -> {
                throw new RuntimeException("This login is already linked to another resource");
            });
}

private String normalizeCountry(String country) {
    if (country == null || country.isBlank()) {
        return null;
    }

    return country.trim().toUpperCase();
}

}