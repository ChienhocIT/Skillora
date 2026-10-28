package com.example.skillora_platform.quiz.dto;

import java.util.List;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class QuizAnswerSubmitRequest {

    @NotNull(message = "Question id is required")
    private Long questionId;

    private List<Long> selectedOptionIds;

    @Size(max = 10000, message = "Text answer must not exceed 10000 characters")
    private String textAnswer;
}
