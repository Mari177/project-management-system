package com.company.pms.timesheet;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;

public interface TimeLogRepository extends JpaRepository<TimeLog, Long> {

    List<TimeLog> findByTimesheetIdOrderByLogDateAsc(Long timesheetId);

    long countByTimesheetId(Long timesheetId);

    @Query("""
            select tl.timesheet.id, count(tl.id)
            from TimeLog tl
            where tl.timesheet.id in :timesheetIds
            group by tl.timesheet.id
            """)
    List<Object[]> countByTimesheetIds(@Param("timesheetIds") List<Long> timesheetIds);

    List<TimeLog> findByTaskId(Long taskId);

    List<TimeLog> findByTaskIdAndStatus(Long taskId, String status);

    List<TimeLog> findByResourceIdAndLogDate(Long resourceId, LocalDate logDate);

    @Query("""
            select coalesce(sum(tl.hours), 0)
            from TimeLog tl
            where tl.resource.id = :resourceId
              and tl.logDate = :logDate
              and tl.status <> 'REJECTED'
            """)
    Double sumHoursForResourceOnDate(@Param("resourceId") Long resourceId,
                                     @Param("logDate") LocalDate logDate);

    @Query("""
            select coalesce(sum(tl.hours), 0)
            from TimeLog tl
            where tl.resource.id = :resourceId
              and tl.logDate = :logDate
              and tl.status <> 'REJECTED'
              and tl.id <> :excludeLogId
            """)
    Double sumHoursForResourceOnDateExcludingLog(@Param("resourceId") Long resourceId,
                                                 @Param("logDate") LocalDate logDate,
                                                 @Param("excludeLogId") Long excludeLogId);

    @Query("""
            select coalesce(sum(tl.hours), 0)
            from TimeLog tl
            where tl.task.id = :taskId
              and tl.status = :status
            """)
    Double sumHoursByTaskAndStatus(@Param("taskId") Long taskId,
                                   @Param("status") String status);

    @Query("""
            select coalesce(sum(tl.hours), 0)
            from TimeLog tl
            where tl.task.id = :taskId
              and tl.status <> 'REJECTED'
            """)
    Double sumNonRejectedHoursByTask(@Param("taskId") Long taskId);

    @Query("""
        select coalesce(sum(tl.hours), 0)
        from TimeLog tl
        where tl.task.id = :taskId
          and tl.status = 'APPROVED'
        """)
Double sumApprovedHoursByTaskId(@Param("taskId") Long taskId);

@Query("""
        select coalesce(sum(tl.hours), 0)
        from TimeLog tl
        where tl.project.id = :projectId
          and tl.status = 'APPROVED'
        """)
Double sumApprovedHoursByProjectId(@Param("projectId") Long projectId);
}
