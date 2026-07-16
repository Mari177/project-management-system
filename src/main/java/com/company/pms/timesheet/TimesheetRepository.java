package com.company.pms.timesheet;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TimesheetRepository extends JpaRepository<Timesheet, Long> {

    List<Timesheet> findAllByOrderByPeriodStartDesc();

    Optional<Timesheet> findByResourceIdAndPeriodStartAndPeriodEnd(Long resourceId,
                                                                   LocalDate periodStart,
                                                                   LocalDate periodEnd);

    List<Timesheet> findByResourceAppUserIdOrderByPeriodStartDesc(Long appUserId);

    List<Timesheet> findByResourceAppUserManagerUserIdOrderByPeriodStartDesc(Long managerUserId);

    List<Timesheet> findByResourceIdOrderByPeriodStartDesc(Long resourceId);

    List<Timesheet> findByStatusOrderByPeriodStartDesc(String status);

    @Query("""
            select distinct ts
            from Timesheet ts
            join TaskEntity task on task.assignedResource.id = ts.resource.id
            where task.project.tlUser.id = :tlUserId
            order by ts.periodStart desc
            """)
    List<Timesheet> findDistinctByProjectTlUserId(@Param("tlUserId") Long tlUserId);

    @Query("""
            select distinct ts
            from Timesheet ts
            join TaskEntity task on task.assignedResource.id = ts.resource.id
            where task.project.deliveryManagerUser.id = :deliveryManagerUserId
            order by ts.periodStart desc
            """)
    List<Timesheet> findDistinctByProjectDeliveryManagerUserId(@Param("deliveryManagerUserId") Long deliveryManagerUserId);

    @Query("""
            select distinct ts
            from Timesheet ts
            join TaskEntity task on task.assignedResource.id = ts.resource.id
            where task.project.deliveryHeadUser.id = :deliveryHeadUserId
            order by ts.periodStart desc
            """)
    List<Timesheet> findDistinctByProjectDeliveryHeadUserId(@Param("deliveryHeadUserId") Long deliveryHeadUserId);

    @Query("""
            select distinct ts
            from Timesheet ts
            join TaskEntity task on task.assignedResource.id = ts.resource.id
            where task.project.country = :country
            order by ts.periodStart desc
            """)
    List<Timesheet> findDistinctByProjectCountry(@Param("country") String country);

    @Query("""
            select distinct ts
            from Timesheet ts
            join TaskEntity task on task.assignedResource.id = ts.resource.id
            where task.project.tlUser.id = :tlUserId
              and ts.status = :status
            order by ts.periodStart desc
            """)
    List<Timesheet> findPendingByProjectTlUserId(@Param("tlUserId") Long tlUserId,
                                                 @Param("status") String status);

    @Query("""
            select distinct ts
            from Timesheet ts
            join TimeLog log on log.timesheet.id = ts.id
            where log.project.tlUser.id = :tlUserId
            order by ts.periodStart desc
            """)
    List<Timesheet> findDistinctVisibleByProjectTlUserId(@Param("tlUserId") Long tlUserId);

    @Query("""
            select distinct ts
            from Timesheet ts
            join TimeLog log on log.timesheet.id = ts.id
            where log.project.deliveryManagerUser.id = :deliveryManagerUserId
            order by ts.periodStart desc
            """)
    List<Timesheet> findDistinctVisibleByProjectDeliveryManagerUserId(
            @Param("deliveryManagerUserId") Long deliveryManagerUserId);

    @Query("""
            select distinct ts
            from Timesheet ts
            join TimeLog log on log.timesheet.id = ts.id
            where log.project.deliveryHeadUser.id = :deliveryHeadUserId
            order by ts.periodStart desc
            """)
    List<Timesheet> findDistinctVisibleByProjectDeliveryHeadUserId(
            @Param("deliveryHeadUserId") Long deliveryHeadUserId);

    @Query("""
            select distinct ts
            from Timesheet ts
            join TimeLog log on log.timesheet.id = ts.id
            where log.project.country = :country
            order by ts.periodStart desc
            """)
    List<Timesheet> findDistinctVisibleByProjectCountry(@Param("country") String country);
}