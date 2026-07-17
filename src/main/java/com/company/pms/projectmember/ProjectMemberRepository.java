package com.company.pms.projectmember;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;
import java.util.Optional;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long>, JpaSpecificationExecutor<ProjectMember> {

    List<ProjectMember> findByProjectIdOrderByIdAsc(Long projectId);

    List<ProjectMember> findByProjectIdAndActiveTrueOrderByIdAsc(Long projectId);

    List<ProjectMember> findByProjectIdInAndActiveTrue(List<Long> projectIds);

    List<ProjectMember> findByResourceIdOrderByIdAsc(Long resourceId);

    Optional<ProjectMember> findByProjectIdAndResourceId(Long projectId, Long resourceId);

    Optional<ProjectMember> findByProjectIdAndResourceIdAndIdNot(Long projectId, Long resourceId, Long id);

    boolean existsByProjectIdAndResourceId(Long projectId, Long resourceId);

    boolean existsByProjectIdAndActiveTrueAndResourceAppUserId(Long projectId, Long appUserId);
}
