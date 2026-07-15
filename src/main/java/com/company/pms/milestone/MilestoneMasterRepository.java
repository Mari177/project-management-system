package com.company.pms.milestone;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MilestoneMasterRepository extends JpaRepository<MilestoneMaster, Long> {

    List<MilestoneMaster> findByActiveTrueOrderByMilestoneOrderAsc();
}