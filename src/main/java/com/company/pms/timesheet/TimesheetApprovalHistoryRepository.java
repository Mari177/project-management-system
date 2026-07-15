package com.company.pms.timesheet;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TimesheetApprovalHistoryRepository extends JpaRepository<TimesheetApprovalHistory, Long> {

    List<TimesheetApprovalHistory> findByTimesheetIdOrderByActionAtAsc(Long timesheetId);
}
