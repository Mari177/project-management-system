package com.company.pms.resource;

import com.company.pms.auth.AppUser;
import com.company.pms.auth.AppUserRepository;
import com.company.pms.common.PageResponse;
import com.company.pms.common.PaginationSupport;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/resources")
public class ResourceController {

    private static final Map<String, String> RESOURCE_SORTS = Map.of(
            "resourceName", "resourceName",
            "designation", "designation",
            "department", "department",
            "country", "country",
            "status", "status",
            "id", "id"
    );

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
            case "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL" -> getResourcesByUserCountry(currentUser);
            case "TEAM_MEMBER" -> List.of();
            default -> List.of();
        };
    }

    @GetMapping("/paged")
    public PageResponse<ResourceEntity> getResourcesPaged(
            Authentication authentication,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "25") Integer size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String country,
            @RequestParam(defaultValue = "resourceName") String sort,
            @RequestParam(defaultValue = "asc") String direction) {

        AppUser currentUser = getCurrentUser(authentication);

        Pageable pageable = PaginationSupport.pageable(
                page,
                size,
                25,
                100,
                sort,
                direction,
                RESOURCE_SORTS,
                "resourceName"
        );

        Specification<ResourceEntity> specification = buildPagedSpecification(
                currentUser,
                search,
                status,
                country
        );

        Page<ResourceEntity> result = resourceRepository.findAll(specification, pageable);
        return PageResponse.from(result);
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

    private Specification<ResourceEntity> buildPagedSpecification(
            AppUser currentUser,
            String search,
            String status,
            String country) {

        String normalizedSearch = PaginationSupport.normalized(search);
        String normalizedStatus = PaginationSupport.normalizedUpper(status);
        String normalizedCountry = PaginationSupport.normalizedUpper(country);

        return (root, query, criteriaBuilder) -> {
            query.distinct(true);
            List<Predicate> predicates = new ArrayList<>();

            switch (currentUser.getRole()) {
                case "ADMIN", "EXECUTIVE_VIEWER" -> {
                    // Organization-wide visibility.
                }
                case "DELIVERY_HEAD", "DELIVERY_MANAGER", "TL" -> {
                    if (currentUser.getCountry() == null || currentUser.getCountry().isBlank()) {
                        predicates.add(criteriaBuilder.disjunction());
                    } else {
                        predicates.add(criteriaBuilder.equal(
                                criteriaBuilder.upper(root.get("country")),
                                currentUser.getCountry().trim().toUpperCase()
                        ));
                    }
                }
                default -> predicates.add(criteriaBuilder.disjunction());
            }

            if (normalizedSearch != null) {
                var appUser = root.join("appUser", JoinType.LEFT);
                var manager = appUser.join("managerUser", JoinType.LEFT);
                String contains = "%" + normalizedSearch + "%";

                predicates.add(criteriaBuilder.or(
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("resourceName")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("designation")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("department")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("skill")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("country")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(root.get("location")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(appUser.get("name")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(appUser.get("username")), contains),
                        criteriaBuilder.like(criteriaBuilder.lower(manager.get("name")), contains)
                ));
            }

            if (normalizedStatus != null) {
                predicates.add(criteriaBuilder.equal(criteriaBuilder.upper(root.get("status")), normalizedStatus));
            }

            if (normalizedCountry != null) {
                predicates.add(criteriaBuilder.equal(criteriaBuilder.upper(root.get("country")), normalizedCountry));
            }

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
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
