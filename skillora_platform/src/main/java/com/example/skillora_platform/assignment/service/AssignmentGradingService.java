package com.example.skillora_platform.assignment.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

import com.example.skillora_platform.assignment.dto.AssignmentGradeRequest;
import com.example.skillora_platform.assignment.dto.AssignmentSubmissionResponse;
import com.example.skillora_platform.assignment.entity.AssignmentSubmission;
import com.example.skillora_platform.assignment.entity.SubmissionStatus;
import com.example.skillora_platform.assignment.repository.AssignmentSubmissionRepository;
import com.example.skillora_platform.course.service.CoursePermissionService;
import com.example.skillora_platform.enrollment.service.LearningProgressService;
import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.exception.ResourceNotFoundException;
import com.example.skillora_platform.notification.event.AssignmentGradedEvent;
import com.example.skillora_platform.notification.event.AssignmentReturnedEvent;
import com.example.skillora_platform.user.entity.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AssignmentGradingService {

    private final AssignmentSubmissionRepository assignmentSubmissionRepository;
    private final CoursePermissionService permissionService;
    private final LearningProgressService learningProgressService;
    private final AssignmentSubmissionService assignmentSubmissionService;
    private final ApplicationEventPublisher eventPublisher;
    private final EntityManager entityManager;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public AssignmentSubmissionResponse grade(Long submissionId, AssignmentGradeRequest request, String actorEmail) {
        User actor = permissionService.requireInstructorOrAdmin(actorEmail);
        AssignmentSubmission submission = assignmentSubmissionRepository.findByIdWithDetails(submissionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Assignment submission not found with id: " + submissionId));
        permissionService.requireOwnerOrAdmin(
                submission.getAssignment().getLesson().getSection().getCourse(), actor);

        entityManager.refresh(submission.getEnrollment(), LockModeType.PESSIMISTIC_WRITE);
        entityManager.refresh(submission, LockModeType.PESSIMISTIC_WRITE);
        if (request.getStatus() == SubmissionStatus.GRADED) {
            applyGraded(submission, request, actor);
        } else if (request.getStatus() == SubmissionStatus.RETURNED) {
            applyReturned(submission, request, actor);
        } else {
            throw new BusinessException("Submission can only be graded or returned", HttpStatus.BAD_REQUEST);
        }

        AssignmentSubmission savedSubmission = assignmentSubmissionRepository.save(submission);
        learningProgressService.updateAssessmentProgress(savedSubmission.getEnrollment().getId(),
                savedSubmission.getAssignment().getLesson().getId(),
                savedSubmission.getStatus() == SubmissionStatus.GRADED && Boolean.TRUE.equals(savedSubmission.getPassed()));
        publishNotificationEvent(savedSubmission);

        log.info("Instructor {} updated assignment submission {} to {}",
                actor.getId(), savedSubmission.getId(), savedSubmission.getStatus());
        return assignmentSubmissionService.toResponse(savedSubmission);
    }

    private void publishNotificationEvent(AssignmentSubmission submission) {
        if (submission.getStatus() == SubmissionStatus.GRADED) {
            eventPublisher.publishEvent(new AssignmentGradedEvent(submission.getId()));
        } else if (submission.getStatus() == SubmissionStatus.RETURNED) {
            eventPublisher.publishEvent(new AssignmentReturnedEvent(submission.getId()));
        }
    }

    private void applyGraded(
            AssignmentSubmission submission,
            AssignmentGradeRequest request,
            User grader
    ) {
        if (request.getPassed() == null) {
            throw new BusinessException("Instructor must explicitly mark the assignment passed or failed", HttpStatus.BAD_REQUEST);
        }
        if (request.getScore() == null) {
            throw new BusinessException("Score is required when grading a submission", HttpStatus.BAD_REQUEST);
        }
        BigDecimal maxScore = BigDecimal.valueOf(submission.getAssignment().getMaxScore());
        if (request.getScore().compareTo(maxScore) > 0) {
            throw new BusinessException("Score must not exceed assignment max score", HttpStatus.BAD_REQUEST);
        }

        submission.setStatus(SubmissionStatus.GRADED);
        submission.setScore(request.getScore());
        submission.setPassed(request.getPassed());
        submission.setFeedback(trimToNull(request.getFeedback()));
        submission.setGradedAt(LocalDateTime.now());
        submission.setGradedBy(grader);
    }

    private void applyReturned(
            AssignmentSubmission submission,
            AssignmentGradeRequest request,
            User grader
    ) {
        if (submission.getStatus() == SubmissionStatus.GRADED && Boolean.TRUE.equals(submission.getPassed())) {
            throw new BusinessException("Passed submissions cannot be returned", HttpStatus.CONFLICT);
        }
        String feedback = trimToNull(request.getFeedback());
        if (feedback == null) {
            throw new BusinessException("Feedback is required when returning a submission", HttpStatus.BAD_REQUEST);
        }

        submission.setStatus(SubmissionStatus.RETURNED);
        submission.setScore(null);
        submission.setPassed(null);
        submission.setFeedback(feedback);
        submission.setGradedAt(LocalDateTime.now());
        submission.setGradedBy(grader);
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
