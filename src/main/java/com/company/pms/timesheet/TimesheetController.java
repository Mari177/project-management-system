package com.company.pms.timesheet;

import com.company.pms.auth.AppUser;
import com.company.pms.auth.AppUserRepository;
import com.company.pms.common.PageResponse;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class TimesheetController {

    private final TimesheetService timesheetService;
    private final AppUserRepository appUserRepository;

    public TimesheetController(TimesheetService timesheetService,
                               AppUserRepository appUserRepository) {
        this.timesheetService = timesheetService;
        this.appUserRepository = appUserRepository;
    }

    @GetMapping("/timesheets/paged")
    public PageResponse<TimesheetDto> getTimesheetsPaged(
            Authentication authentication,
            @RequestParam(defaultValue = "all") String view,
            @RequestParam(defaultValue = "0") Integer page,
            @RequestParam(defaultValue = "20") Integer size,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String periodStart,
            @RequestParam(required = false) String periodEnd,
            @RequestParam(defaultValue = "periodStart") String sort,
            @RequestParam(defaultValue = "desc") String direction) {

        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.getTimesheetsPaged(
                currentUser,
                view,
                page,
                size,
                search,
                status,
                periodStart,
                periodEnd,
                sort,
                direction
        );
    }

    @GetMapping("/timesheets")
    public List<TimesheetDto> getTimesheets(Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.getVisibleTimesheets(currentUser);
    }

    @GetMapping("/timesheets/my")
    public List<TimesheetDto> getMyTimesheets(Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.getTimesheetsForUser(currentUser);
    }

    @GetMapping("/timesheets/pending-approval")
    public List<TimesheetDto> getPendingApprovals(Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.getPendingApprovals(currentUser);
    }

    @GetMapping("/timesheets/{id}")
    public TimesheetDto getTimesheetById(@PathVariable Long id,
                                         Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.getTimesheetById(id, currentUser);
    }

    @PostMapping("/timesheets")
    public TimesheetDto createTimesheet(@RequestBody TimesheetRequest request,
                                        Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.createTimesheet(request, currentUser);
    }

    @PostMapping("/timesheets/{id}/submit")
    public TimesheetDto submitTimesheet(@PathVariable Long id,
                                        Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.submitTimesheet(id, currentUser);
    }

    @PostMapping("/timesheets/{id}/approve")
    public TimesheetDto approveTimesheet(@PathVariable Long id,
                                         @RequestBody(required = false) TimesheetActionRequest request,
                                         Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.approveTimesheet(id, request, currentUser);
    }

    @PostMapping("/timesheets/{id}/reject")
    public TimesheetDto rejectTimesheet(@PathVariable Long id,
                                        @RequestBody TimesheetActionRequest request,
                                        Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.rejectTimesheet(id, request, currentUser);
    }

    @PostMapping("/timesheets/{id}/recall")
    public TimesheetDto recallTimesheet(@PathVariable Long id,
                                        Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.recallTimesheet(id, currentUser);
    }

    @PostMapping("/time-logs")
    public TimeLogDto createTimeLog(@RequestBody TimeLogRequest request,
                                    Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.createTimeLog(request, currentUser);
    }

    @PutMapping("/time-logs/{id}")
    public TimeLogDto updateTimeLog(@PathVariable Long id,
                                    @RequestBody TimeLogRequest request,
                                    Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.updateTimeLog(id, request, currentUser);
    }

    @DeleteMapping("/time-logs/{id}")
    public void deleteTimeLog(@PathVariable Long id,
                              Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        timesheetService.deleteTimeLog(id, currentUser);
    }

    @GetMapping("/tasks/{taskId}/time-summary")
    public TimeSummaryDto getTaskTimeSummary(@PathVariable Long taskId,
                                             Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        return timesheetService.getTaskTimeSummary(taskId, currentUser);
    }

    private AppUser getCurrentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("User is not logged in");
        }

        return appUserRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Logged-in user not found"));
    }
}
