package com.company.pms.task;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<TaskEntity, Long> {

    List<TaskEntity> findByProjectId(Long projectId);

    List<TaskEntity> findByMilestoneId(Long milestoneId);

    List<TaskEntity> findByAssignedResourceId(Long resourceId);

    long countByStatus(String status);

    List<TaskEntity> findByProjectDeliveryHeadUserId(Long deliveryHeadUserId);

    List<TaskEntity> findByProjectCountry(String country);

    List<TaskEntity> findByProjectDeliveryManagerUserId(Long deliveryManagerUserId);

    List<TaskEntity> findByProjectTlUserId(Long tlUserId);

    List<TaskEntity> findByAssignedResourceAppUserId(Long appUserId);

    Optional<TaskEntity> findTopByTaskCodeStartingWithOrderByTaskCodeDesc(String prefix);

    boolean existsByTaskCode(String taskCode);

    List<TaskEntity> findByProjectClientIdOrderByIdDesc(Long clientId);
}