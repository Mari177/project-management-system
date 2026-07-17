package com.company.pms.projectfile;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ProjectFileResponse {

    private Long id;
    private Long projectId;
    private String projectCode;
    private String projectName;
    private String originalFileName;
    private String contentType;
    private Long fileSizeBytes;
    private String visibility;
    private String description;
    private String uploadedByName;
    private String uploadedByRole;
    private LocalDateTime uploadedAt;
    private String downloadUrl;
    private boolean canDelete;

    public static ProjectFileResponse from(ProjectFile file, boolean canDelete) {
        ProjectFileResponse response = new ProjectFileResponse();

        response.setId(file.getId());

        if (file.getProject() != null) {
            response.setProjectId(file.getProject().getId());
            response.setProjectCode(file.getProject().getProjectCode());
            response.setProjectName(file.getProject().getProjectName());
        }

        response.setOriginalFileName(file.getOriginalFileName());
        response.setContentType(file.getContentType());
        response.setFileSizeBytes(file.getFileSizeBytes());
        response.setVisibility(file.getVisibility());
        response.setDescription(file.getDescription());

        if (file.getUploadedBy() != null) {
            response.setUploadedByName(file.getUploadedBy().getName());
            response.setUploadedByRole(file.getUploadedBy().getRole());
        }

        response.setUploadedAt(file.getUploadedAt());
        response.setDownloadUrl("/api/projects/files/" + file.getId() + "/download");
        response.setCanDelete(canDelete);

        return response;
    }
}