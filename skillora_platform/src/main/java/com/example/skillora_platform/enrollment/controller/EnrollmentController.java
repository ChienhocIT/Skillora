package com.example.skillora_platform.enrollment.controller;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.skillora_platform.common.ApiResponse;
import com.example.skillora_platform.common.Constants;
import com.example.skillora_platform.common.PageResponse;
import com.example.skillora_platform.enrollment.dto.CertificateResponse;
import com.example.skillora_platform.enrollment.dto.EnrollmentResponse;
import com.example.skillora_platform.enrollment.dto.LessonProgressResponse;
import com.example.skillora_platform.enrollment.dto.LessonProgressUpdateRequest;
import com.example.skillora_platform.enrollment.entity.EnrollmentStatus;
import com.example.skillora_platform.enrollment.service.EnrollmentService;
import com.example.skillora_platform.enrollment.service.LearningProgressService;

import lombok.RequiredArgsConstructor;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class EnrollmentController {

    private final EnrollmentService enrollmentService;
    private final LearningProgressService learningProgressService;

    @PostMapping(Constants.COURSE_API_PREFIX + "/{id}/enroll")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<ApiResponse<EnrollmentResponse>> enroll(
            @PathVariable("id") Long courseId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Enrolled successfully",
                        enrollmentService.enroll(courseId, jwt.getSubject())));
    }

    @GetMapping(Constants.ENROLLMENT_API_PREFIX + "/me")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<PageResponse<EnrollmentResponse>> myEnrollments(
            @AuthenticationPrincipal Jwt jwt,
            @RequestParam(name = "status", required = false) EnrollmentStatus status,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "" + Constants.DEFAULT_PAGE_SIZE) int size
    ) {
        return ApiResponse.success(
                enrollmentService.myEnrollments(jwt.getSubject(), status, page, size));
    }

    @GetMapping(Constants.ENROLLMENT_API_PREFIX + "/{id}/progress")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<LessonProgressResponse>> getProgress(
            @PathVariable("id") Long enrollmentId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        enrollmentService.getEnrollment(enrollmentId, jwt.getSubject());
        return ApiResponse.success(learningProgressService.getProgress(enrollmentId));
    }

    @PatchMapping(Constants.ENROLLMENT_API_PREFIX + "/{id}/lessons/{lid}/progress")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<LessonProgressResponse> updateProgress(
            @PathVariable("id") Long enrollmentId,
            @PathVariable("lid") Long lessonId,
            @AuthenticationPrincipal Jwt jwt,
            @Valid @RequestBody LessonProgressUpdateRequest request
    ) {
        enrollmentService.getEnrollment(enrollmentId, jwt.getSubject());
        return ApiResponse.success("Progress updated",
                learningProgressService.updateLearnerProgress(
                        enrollmentId, lessonId, request.getWatchedSeconds(), request.getCompleted()));
    }

    @GetMapping(Constants.ENROLLMENT_API_PREFIX + "/{id}/certificate")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<CertificateResponse> getCertificate(
            @PathVariable("id") Long enrollmentId,
            @AuthenticationPrincipal Jwt jwt
    ) {
        return ApiResponse.success(enrollmentService.getCertificate(enrollmentId, jwt.getSubject()));
    }
}
