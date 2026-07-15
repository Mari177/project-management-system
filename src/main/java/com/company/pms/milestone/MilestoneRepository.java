package com.company.pms.milestone;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MilestoneRepository extends JpaRepository<Milestone, Long> {

    List<Milestone> findByProjectIdOrderByMilestoneMasterMilestoneOrderAsc(Long projectId);

    List<Milestone> findByProjectId(Long projectId);

    boolean existsByProjectIdAndMilestoneMasterId(Long projectId, Long milestoneMasterId);

    long countByStatus(String status);
}