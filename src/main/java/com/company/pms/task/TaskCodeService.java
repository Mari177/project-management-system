package com.company.pms.task;

import org.springframework.stereotype.Service;

import java.time.LocalDate;

@Service
public class TaskCodeService {

    private static final String COMPANY_PREFIX = "NI";
    private static final String TASK_PREFIX = "TSK";
    private static final int CODE_LENGTH = 6;

    private final TaskRepository taskRepository;

    public TaskCodeService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    public synchronized String generateTaskCode(LocalDate taskStartDate) {
        int year = taskStartDate != null
                ? taskStartDate.getYear()
                : LocalDate.now().getYear();

        String prefix = COMPANY_PREFIX + "-" + TASK_PREFIX + "-" + year + "-";

        int nextNumber = taskRepository
                .findTopByTaskCodeStartingWithOrderByTaskCodeDesc(prefix)
                .map(task -> extractSequence(task.getTaskCode(), prefix))
                .orElse(0) + 1;

        String taskCode;

        do {
            taskCode = prefix + String.format("%0" + CODE_LENGTH + "d", nextNumber);
            nextNumber++;
        } while (taskRepository.existsByTaskCode(taskCode));

        return taskCode;
    }

    private int extractSequence(String taskCode, String prefix) {
        if (taskCode == null || !taskCode.startsWith(prefix)) {
            return 0;
        }

        try {
            return Integer.parseInt(taskCode.substring(prefix.length()));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }
}
