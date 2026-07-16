package com.company.pms.resource;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface ResourceRepository extends JpaRepository<ResourceEntity, Long>, JpaSpecificationExecutor<ResourceEntity> {

    Optional<ResourceEntity> findByAppUserId(Long appUserId);

    Optional<ResourceEntity> findByAppUserIdAndIdNot(Long appUserId, Long id);

    List<ResourceEntity> findByCountry(String country);

    List<ResourceEntity> findByCountryAndStatus(String country, String status);

    long countByStatusIgnoreCase(String status);
}
