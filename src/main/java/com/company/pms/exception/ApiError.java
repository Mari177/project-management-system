package com.company.pms.exception;

import lombok.AllArgsConstructor;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@AllArgsConstructor
public class ApiError {

    private LocalDateTime timestamp;

    private int status;

    private String message;

    private String path;
}