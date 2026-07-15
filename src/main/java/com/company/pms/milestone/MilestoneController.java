package com.company.pms.milestone;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/milestones")
public class MilestoneController {

    private final MilestoneRepository milestoneRepository;
    private final MilestoneMasterRepository milestoneMasterRepository;
    private final MilestoneService milestoneService;

    public MilestoneController(MilestoneRepository milestoneRepository,
                               MilestoneMasterRepository milestoneMasterRepository,
                               MilestoneService milestoneService) {
        this.milestoneRepository = milestoneRepository;
        this.milestoneMasterRepository = milestoneMasterRepository;
        this.milestoneService = milestoneService;
    }

    /*
     * Master list: only 11 fixed milestones.
     * Use this if you need only standard names.
     */
    @GetMapping("/master")
    public List<MilestoneMaster> getMilestoneMaster() {
        return milestoneMasterRepository.findByActiveTrueOrderByMilestoneOrderAsc();
    }

    /*
     * Project-wise milestone statuses.
     * This is what Tasks and Assignments should use after project selection.
     */
    @GetMapping("/project/{projectId}")
    public List<Milestone> getMilestonesByProject(@PathVariable Long projectId) {
        return milestoneService.getMilestonesByProjectId(projectId);
    }

    /*
     * Keep this for dashboard/admin views.
     * It returns project-wise milestone status rows.
     */
    @GetMapping
    public List<Milestone> getAllMilestones() {
        return milestoneService.getAllProjectMilestoneStatuses();
    }

    @GetMapping("/{id}")
    public Milestone getMilestoneById(@PathVariable Long id) {
        return milestoneRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Project milestone status not found"));
    }
}