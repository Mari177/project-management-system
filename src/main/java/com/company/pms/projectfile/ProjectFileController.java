package com.company.pms.projectfile;

import com.company.pms.auth.AppUser;
import com.company.pms.auth.AppUserRepository;
import com.company.pms.project.Project;
import com.company.pms.project.ProjectRepository;
import com.company.pms.projectmember.ProjectMemberRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.util.UriUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/projects")
public class ProjectFileController {

    private static final long MAX_FILE_SIZE_BYTES = 10L * 1024L * 1024L;

    private static final Set<String> BLOCKED_EXTENSIONS = Set.of(
            "exe", "bat", "cmd", "sh", "js", "jar", "war", "dll", "msi", "ps1", "vbs"
    );

    private final ProjectFileRepository projectFileRepository;
    private final ProjectRepository projectRepository;
    private final AppUserRepository appUserRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public ProjectFileController(ProjectFileRepository projectFileRepository,
                                 ProjectRepository projectRepository,
                                 AppUserRepository appUserRepository,
                                 ProjectMemberRepository projectMemberRepository) {
        this.projectFileRepository = projectFileRepository;
        this.projectRepository = projectRepository;
        this.appUserRepository = appUserRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    @GetMapping("/{projectId}/files")
    public List<ProjectFileResponse> getProjectFiles(@PathVariable Long projectId,
                                                     Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        Project project = getProject(projectId);

        if (!canViewNormalProjectFile(currentUser, project)) {
            throw new RuntimeException("You do not have access to this project's files");
        }

        return projectFileRepository.findByProjectIdOrderByUploadedAtDesc(projectId)
                .stream()
                .filter(file -> canViewFile(currentUser, file))
                .map(file -> ProjectFileResponse.from(file, canDeleteFile(currentUser, file)))
                .toList();
    }

    @PostMapping(value = "/{projectId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ProjectFileResponse uploadProjectFile(@PathVariable Long projectId,
                                                 @RequestParam("file") MultipartFile multipartFile,
                                                 @RequestParam(defaultValue = "NORMAL") String visibility,
                                                 @RequestParam(required = false) String description,
                                                 Authentication authentication) throws IOException {
        AppUser currentUser = getCurrentUser(authentication);
        Project project = getProject(projectId);

        String normalizedVisibility = normalizeVisibility(visibility);

        if (!canUploadFile(currentUser, project, normalizedVisibility)) {
            throw new RuntimeException("You do not have permission to upload this type of project file");
        }

        validateFile(multipartFile);

        ProjectFile projectFile = new ProjectFile();
        projectFile.setProject(project);
        projectFile.setOriginalFileName(cleanFileName(multipartFile.getOriginalFilename()));
        projectFile.setContentType(multipartFile.getContentType() == null
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                : multipartFile.getContentType());
        projectFile.setFileSizeBytes(multipartFile.getSize());
        projectFile.setVisibility(normalizedVisibility);
        projectFile.setDescription(cleanDescription(description));
        projectFile.setUploadedBy(currentUser);
        projectFile.setUploadedAt(LocalDateTime.now());
        projectFile.setFileContent(multipartFile.getBytes());

        ProjectFile savedFile = projectFileRepository.save(projectFile);
        return ProjectFileResponse.from(savedFile, canDeleteFile(currentUser, savedFile));
    }

    @GetMapping("/files/{fileId}/download")
    public ResponseEntity<byte[]> downloadProjectFile(@PathVariable Long fileId,
                                                      Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        ProjectFile projectFile = projectFileRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("Project file not found"));

        if (!canViewFile(currentUser, projectFile)) {
            throw new RuntimeException("You do not have permission to download this file");
        }

        String encodedFileName = UriUtils.encode(projectFile.getOriginalFileName(), StandardCharsets.UTF_8);
        String contentType = projectFile.getContentType() == null || projectFile.getContentType().isBlank()
                ? MediaType.APPLICATION_OCTET_STREAM_VALUE
                : projectFile.getContentType();

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encodedFileName)
                .contentType(MediaType.parseMediaType(contentType))
                .contentLength(projectFile.getFileSizeBytes())
                .body(projectFile.getFileContent());
    }

    @DeleteMapping("/files/{fileId}")
    public void deleteProjectFile(@PathVariable Long fileId,
                                  Authentication authentication) {
        AppUser currentUser = getCurrentUser(authentication);
        ProjectFile projectFile = projectFileRepository.findById(fileId)
                .orElseThrow(() -> new RuntimeException("Project file not found"));

        if (!canDeleteFile(currentUser, projectFile)) {
            throw new RuntimeException("You do not have permission to delete this file");
        }

        projectFileRepository.delete(projectFile);
    }

    private AppUser getCurrentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            throw new RuntimeException("User is not logged in");
        }

        return appUserRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new RuntimeException("Logged-in user not found"));
    }

    private Project getProject(Long projectId) {
        return projectRepository.findById(projectId)
                .orElseThrow(() -> new RuntimeException("Project not found"));
    }

    private boolean canViewFile(AppUser currentUser, ProjectFile projectFile) {
        if (projectFile == null || projectFile.getProject() == null) {
            return false;
        }

        if (isConfidential(projectFile)) {
            return canViewConfidentialProjectFile(currentUser, projectFile.getProject());
        }

        return canViewNormalProjectFile(currentUser, projectFile.getProject());
    }

    private boolean canViewNormalProjectFile(AppUser currentUser, Project project) {
        String role = currentUser.getRole();

        if ("ADMIN".equals(role) || "EXECUTIVE_VIEWER".equals(role)) {
            return true;
        }

        if ("CLIENT_VIEWER".equals(role)) {
            return currentUser.getClient() != null
                    && project.getClient() != null
                    && project.getClient().getId().equals(currentUser.getClient().getId());
        }

        if (isAssignedDeliveryHead(currentUser, project)
                || isAssignedDeliveryManager(currentUser, project)
                || isAssignedTeamLead(currentUser, project)) {
            return true;
        }

        return projectMemberRepository.existsByProjectIdAndActiveTrueAndResourceAppUserId(
                project.getId(), currentUser.getId()
        );
    }

    private boolean canViewConfidentialProjectFile(AppUser currentUser, Project project) {
        String role = currentUser.getRole();

        return "ADMIN".equals(role)
                || "EXECUTIVE_VIEWER".equals(role)
                || isAssignedDeliveryHead(currentUser, project)
                || isAssignedDeliveryManager(currentUser, project);
    }

    private boolean canUploadFile(AppUser currentUser, Project project, String visibility) {
        if ("ADMIN".equals(currentUser.getRole())) {
            return true;
        }

        if (isAssignedDeliveryHead(currentUser, project) || isAssignedDeliveryManager(currentUser, project)) {
            return true;
        }

        if (isAssignedTeamLead(currentUser, project)) {
            return "NORMAL".equals(visibility);
        }

        return false;
    }

    private boolean canDeleteFile(AppUser currentUser, ProjectFile projectFile) {
        if (projectFile == null || projectFile.getProject() == null) {
            return false;
        }

        if ("ADMIN".equals(currentUser.getRole())) {
            return true;
        }

        if (isAssignedDeliveryHead(currentUser, projectFile.getProject())
                || isAssignedDeliveryManager(currentUser, projectFile.getProject())) {
            return true;
        }

        return projectFile.getUploadedBy() != null
                && projectFile.getUploadedBy().getId().equals(currentUser.getId())
                && !isConfidential(projectFile);
    }

    private boolean isAssignedDeliveryHead(AppUser currentUser, Project project) {
        return "DELIVERY_HEAD".equals(currentUser.getRole())
                && project.getDeliveryHeadUser() != null
                && project.getDeliveryHeadUser().getId().equals(currentUser.getId());
    }

    private boolean isAssignedDeliveryManager(AppUser currentUser, Project project) {
        return "DELIVERY_MANAGER".equals(currentUser.getRole())
                && project.getDeliveryManagerUser() != null
                && project.getDeliveryManagerUser().getId().equals(currentUser.getId());
    }

    private boolean isAssignedTeamLead(AppUser currentUser, Project project) {
        return "TL".equals(currentUser.getRole())
                && project.getTlUser() != null
                && project.getTlUser().getId().equals(currentUser.getId());
    }

    private boolean isConfidential(ProjectFile projectFile) {
        return "CONFIDENTIAL".equalsIgnoreCase(projectFile.getVisibility());
    }

    private String normalizeVisibility(String visibility) {
        if (visibility == null || visibility.isBlank()) {
            return "NORMAL";
        }

        String normalized = visibility.trim().toUpperCase().replace(" ", "_").replace("-", "_");

        if (!"NORMAL".equals(normalized) && !"CONFIDENTIAL".equals(normalized)) {
            throw new RuntimeException("File visibility must be NORMAL or CONFIDENTIAL");
        }

        return normalized;
    }

    private void validateFile(MultipartFile multipartFile) {
        if (multipartFile == null || multipartFile.isEmpty()) {
            throw new RuntimeException("Please select a file to upload");
        }

        if (multipartFile.getSize() > MAX_FILE_SIZE_BYTES) {
            throw new RuntimeException("File size must be 10 MB or less");
        }

        String fileName = cleanFileName(multipartFile.getOriginalFilename());
        String extension = getExtension(fileName);

        if (BLOCKED_EXTENSIONS.contains(extension)) {
            throw new RuntimeException("This file type is not allowed for security reasons");
        }
    }

    private String cleanFileName(String originalFileName) {
        String fileName = StringUtils.cleanPath(originalFileName == null ? "project-file" : originalFileName);

        if (fileName.contains("..") || fileName.contains("/") || fileName.contains("\\")) {
            throw new RuntimeException("Invalid file name");
        }

        return fileName;
    }

    private String getExtension(String fileName) {
        int lastDot = fileName.lastIndexOf('.');

        if (lastDot < 0 || lastDot == fileName.length() - 1) {
            return "";
        }

        return fileName.substring(lastDot + 1).toLowerCase();
    }

    private String cleanDescription(String description) {
        if (description == null || description.isBlank()) {
            return null;
        }

        String cleaned = description.trim();
        return cleaned.length() > 500 ? cleaned.substring(0, 500) : cleaned;
    }
}