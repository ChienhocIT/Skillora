package com.example.skillora_platform.quiz.controller;

import java.util.List;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.example.skillora_platform.common.ApiResponse;
import com.example.skillora_platform.common.Constants;
import com.example.skillora_platform.quiz.dto.QuizAttemptResponse;
import com.example.skillora_platform.quiz.dto.QuizCreateRequest;
import com.example.skillora_platform.quiz.dto.QuizResponse;
import com.example.skillora_platform.quiz.dto.QuizSubmitRequest;
import com.example.skillora_platform.quiz.dto.QuizUpdateRequest;
import com.example.skillora_platform.quiz.service.QuizHistoryService;
import com.example.skillora_platform.quiz.service.QuizAttemptService;
import com.example.skillora_platform.quiz.service.QuizService;
import com.example.skillora_platform.quiz.service.QuizSubmissionService;

import lombok.RequiredArgsConstructor;

@RestController
@RequiredArgsConstructor
public class QuizController {

    private final QuizService quizService;
    private final QuizSubmissionService quizSubmissionService;
    private final QuizHistoryService quizHistoryService;
    private final QuizAttemptService quizAttemptService;

    @PostMapping(Constants.QUIZ_API_PREFIX + "/{id}/attempts/start")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<QuizAttemptResponse> start(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return ApiResponse.success(quizAttemptService.start(id, jwt.getSubject()));
    }

    @PostMapping(Constants.QUIZ_API_PREFIX)
    @PreAuthorize("hasAnyRole('INSTRUCTOR', 'ADMIN')")
    public ResponseEntity<ApiResponse<QuizResponse>> create(
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody QuizCreateRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Quiz created successfully",
                        quizService.create(request, jwt.getSubject())));
    }

    @GetMapping(Constants.QUIZ_API_PREFIX + "/{id}")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<QuizResponse> get(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return ApiResponse.success(quizService.get(id, jwt.getSubject()));
    }

    @PutMapping(Constants.QUIZ_API_PREFIX + "/{id}")
    @PreAuthorize("hasAnyRole('INSTRUCTOR', 'ADMIN')")
    public ApiResponse<QuizResponse> update(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody QuizUpdateRequest request
    ) {
        return ApiResponse.success("Quiz updated successfully",
                quizService.update(id, request, jwt.getSubject()));
    }

    @PostMapping(Constants.QUIZ_API_PREFIX + "/{id}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<QuizAttemptResponse>> submit(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody QuizSubmitRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Quiz submitted successfully",
                        quizSubmissionService.submit(id, request, jwt.getSubject())));
    }

    @GetMapping(Constants.QUIZ_API_PREFIX + "/{id}/attempts")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<List<QuizAttemptResponse>> myAttempts(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return ApiResponse.success(quizHistoryService.myAttempts(id, jwt.getSubject()));
    }
}
