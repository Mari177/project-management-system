package com.company.pms.project;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {

    long countByStatus(String status);

    List<Project> findByCountry(String country);

    List<Project> findByDeliveryHeadUserId(Long deliveryHeadUserId);

    List<Project> findByDeliveryManagerUserId(Long deliveryManagerUserId);

    List<Project> findByTlUserId(Long tlUserId);

    Optional<Project> findTopByProjectCodeStartingWithOrderByProjectCodeDesc(String prefix);

    boolean existsByProjectCode(String projectCode);

    List<Project> findByClientIdOrderByIdDesc(Long clientId);

    List<Project> findByProjectTypeOrderByIdDesc(String projectType);

    List<Project> findByLinkedImplementationProjectIdOrderByIdDesc(Long linkedImplementationProjectId);

    boolean existsByLinkedImplementationProjectIdAndProjectType(Long linkedImplementationProjectId, String projectType);
}
