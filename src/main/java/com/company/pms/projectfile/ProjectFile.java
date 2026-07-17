package com.company.pms.projectfile;

import com.company.pms.auth.AppUser;
import com.company.pms.project.Project;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;

@Entity
@Table(name = "project_files")
@Data
public class ProjectFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "project_id", nullable = false)
    @JsonIgnoreProperties({
            "client",
            "deliveryHeadUser",
            "deliveryManagerUser",
            "tlUser",
            "linkedImplementationProject"
    })
    private Project project;

    @Column(name = "original_file_name", nullable = false, length = 255)
    private String originalFileName;

    @Column(name = "content_type", length = 150)
    private String contentType;

    @Column(name = "file_size_bytes", nullable = false)
    private Long fileSizeBytes;

    @Column(name = "visibility", nullable = false, length = 30)
    private String visibility = "NORMAL";

    @Column(name = "description", length = 500)
    private String description;

    @ManyToOne
    @JoinColumn(name = "uploaded_by_user_id")
    @JsonIgnoreProperties({"password", "managerUser", "client"})
    private AppUser uploadedBy;

    @Column(name = "uploaded_at", nullable = false)
    private LocalDateTime uploadedAt;

    @JsonIgnore
    @JdbcTypeCode(SqlTypes.VARBINARY)
    @Column(name = "file_content", nullable = false, columnDefinition = "bytea")
    private byte[] fileContent;
}