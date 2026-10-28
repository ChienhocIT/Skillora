package com.example.skillora_platform.quiz.dto;

import java.time.LocalDateTime;
import java.util.List;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class QuizResponse {

    private Long id;
    private Long lessonId;
    private Long courseId;
    private String title;
    private String description;
    private int passScore;
    private Integer timeLimitMins;
    private Integer maxAttempts;
    private boolean shuffleQuestions;
    private int questionCount;
    private List<QuestionResponse> questions;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
