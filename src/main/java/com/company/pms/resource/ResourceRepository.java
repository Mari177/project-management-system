package com.company.pms.resource;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ResourceRepository extends JpaRepository<ResourceEntity, Long> {

    Optional<ResourceEntity> findByAppUserId(Long appUserId);

    Optional<ResourceEntity> findByAppUserIdAndIdNot(Long appUserId, Long id);

    List<ResourceEntity> findByCountry(String country);

    List<ResourceEntity> findByCountryAndStatus(String country, String status);
}