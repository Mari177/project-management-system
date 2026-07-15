 package com.company.pms.project;

import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class ProjectCodeService {

    private static final String COMPANY_PREFIX = "NI";
    private static final String PROJECT_PREFIX = "PRJ";
    private static final int CODE_LENGTH = 4;

    private final ProjectRepository projectRepository;

    public ProjectCodeService(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    public synchronized String generateProjectCode(LocalDate projectStartDate) {
        int year = projectStartDate != null
                ? projectStartDate.getYear()
                : LocalDate.now().getYear();

        String prefix = COMPANY_PREFIX + "-" + PROJECT_PREFIX + "-" + year + "-";

        int nextNumber = projectRepository
                .findTopByProjectCodeStartingWithOrderByProjectCodeDesc(prefix)
                .map(project -> extractSequence(project.getProjectCode(), prefix))
                .orElse(0) + 1;

        String projectCode;

        do {
            projectCode = prefix + String.format("%0" + CODE_LENGTH + "d", nextNumber);
            nextNumber++;
        } while (projectRepository.existsByProjectCode(projectCode));

        return projectCode;
    }

    private int extractSequence(String projectCode, String prefix) {
        if (projectCode == null || !projectCode.startsWith(prefix)) {
            return 0;
        }

        try {
            return Integer.parseInt(projectCode.substring(prefix.length()));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }
}