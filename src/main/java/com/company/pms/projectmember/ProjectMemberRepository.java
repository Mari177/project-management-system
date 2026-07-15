package com.company.pms.projectmember;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {

    List<ProjectMember> findByProjectIdOrderByIdAsc(Long projectId);

    List<ProjectMember> findByProjectIdAndActiveTrueOrderByIdAsc(Long projectId);

    List<ProjectMember> findByResourceIdOrderByIdAsc(Long resourceId);

    Optional<ProjectMember> findByProjectIdAndResourceId(Long projectId, Long resourceId);

    Optional<ProjectMember> findByProjectIdAndResourceIdAndIdNot(Long projectId, Long resourceId, Long id);

    boolean existsByProjectIdAndResourceId(Long projectId, Long resourceId);
}
