package com.company.pms.timesheet;

import com.company.pms.auth.AppUser;
import com.company.pms.milestone.Milestone;
import com.company.pms.project.Project;
import com.company.pms.resource.ResourceEntity;
import com.company.pms.resource.ResourceRepository;
import com.company.pms.task.TaskEntity;
import com.company.pms.task.TaskRepository;
import com.company.pms.projectmember.ProjectMember;
import com.company.pms.projectmember.ProjectMemberRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
public class TimesheetService {

    private static final double WORKING_DAYS_PER_MONTH = 22.0;
    private static final double HOURS_PER_DAY = 8.0;
    private static final double INR_PER_USD = 83.0;
    private static final double MAX_HOURS_PER_DAY = 12.0;

    private final TimesheetRepository timesheetRepository;
    private final TimeLogRepository timeLogRepository;
    private final TimesheetApprovalHistoryRepository approvalHistoryRepository;
    private final TaskRepository taskRepository;
    private final ResourceRepository resourceRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public TimesheetService(TimesheetRepository timesheetRepository,
            TimeLogRepository timeLogRepository,
            TimesheetApprovalHistoryRepository approvalHistoryRepository,
            TaskRepository taskRepository,
            ResourceRepository resourceRepository, ProjectMemberRepository projectMemberRepository) {
        this.timesheetRepository = timesheetRepository;
        this.timeLogRepository = timeLogRepository;
        this.approvalHistoryRepository = approvalHistoryRepository;
        this.taskRepository = taskRepository;
        this.resourceRepository = resourceRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    public List<TimesheetDto> getTimesheetsForUser(AppUser currentUser) {
        /*
         * This endpoint means: my own timesheets.
         * Approval list is handled separately by getPendingApprovals().
         */
        List<Timesheet> timesheets = timesheetRepository
                .findByResourceAppUserIdOrderByPeriodStartDesc(currentUser.getId());

        return timesheets.stream()
                .map(this::mapToTimesheetDto)
                .collect(Collectors.toList());
    }

    public List<TimesheetDto> getVisibleTimesheets(AppUser currentUser) {
        if (currentUser == null) {
            throw new RuntimeException("User is not logged in");
        }

        if ("ADMIN".equals(currentUser.getRole())) {
            return timesheetRepository.findAllByOrderByPeriodStartDesc()
                    .stream()
                    .map(this::mapToTimesheetDto)
                    .collect(Collectors.toList());
        }

        Map<Long, Timesheet> visibleTimesheets = new LinkedHashMap<>();

        addTimesheets(
                visibleTimesheets,
                timesheetRepository.findByResourceAppUserIdOrderByPeriodStartDesc(currentUser.getId()));

        addTimesheets(
                visibleTimesheets,
                timesheetRepository.findByResourceAppUserManagerUserIdOrderByPeriodStartDesc(currentUser.getId()));

        switch (currentUser.getRole()) {
            case "DELIVERY_HEAD" -> {
                addTimesheets(
                        visibleTimesheets,
                        timesheetRepository.findDistinctVisibleByProjectDeliveryHeadUserId(currentUser.getId()));

                if (currentUser.getCountry() != null && !currentUser.getCountry().isBlank()) {
                    addTimesheets(
                            visibleTimesheets,
                            timesheetRepository.findDistinctVisibleByProjectCountry(currentUser.getCountry()));
                }
            }
            case "DELIVERY_MANAGER" -> addTimesheets(
                    visibleTimesheets,
                    timesheetRepository.findDistinctVisibleByProjectDeliveryManagerUserId(currentUser.getId()));
            case "TL" -> addTimesheets(
                    visibleTimesheets,
                    timesheetRepository.findDistinctVisibleByProjectTlUserId(currentUser.getId()));
            default -> {
                // TEAM_MEMBER receives only own timesheets from the first query.
            }
        }

        return visibleTimesheets.values()
                .stream()
                .sorted(Comparator.comparing(
                        Timesheet::getPeriodStart,
                        Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::mapToTimesheetDto)
                .collect(Collectors.toList());
    }

    private void addTimesheets(Map<Long, Timesheet> target, List<Timesheet> source) {
        if (source == null) {
            return;
        }

        source.forEach(timesheet -> {
            if (timesheet != null && timesheet.getId() != null) {
                target.putIfAbsent(timesheet.getId(), timesheet);
            }
        });
    }

    public List<TimesheetDto> getPendingApprovals(AppUser currentUser) {
        List<Timesheet> pendingTimesheets = timesheetRepository.findByStatusOrderByPeriodStartDesc("PENDING_APPROVAL");

        return pendingTimesheets.stream()
                .filter(timesheet -> canApproveTimesheetInternal(currentUser, timesheet))
                .map(this::mapToTimesheetDto)
                .collect(Collectors.toList());
    }

    public TimesheetDto getTimesheetById(Long id, AppUser currentUser) {
        Timesheet timesheet = getTimesheetEntity(id);
        validateCanViewTimesheet(currentUser, timesheet);
        return mapToTimesheetDto(timesheet);
    }

    @Transactional
    public TimesheetDto createTimesheet(TimesheetRequest request, AppUser currentUser) {
        validateTimesheetRequest(request);

        ResourceEntity resource = resolveTimesheetResource(request.getResourceId(), currentUser);

        if (!canCreateTimesheetForResource(currentUser, resource)) {
            throw new RuntimeException("You do not have permission to create timesheet for this resource");
        }

        timesheetRepository.findByResourceIdAndPeriodStartAndPeriodEnd(
                resource.getId(),
                request.getPeriodStart(),
                request.getPeriodEnd()).ifPresent(existing -> {
                    throw new RuntimeException("Timesheet already exists for this resource and period");
                });

        Timesheet timesheet = new Timesheet();
        timesheet.setResource(resource);
        timesheet.setSubmittedByUser(currentUser);
        timesheet.setPeriodStart(request.getPeriodStart());
        timesheet.setPeriodEnd(request.getPeriodEnd());
        timesheet.setStatus("DRAFT");
        timesheet.setTotalHours(0.0);
        timesheet.setBillableHours(0.0);
        timesheet.setNonBillableHours(0.0);

        Timesheet saved = timesheetRepository.save(timesheet);
        return mapToTimesheetDto(saved);
    }

    @Transactional
    public TimeLogDto createTimeLog(TimeLogRequest request, AppUser currentUser) {
        validateTimeLogRequest(request);

        Timesheet timesheet = getTimesheetEntity(request.getTimesheetId());
        ensureTimesheetEditable(timesheet);

        TaskEntity task = taskRepository.findById(request.getTaskId())
                .orElseThrow(() -> new RuntimeException("Task not found"));

        validateTaskHasRequiredMappings(task);

        ResourceEntity taskResource = task.getAssignedResource();

        if (!timesheet.getResource().getId().equals(taskResource.getId())) {
            throw new RuntimeException("Timesheet resource and task assigned resource do not match");
        }

        String normalizedBillingType = normalizeBillingType(request.getBillingType());

        validateCanLogTime(currentUser, task, taskResource);
        validateLogDateWithinTimesheet(request.getLogDate(), timesheet);
        validateTimeLogAgainstTaskAndProjectMember(
                task,
                taskResource,
                request.getLogDate(),
                normalizedBillingType);
        validateDailyHours(taskResource.getId(), request.getLogDate(), request.getHours(), null);

        TimeLog timeLog = new TimeLog();
        timeLog.setTimesheet(timesheet);
        timeLog.setProject(task.getProject());
        timeLog.setMilestone(task.getMilestone());
        timeLog.setTask(task);
        timeLog.setResource(taskResource);
        timeLog.setLoggedByUser(currentUser);
        timeLog.setLogDate(request.getLogDate());
        timeLog.setHours(roundToTwoDecimals(request.getHours()));
        timeLog.setBillingType(normalizedBillingType);
        timeLog.setWorkDescription(request.getWorkDescription().trim());
        timeLog.setStatus("DRAFT");

        TimeLog saved = timeLogRepository.save(timeLog);
        saved.setOverrun(isTaskOverrun(task.getId()));
        saved = timeLogRepository.save(saved);

        moveTimesheetBackToDraftIfNeeded(timesheet);
        recalculateTimesheetTotals(timesheet.getId());

        return mapToTimeLogDto(saved);
    }

    @Transactional
    public TimeLogDto updateTimeLog(Long id, TimeLogRequest request, AppUser currentUser) {
        TimeLog timeLog = timeLogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Time log not found"));

        Timesheet timesheet = timeLog.getTimesheet();
        ensureTimesheetEditable(timesheet);

        TaskEntity task = timeLog.getTask();

        if (request.getTaskId() != null && (task == null || !request.getTaskId().equals(task.getId()))) {
            task = taskRepository.findById(request.getTaskId())
                    .orElseThrow(() -> new RuntimeException("Task not found"));
        }

        validateTaskHasRequiredMappings(task);

        ResourceEntity taskResource = task.getAssignedResource();

        if (!timesheet.getResource().getId().equals(taskResource.getId())) {
            throw new RuntimeException("Timesheet resource and task assigned resource do not match");
        }

        validateCanLogTime(currentUser, task, taskResource);

        LocalDate logDate = request.getLogDate() != null
                ? request.getLogDate()
                : timeLog.getLogDate();

        Double hours = request.getHours() != null
                ? request.getHours()
                : timeLog.getHours();

        String billingType = request.getBillingType() != null && !request.getBillingType().isBlank()
                ? normalizeBillingType(request.getBillingType())
                : timeLog.getBillingType();

        validateHours(hours);
        validateLogDate(logDate);
        validateLogDateWithinTimesheet(logDate, timesheet);
        validateTimeLogAgainstTaskAndProjectMember(task, taskResource, logDate, billingType);
        validateDailyHours(taskResource.getId(), logDate, hours, timeLog.getId());

        timeLog.setTask(task);
        timeLog.setProject(task.getProject());
        timeLog.setMilestone(task.getMilestone());
        timeLog.setResource(taskResource);
        timeLog.setLogDate(logDate);
        timeLog.setHours(roundToTwoDecimals(hours));
        timeLog.setBillingType(billingType);

        if (request.getWorkDescription() != null && !request.getWorkDescription().isBlank()) {
            timeLog.setWorkDescription(request.getWorkDescription().trim());
        }

        timeLog.setStatus("DRAFT");
        timeLog.setOverrun(isTaskOverrun(task.getId()));

        TimeLog saved = timeLogRepository.save(timeLog);

        moveTimesheetBackToDraftIfNeeded(timesheet);
        recalculateTimesheetTotals(timesheet.getId());

        return mapToTimeLogDto(saved);
    }

    @Transactional
    public void deleteTimeLog(Long id, AppUser currentUser) {
        TimeLog timeLog = timeLogRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Time log not found"));

        Timesheet timesheet = timeLog.getTimesheet();
        ensureTimesheetEditable(timesheet);
        validateCanLogTime(currentUser, timeLog.getTask(), timeLog.getResource());

        Long timesheetId = timesheet.getId();
        timeLogRepository.delete(timeLog);
        recalculateTimesheetTotals(timesheetId);
    }

    @Transactional
    public TimesheetDto submitTimesheet(Long id, AppUser currentUser) {
        Timesheet timesheet = getTimesheetEntity(id);
        validateCanSubmitTimesheet(currentUser, timesheet);

        if (!List.of("DRAFT", "REJECTED", "RECALLED").contains(timesheet.getStatus())) {
            throw new RuntimeException("Only draft, rejected or recalled timesheets can be submitted");
        }

        List<TimeLog> logs = timeLogRepository.findByTimesheetIdOrderByLogDateAsc(id);

        if (logs.isEmpty()) {
            throw new RuntimeException("Cannot submit timesheet without time logs");
        }

        for (TimeLog log : logs) {
            validateSavedTimeLogBeforeSubmission(log);
        }

        for (TimeLog log : logs) {
            log.setStatus("PENDING_APPROVAL");
            timeLogRepository.save(log);
        }

        timesheet.setStatus("PENDING_APPROVAL");
        timesheet.setSubmittedAt(LocalDateTime.now());
        timesheet.setSubmittedByUser(currentUser);
        timesheet.setRejectedAt(null);
        timesheet.setRejectedByUser(null);
        timesheet.setRejectionReason(null);
        timesheet.setApprovedAt(null);
        timesheet.setApprovedByUser(null);

        Timesheet saved = timesheetRepository.save(timesheet);
        saveHistory(saved, "SUBMITTED", currentUser, "Timesheet submitted for approval");

        return mapToTimesheetDto(saved);
    }

    @Transactional
    public TimesheetDto approveTimesheet(Long id, TimesheetActionRequest request, AppUser currentUser) {
        Timesheet timesheet = getTimesheetEntity(id);
        validateCanApproveTimesheet(currentUser, timesheet);

        if (!"PENDING_APPROVAL".equals(timesheet.getStatus())) {
            throw new RuntimeException("Only pending timesheets can be approved");
        }

        List<TimeLog> logs = validatePendingTimesheetLogs(timesheet);

        for (TimeLog log : logs) {
            log.setStatus("APPROVED");
            timeLogRepository.save(log);
        }

        timesheet.setStatus("APPROVED");
        timesheet.setApprovedAt(LocalDateTime.now());
        timesheet.setApprovedByUser(currentUser);
        timesheet.setRejectedAt(null);
        timesheet.setRejectedByUser(null);
        timesheet.setRejectionReason(null);

        Timesheet saved = timesheetRepository.save(timesheet);
        saveHistory(saved, "APPROVED", currentUser, request != null ? request.getComments() : null);

        return mapToTimesheetDto(saved);
    }

    @Transactional
    public TimesheetDto rejectTimesheet(Long id, TimesheetActionRequest request, AppUser currentUser) {
        Timesheet timesheet = getTimesheetEntity(id);
        validateCanApproveTimesheet(currentUser, timesheet);

        if (!"PENDING_APPROVAL".equals(timesheet.getStatus())) {
            throw new RuntimeException("Only pending timesheets can be rejected");
        }

        String rejectionReason = request != null ? request.getRejectionReason() : null;

        if (rejectionReason == null || rejectionReason.isBlank()) {
            throw new RuntimeException("Rejection reason is required");
        }
        List<TimeLog> logs = validatePendingTimesheetLogs(timesheet);

        for (TimeLog log : logs) {
            log.setStatus("REJECTED");
            timeLogRepository.save(log);
        }

        timesheet.setStatus("REJECTED");
        timesheet.setRejectedAt(LocalDateTime.now());
        timesheet.setRejectedByUser(currentUser);
        timesheet.setRejectionReason(rejectionReason.trim());
        timesheet.setApprovedAt(null);
        timesheet.setApprovedByUser(null);

        Timesheet saved = timesheetRepository.save(timesheet);
        saveHistory(saved, "REJECTED", currentUser, rejectionReason.trim());

        return mapToTimesheetDto(saved);
    }

    @Transactional
    public TimesheetDto recallTimesheet(Long id, AppUser currentUser) {
        Timesheet timesheet = getTimesheetEntity(id);
        validateCanSubmitTimesheet(currentUser, timesheet);

        if (!"PENDING_APPROVAL".equals(timesheet.getStatus())) {
            throw new RuntimeException("Only pending timesheets can be recalled");
        }

        List<TimeLog> logs = timeLogRepository.findByTimesheetIdOrderByLogDateAsc(id);

        for (TimeLog log : logs) {
            log.setStatus("DRAFT");
            timeLogRepository.save(log);
        }

        timesheet.setStatus("RECALLED");
        Timesheet saved = timesheetRepository.save(timesheet);
        saveHistory(saved, "RECALLED", currentUser, "Timesheet recalled for correction");

        return mapToTimesheetDto(saved);
    }

    public TimeSummaryDto getTaskTimeSummary(
        Long taskId,
        AppUser currentUser) {

    TaskEntity task = taskRepository.findById(taskId)
            .orElseThrow(() -> new RuntimeException("Task not found"));

    validateCanViewTaskTimeSummary(currentUser, task);

    double allocatedHours = getAllocatedHours(task);

    double draftHours = safeDouble(
            timeLogRepository.sumHoursByTaskAndStatus(
                    taskId,
                    "DRAFT"
            )
    );

    double pendingHours = safeDouble(
            timeLogRepository.sumHoursByTaskAndStatus(
                    taskId,
                    "PENDING_APPROVAL"
            )
    );

    double approvedHours = safeDouble(
            timeLogRepository.sumHoursByTaskAndStatus(
                    taskId,
                    "APPROVED"
            )
    );

    double rejectedHours = safeDouble(
            timeLogRepository.sumHoursByTaskAndStatus(
                    taskId,
                    "REJECTED"
            )
    );

    double remainingHours = Math.max(
            allocatedHours - approvedHours,
            0.0
    );

    double overrunHours = Math.max(
            approvedHours - allocatedHours,
            0.0
    );

    ResourceEntity assignedResource = task.getAssignedResource();

    double hourlyCostUsd = calculateResourceHourlyCostUsd(
            assignedResource
    );

    double plannedCost = roundToTwoDecimals(
            allocatedHours * hourlyCostUsd
    );

    double actualCost = roundToTwoDecimals(
            approvedHours * hourlyCostUsd
    );

    double costVariance = roundToTwoDecimals(
            actualCost - plannedCost
    );

    Long resourceId = assignedResource != null
            ? assignedResource.getId()
            : null;

    String resourceName = assignedResource != null
            ? assignedResource.getResourceName()
            : "N/A";

    String reportingManagerName = assignedResource != null
            ? assignedResource.getReportingManagerName()
            : null;

    String reportingManagerDesignation = assignedResource != null
            ? assignedResource.getReportingManagerDesignation()
            : null;

    return new TimeSummaryDto(
            task.getId(),
            task.getTaskName(),
            resourceId,
            resourceName,
            reportingManagerName,
            reportingManagerDesignation,
            roundToTwoDecimals(allocatedHours),
            roundToTwoDecimals(draftHours),
            roundToTwoDecimals(pendingHours),
            roundToTwoDecimals(approvedHours),
            roundToTwoDecimals(rejectedHours),
            roundToTwoDecimals(remainingHours),
            roundToTwoDecimals(overrunHours),
            plannedCost,
            actualCost,
            costVariance
    );
}

    private Timesheet getTimesheetEntity(Long id) {
        if (id == null) {
            throw new RuntimeException("Timesheet id is required");
        }

        return timesheetRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Timesheet not found"));
    }

    private List<Timesheet> getDeliveryHeadTimesheets(AppUser currentUser) {
        List<Timesheet> mapped = timesheetRepository.findDistinctByProjectDeliveryHeadUserId(currentUser.getId());

        if (!mapped.isEmpty()) {
            return mapped;
        }

        if (currentUser.getCountry() != null && !currentUser.getCountry().isBlank()) {
            return timesheetRepository.findDistinctByProjectCountry(currentUser.getCountry());
        }

        return List.of();
    }

    private void validateTimesheetRequest(TimesheetRequest request) {
        if (request == null) {
            throw new RuntimeException("Timesheet request is required");
        }

        if (request.getPeriodStart() == null || request.getPeriodEnd() == null) {
            throw new RuntimeException("Timesheet period start and end dates are required");
        }

        if (request.getPeriodEnd().isBefore(request.getPeriodStart())) {
            throw new RuntimeException("Timesheet period end date cannot be before start date");
        }
    }

    private ResourceEntity resolveTimesheetResource(Long requestedResourceId, AppUser currentUser) {
        if ("ADMIN".equals(currentUser.getRole())) {
            if (requestedResourceId == null) {
                throw new RuntimeException("Resource is required");
            }

            return resourceRepository.findById(requestedResourceId)
                    .orElseThrow(() -> new RuntimeException("Resource not found"));
        }

        ResourceEntity ownResource = resourceRepository.findByAppUserId(currentUser.getId())
                .orElseThrow(() -> new RuntimeException("No resource profile is linked to your login"));

        if (requestedResourceId != null && !ownResource.getId().equals(requestedResourceId)) {
            throw new RuntimeException("You can create timesheet only for your own resource profile");
        }

        return ownResource;
    }

    private void validateTimeLogRequest(TimeLogRequest request) {
        if (request == null) {
            throw new RuntimeException("Time log request is required");
        }

        if (request.getTimesheetId() == null) {
            throw new RuntimeException("Timesheet is required");
        }

        if (request.getTaskId() == null) {
            throw new RuntimeException("Task is required");
        }

        validateLogDate(request.getLogDate());
        validateHours(request.getHours());

        if (request.getWorkDescription() == null || request.getWorkDescription().isBlank()) {
            throw new RuntimeException("Work description is required");
        }
    }

    private void validateTaskHasRequiredMappings(TaskEntity task) {
        if (task.getProject() == null) {
            throw new RuntimeException("Task is not linked to any project");
        }

        if (task.getMilestone() == null) {
            throw new RuntimeException("Task is not linked to any milestone");
        }

        if (task.getAssignedResource() == null) {
            throw new RuntimeException("Task is not assigned to any resource");
        }
    }

    private void validateLogDate(LocalDate logDate) {
        if (logDate == null) {
            throw new RuntimeException("Log date is required");
        }

        if (logDate.isAfter(LocalDate.now())) {
            throw new RuntimeException("Future time logs are not allowed");
        }
    }

    private void validateHours(Double hours) {
        if (hours == null) {
            throw new RuntimeException("Hours are required");
        }

        if (hours <= 0) {
            throw new RuntimeException("Hours should be greater than zero");
        }

        if (hours > MAX_HOURS_PER_DAY) {
            throw new RuntimeException("Hours cannot exceed " + MAX_HOURS_PER_DAY + " hours per day");
        }
    }

    private void validateLogDateWithinTimesheet(LocalDate logDate, Timesheet timesheet) {
        if (logDate.isBefore(timesheet.getPeriodStart()) || logDate.isAfter(timesheet.getPeriodEnd())) {
            throw new RuntimeException("Log date should be within timesheet period");
        }
    }

    private void validateDailyHours(Long resourceId, LocalDate logDate, Double newHours, Long excludeLogId) {
        double existingHours = excludeLogId == null
                ? safeDouble(timeLogRepository.sumHoursForResourceOnDate(resourceId, logDate))
                : safeDouble(
                        timeLogRepository.sumHoursForResourceOnDateExcludingLog(resourceId, logDate, excludeLogId));

        if (existingHours + newHours > MAX_HOURS_PER_DAY) {
            throw new RuntimeException("Total logged hours for the day cannot exceed " + MAX_HOURS_PER_DAY);
        }
    }

    private void ensureTimesheetEditable(Timesheet timesheet) {
        if (!List.of("DRAFT", "REJECTED", "RECALLED").contains(timesheet.getStatus())) {
            throw new RuntimeException("Only draft, rejected or recalled timesheets can be edited");
        }
    }

    private void validateCanViewTimesheet(AppUser user, Timesheet timesheet) {
        if (!canViewTimesheetInternal(user, timesheet)) {
            throw new RuntimeException("You do not have permission to view this timesheet");
        }
    }

    private boolean canViewTimesheetInternal(AppUser user, Timesheet timesheet) {
        if (user == null || timesheet == null) {
            return false;
        }

        if ("ADMIN".equals(user.getRole())) {
            return true;
        }

        boolean ownTimesheet = timesheet.getResource() != null
                && timesheet.getResource().getAppUser() != null
                && timesheet.getResource().getAppUser().getId().equals(user.getId());

        if (ownTimesheet || isReportingManagerOfTimesheetOwner(user, timesheet)) {
            return true;
        }

        List<TimeLog> logs = timeLogRepository.findByTimesheetIdOrderByLogDateAsc(timesheet.getId());

        return logs.stream()
                .anyMatch(log -> canAccessProject(user, log.getProject()));
    }

    private boolean canCreateTimesheetForResource(AppUser user, ResourceEntity resource) {
        if (user == null || resource == null) {
            return false;
        }

        if ("ADMIN".equals(user.getRole())) {
            return true;
        }

        return resource.getAppUser() != null
                && resource.getAppUser().getId().equals(user.getId());
    }

    private void validateCanLogTime(AppUser user, TaskEntity task, ResourceEntity resource) {
        if ("ADMIN".equals(user.getRole())) {
            return;
        }

        boolean ownResource = resource.getAppUser() != null
                && resource.getAppUser().getId().equals(user.getId());

        if (!ownResource) {
            throw new RuntimeException("You can log time only for your own assigned tasks");
        }
    }

    private void validateCanSubmitTimesheet(AppUser user, Timesheet timesheet) {
        if ("ADMIN".equals(user.getRole())) {
            return;
        }

        boolean ownTimesheet = timesheet.getResource() != null
                && timesheet.getResource().getAppUser() != null
                && timesheet.getResource().getAppUser().getId().equals(user.getId());

        boolean createdByUser = timesheet.getSubmittedByUser() != null
                && timesheet.getSubmittedByUser().getId().equals(user.getId());

        if (!ownTimesheet && !createdByUser) {
            throw new RuntimeException("You can submit/recall only your own timesheet");
        }
    }

    private void validateCanApproveTimesheet(AppUser user, Timesheet timesheet) {
        if (!canApproveTimesheetInternal(user, timesheet)) {
            throw new RuntimeException("You do not have permission to approve or reject this timesheet");
        }
    }

    private void validateCanViewTaskTimeSummary(AppUser user, TaskEntity task) {
        if ("ADMIN".equals(user.getRole())) {
            return;
        }

        boolean ownTask = task.getAssignedResource() != null
                && task.getAssignedResource().getAppUser() != null
                && task.getAssignedResource().getAppUser().getId().equals(user.getId());

        if (ownTask) {
            return;
        }

        if (!canAccessProject(user, task.getProject())) {
            throw new RuntimeException("You do not have permission to view this task time summary");
        }
    }

    private void validateTimeLogAgainstTaskAndProjectMember(TaskEntity task,
            ResourceEntity resource,
            LocalDate logDate,
            String billingType) {
        validateTaskHasRequiredMappings(task);
        validateResourceIsActive(resource);
        validateLogDateWithinTaskDates(logDate, task);

        Project project = task.getProject();

        ProjectMember member = projectMemberRepository
                .findByProjectIdAndResourceId(project.getId(), resource.getId())
                .orElseThrow(() -> new RuntimeException(
                        "The task assignee is not allocated as a project member"));

        if (member.getActive() == null || !member.getActive()) {
            throw new RuntimeException("The task assignee is not an active project member");
        }

        validateLogDateWithinProjectMemberAllocation(logDate, member);

        if (Boolean.FALSE.equals(member.getBillable()) && "BILLABLE".equals(billingType)) {
            throw new RuntimeException("This project member is marked as non-billable for this project");
        }
    }

    private void validateSavedTimeLogBeforeSubmission(TimeLog log) {
        if (log.getTask() == null) {
            throw new RuntimeException("Timesheet has a time log without task");
        }

        if (log.getResource() == null) {
            throw new RuntimeException("Timesheet has a time log without resource");
        }

        if (log.getTimesheet() == null) {
            throw new RuntimeException("Time log is not linked to a timesheet");
        }

        if (!log.getTimesheet().getResource().getId().equals(log.getResource().getId())) {
            throw new RuntimeException("Timesheet resource and time log resource do not match");
        }

        if (log.getTask().getAssignedResource() == null
                || !log.getTask().getAssignedResource().getId().equals(log.getResource().getId())) {
            throw new RuntimeException("Time log task is not assigned to the timesheet resource");
        }

        validateTimeLogAgainstTaskAndProjectMember(
                log.getTask(),
                log.getResource(),
                log.getLogDate(),
                log.getBillingType());
    }

    private void validateResourceIsActive(ResourceEntity resource) {
        if (resource == null) {
            throw new RuntimeException("Resource is required");
        }

        if (resource.getStatus() != null && !"ACTIVE".equalsIgnoreCase(resource.getStatus())) {
            throw new RuntimeException("Inactive resource cannot log time");
        }
    }

    private void validateLogDateWithinTaskDates(LocalDate logDate, TaskEntity task) {
        if (logDate == null || task == null) {
            return;
        }

        if (task.getStartDate() != null && logDate.isBefore(task.getStartDate())) {
            throw new RuntimeException("Log date cannot be before task start date");
        }

        if (task.getEndDate() != null && logDate.isAfter(task.getEndDate())) {
            throw new RuntimeException("Log date cannot be after task end date");
        }
    }

    private void validateLogDateWithinProjectMemberAllocation(LocalDate logDate, ProjectMember member) {
        if (logDate == null || member == null) {
            return;
        }

        if (member.getStartDate() != null && logDate.isBefore(member.getStartDate())) {
            throw new RuntimeException("Log date cannot be before project member allocation start date");
        }

        if (member.getEndDate() != null && logDate.isAfter(member.getEndDate())) {
            throw new RuntimeException("Log date cannot be after project member allocation end date");
        }
    }

    private boolean canApproveTimesheetInternal(AppUser user, Timesheet timesheet) {
        if (user == null || timesheet == null) {
            return false;
        }

        if (!hasTimesheetApprovalRole(user)) {
            return false;
        }

        AppUser ownerUser = getTimesheetOwnerUser(timesheet);

        /*
         * If resource is not linked to a login, only Admin can approve.
         */
        if (ownerUser == null) {
            return "ADMIN".equals(user.getRole());
        }

        /*
         * Nobody should approve his own timesheet.
         */
        if (ownerUser.getId().equals(user.getId())) {
            return false;
        }

        /*
         * Admin override.
         */
        if ("ADMIN".equals(user.getRole())) {
            return true;
        }

        /*
         * Normal professional approval:
         * direct reporting manager approves.
         */
        return isReportingManagerOfTimesheetOwner(user, timesheet);
    }

    private boolean hasTimesheetApprovalRole(AppUser user) {
        if (user == null || user.getRole() == null) {
            return false;
        }

        return List.of(
                "ADMIN",
                "DELIVERY_HEAD",
                "DELIVERY_MANAGER",
                "TL").contains(user.getRole());
    }

    private AppUser getTimesheetOwnerUser(Timesheet timesheet) {
        if (timesheet == null
                || timesheet.getResource() == null
                || timesheet.getResource().getAppUser() == null) {
            return null;
        }

        return timesheet.getResource().getAppUser();
    }

    private boolean isReportingManagerOfTimesheetOwner(AppUser user, Timesheet timesheet) {
        AppUser ownerUser = getTimesheetOwnerUser(timesheet);

        if (user == null || ownerUser == null || ownerUser.getManagerUser() == null) {
            return false;
        }

        return ownerUser.getManagerUser().getId().equals(user.getId());
    }

    private List<TimeLog> validatePendingTimesheetLogs(Timesheet timesheet) {
        List<TimeLog> logs = timeLogRepository.findByTimesheetIdOrderByLogDateAsc(timesheet.getId());

        if (logs.isEmpty()) {
            throw new RuntimeException("Cannot approve or reject a timesheet without time logs");
        }

        boolean hasNonPendingLog = logs.stream()
                .anyMatch(log -> !"PENDING_APPROVAL".equals(log.getStatus()));

        if (hasNonPendingLog) {
            throw new RuntimeException(
                    "All time logs must be pending approval before approving or rejecting the timesheet");
        }

        return logs;
    }

    private boolean canAccessProject(AppUser user, Project project) {
        if (user == null || project == null) {
            return false;
        }

        if ("ADMIN".equals(user.getRole())) {
            return true;
        }

        if ("DELIVERY_HEAD".equals(user.getRole())) {
            boolean directlyMapped = project.getDeliveryHeadUser() != null
                    && project.getDeliveryHeadUser().getId().equals(user.getId());

            boolean sameCountry = user.getCountry() != null
                    && project.getCountry() != null
                    && user.getCountry().equals(project.getCountry());

            return directlyMapped || sameCountry;
        }

        if ("DELIVERY_MANAGER".equals(user.getRole())) {
            return project.getDeliveryManagerUser() != null
                    && project.getDeliveryManagerUser().getId().equals(user.getId());
        }

        if ("TL".equals(user.getRole())) {
            return project.getTlUser() != null
                    && project.getTlUser().getId().equals(user.getId());
        }

        return false;
    }

    private String normalizeBillingType(String billingType) {
        if (billingType == null || billingType.isBlank()) {
            return "BILLABLE";
        }

        String normalized = billingType.trim().toUpperCase();

        if (!List.of("BILLABLE", "NON_BILLABLE").contains(normalized)) {
            throw new RuntimeException("Billing type should be BILLABLE or NON_BILLABLE");
        }

        return normalized;
    }

    private boolean isTaskOverrun(Long taskId) {
        TaskEntity task = taskRepository.findById(taskId)
                .orElseThrow(() -> new RuntimeException("Task not found"));

        double allocatedHours = getAllocatedHours(task);

        if (allocatedHours <= 0) {
            return false;
        }

        double currentHours = safeDouble(timeLogRepository.sumNonRejectedHoursByTask(taskId));
        return currentHours > allocatedHours;
    }

    private void moveTimesheetBackToDraftIfNeeded(Timesheet timesheet) {
        if ("REJECTED".equals(timesheet.getStatus()) || "RECALLED".equals(timesheet.getStatus())) {
            timesheet.setStatus("DRAFT");
            timesheet.setRejectedAt(null);
            timesheet.setRejectedByUser(null);
            timesheet.setRejectionReason(null);
            timesheetRepository.save(timesheet);
        }
    }

    private void recalculateTimesheetTotals(Long timesheetId) {
        Timesheet timesheet = getTimesheetEntity(timesheetId);
        List<TimeLog> logs = timeLogRepository.findByTimesheetIdOrderByLogDateAsc(timesheetId).stream()
                .filter(log -> !"REJECTED".equals(log.getStatus()))
                .toList();

        double totalHours = logs.stream()
                .map(TimeLog::getHours)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .sum();

        double billableHours = logs.stream()
                .filter(log -> "BILLABLE".equals(log.getBillingType()))
                .map(TimeLog::getHours)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .sum();

        double nonBillableHours = logs.stream()
                .filter(log -> "NON_BILLABLE".equals(log.getBillingType()))
                .map(TimeLog::getHours)
                .filter(Objects::nonNull)
                .mapToDouble(Double::doubleValue)
                .sum();

        timesheet.setTotalHours(roundToTwoDecimals(totalHours));
        timesheet.setBillableHours(roundToTwoDecimals(billableHours));
        timesheet.setNonBillableHours(roundToTwoDecimals(nonBillableHours));
        timesheetRepository.save(timesheet);
    }

    private void saveHistory(Timesheet timesheet, String action, AppUser user, String comments) {
        TimesheetApprovalHistory history = new TimesheetApprovalHistory();
        history.setTimesheet(timesheet);
        history.setAction(action);
        history.setActionByUser(user);
        history.setComments(comments);
        approvalHistoryRepository.save(history);
    }

    private double getAllocatedHours(TaskEntity task) {
        return task.getAllocatedHours() != null ? task.getAllocatedHours() : 0.0;
    }

    private double calculateResourceHourlyCostUsd(ResourceEntity resource) {
        if (resource == null || resource.getMonthlySalary() == null) {
            return 0.0;
        }

        return resource.getMonthlySalary()
                / WORKING_DAYS_PER_MONTH
                / HOURS_PER_DAY
                / INR_PER_USD;
    }

    private double safeDouble(Double value) {
        return value != null ? value : 0.0;
    }

    private double roundToTwoDecimals(double value) {
        return BigDecimal.valueOf(value)
                .setScale(2, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private TimesheetDto mapToTimesheetDto(Timesheet timesheet) {
        List<TimeLogDto> logs = timeLogRepository.findByTimesheetIdOrderByLogDateAsc(timesheet.getId()).stream()
                .map(this::mapToTimeLogDto)
                .collect(Collectors.toList());

        Long resourceId = timesheet.getResource() != null ? timesheet.getResource().getId() : null;
        String resourceName = timesheet.getResource() != null ? timesheet.getResource().getResourceName() : "N/A";
        AppUser ownerUser = getTimesheetOwnerUser(timesheet);
        AppUser reportingManager = ownerUser != null ? ownerUser.getManagerUser() : null;
        Long reportingManagerUserId = reportingManager != null ? reportingManager.getId() : null;
        String reportingManagerName = reportingManager != null ? reportingManager.getName() : null;
        String reportingManagerDesignation = reportingManager != null ? reportingManager.getDesignation() : null;
        Long submittedByUserId = timesheet.getSubmittedByUser() != null ? timesheet.getSubmittedByUser().getId() : null;
        String submittedByName = timesheet.getSubmittedByUser() != null ? timesheet.getSubmittedByUser().getName()
                : "N/A";
        String approvedByName = timesheet.getApprovedByUser() != null ? timesheet.getApprovedByUser().getName() : null;
        String rejectedByName = timesheet.getRejectedByUser() != null ? timesheet.getRejectedByUser().getName() : null;

        return new TimesheetDto(
                timesheet.getId(),
                resourceId,
                resourceName,
                reportingManagerUserId,
                reportingManagerName,
                reportingManagerDesignation,
                submittedByUserId,
                submittedByName,
                timesheet.getPeriodStart(),
                timesheet.getPeriodEnd(),
                timesheet.getStatus(),
                timesheet.getTotalHours(),
                timesheet.getBillableHours(),
                timesheet.getNonBillableHours(),
                timesheet.getSubmittedAt(),
                timesheet.getApprovedAt(),
                timesheet.getRejectedAt(),
                approvedByName,
                rejectedByName,
                timesheet.getRejectionReason(),
                logs);
    }

    private TimeLogDto mapToTimeLogDto(TimeLog timeLog) {
        Long timesheetId = timeLog.getTimesheet() != null ? timeLog.getTimesheet().getId() : null;
        Project project = timeLog.getProject();
        Milestone milestone = timeLog.getMilestone();
        TaskEntity task = timeLog.getTask();
        ResourceEntity resource = timeLog.getResource();
        AppUser loggedBy = timeLog.getLoggedByUser();

        return new TimeLogDto(
                timeLog.getId(),
                timesheetId,
                project != null ? project.getId() : null,
                project != null ? project.getProjectCode() : null,
                project != null ? project.getProjectName() : "N/A",
                milestone != null ? milestone.getId() : null,
                milestone != null ? milestone.getMilestoneName() : "N/A",
                task != null ? task.getId() : null,
                task != null ? task.getTaskCode() : null,
                task != null ? task.getTaskName() : "N/A",
                resource != null ? resource.getId() : null,
                resource != null ? resource.getResourceName() : "N/A",
                loggedBy != null ? loggedBy.getId() : null,
                loggedBy != null ? loggedBy.getName() : "N/A",
                timeLog.getLogDate(),
                timeLog.getHours(),
                timeLog.getBillingType(),
                timeLog.getWorkDescription(),
                timeLog.getStatus(),
                timeLog.getOverrun());
    }

    private boolean resourceHasTaskInAccessibleProject(AppUser user, Long resourceId) {
        if (user == null || resourceId == null) {
            return false;
        }

        List<TaskEntity> tasks = taskRepository.findByAssignedResourceId(resourceId);

        return tasks.stream()
                .anyMatch(task -> task.getProject() != null && canAccessProject(user, task.getProject()));
    }
}