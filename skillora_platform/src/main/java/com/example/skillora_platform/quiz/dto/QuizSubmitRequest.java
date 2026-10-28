package com.example.skillora_platform.quiz.dto;

import java.util.List;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class QuizSubmitRequest {

    @NotNull(message = "Start a quiz attempt before submitting")
    private Long attemptId;

    @Valid
    @NotEmpty(message = "At least one answer is required")
    private List<QuizAnswerSubmitRequest> answers;
}
