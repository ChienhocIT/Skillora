package com.example.skillora_platform.assignment.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import com.example.skillora_platform.assignment.entity.SubmissionStatus;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AssignmentSubmissionResponse {

    private Long id;
    private Long assignmentId;
    private Long enrollmentId;
    private Long userId;
    private String studentName;
    private String content;
    private String fileUrl;
    private BigDecimal score;
    private Boolean passed;
    private String feedback;
    private SubmissionStatus status;
    private LocalDateTime submittedAt;
    private LocalDateTime gradedAt;
    private Long gradedById;
    private String gradedByName;
    private LocalDateTime dueAt;
    private boolean late;
}
