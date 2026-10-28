package com.example.skillora_platform.assignment.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import com.example.skillora_platform.assignment.entity.SubmissionStatus;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AssignmentGradeRequest {

    @NotNull(message = "Submission status is required")
    private SubmissionStatus status;

    @DecimalMin(value = "0.00", message = "Score must be at least 0")
    private BigDecimal score;

    private Boolean passed;

    private String feedback;
}
