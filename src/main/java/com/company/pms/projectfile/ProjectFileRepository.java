package com.company.pms.projectfile;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectFileRepository extends JpaRepository<ProjectFile, Long> {

    List<ProjectFile> findByProjectIdOrderByUploadedAtDesc(Long projectId);

    long countByProjectId(Long projectId);
}