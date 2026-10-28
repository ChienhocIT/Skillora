package com.example.skillora_platform.assignment.service;

import java.time.LocalDateTime;
import java.util.Set;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

import com.example.skillora_platform.assignment.dto.AssignmentSubmissionResponse;
import com.example.skillora_platform.assignment.dto.AssignmentSubmitRequest;
import com.example.skillora_platform.assignment.entity.Assignment;
import com.example.skillora_platform.assignment.entity.AssignmentSubmission;
import com.example.skillora_platform.assignment.entity.SubmissionStatus;
import com.example.skillora_platform.assignment.repository.AssignmentSubmissionRepository;
import com.example.skillora_platform.common.Constants;
import com.example.skillora_platform.common.PageResponse;
import com.example.skillora_platform.course.entity.Course;
import com.example.skillora_platform.course.service.CoursePermissionService;
import com.example.skillora_platform.course.service.LessonService;
import com.example.skillora_platform.enrollment.entity.Enrollment;
import com.example.skillora_platform.enrollment.service.LearningAccessService;
import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.user.entity.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AssignmentSubmissionService {

    private final AssignmentSubmissionRepository assignmentSubmissionRepository;
    private final AssignmentService assignmentService;
    private final CoursePermissionService permissionService;
    private final LessonService lessonService;
    private final LearningAccessService learningAccessService;
    private final EntityManager entityManager;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public AssignmentSubmissionResponse submit(Long assignmentId, AssignmentSubmitRequest request, String actorEmail) {
        User actor = permissionService.requireActor(actorEmail);
        Assignment assignment = assignmentService.findAssignmentWithLesson(assignmentId);
        Course course = assignment.getLesson().getSection().getCourse();
        if (!lessonService.isPublishedLearningContent(assignment.getLesson())) {
            throw new BusinessException("Enrollment required to submit this assignment", HttpStatus.FORBIDDEN);
        }
        Enrollment enrollment = learningAccessService.getActiveEnrollment(actor.getId(), course.getId());
        if (enrollment == null) {
            throw new BusinessException("Enrollment required to submit this assignment", HttpStatus.FORBIDDEN);
        }
        entityManager.refresh(enrollment, LockModeType.PESSIMISTIC_WRITE);
        if (enrollment.getStatus() != com.example.skillora_platform.enrollment.entity.EnrollmentStatus.ACTIVE
                && enrollment.getStatus() != com.example.skillora_platform.enrollment.entity.EnrollmentStatus.COMPLETED) {
            throw new BusinessException("Enrollment required to submit this assignment", HttpStatus.FORBIDDEN);
        }

        String content = trimToNull(request.getContent());
        String fileUrl = trimToNull(request.getFileUrl());
        if (content == null && fileUrl == null) {
            throw new BusinessException("Assignment submission requires content or fileUrl", HttpStatus.BAD_REQUEST);
        }

        AssignmentSubmission submission = assignmentSubmissionRepository
                .findByAssignmentIdAndEnrollmentId(assignment.getId(), enrollment.getId())
                .map(existing -> prepareResubmission(existing, content, fileUrl))
                .orElseGet(() -> AssignmentSubmission.builder()
                        .assignment(assignment)
                        .enrollment(enrollment)
                        .content(content)
                        .fileUrl(fileUrl)
                        .status(SubmissionStatus.SUBMITTED)
                        .submittedAt(LocalDateTime.now())
                        .build());

        AssignmentSubmission savedSubmission = assignmentSubmissionRepository.save(submission);
        log.info("User {} submitted assignment {} with submission {}",
                actor.getId(), assignment.getId(), savedSubmission.getId());
        return toResponse(savedSubmission);
    }

    @Transactional(readOnly = true)
    public PageResponse<AssignmentSubmissionResponse> listSubmissions(
            Long assignmentId,
            SubmissionStatus status,
            int page,
            int size,
            String actorEmail
    ) {
        Assignment assignment = assignmentService.findAssignmentWithLesson(assignmentId);
        User actor = permissionService.requireInstructorOrAdmin(actorEmail);
        assignmentService.requireManageAccess(assignment, actor);

        int safeSize = Math.min(Math.max(size, 1), Constants.MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize);
        Page<AssignmentSubmission> submissionPage = status == null
                ? assignmentSubmissionRepository.findByAssignmentId(assignment.getId(), pageable)
                : assignmentSubmissionRepository.findByAssignmentIdAndStatus(assignment.getId(), status, pageable);
        Page<AssignmentSubmissionResponse> responsePage = submissionPage.map(this::toResponse);
        return PageResponse.from(responsePage);
    }

    public AssignmentSubmissionResponse toResponse(AssignmentSubmission submission) {
        LocalDateTime dueAt = dueAt(submission.getAssignment(), submission.getEnrollment());
        User gradedBy = submission.getGradedBy();
        return AssignmentSubmissionResponse.builder()
                .id(submission.getId())
                .assignmentId(submission.getAssignment().getId())
                .enrollmentId(submission.getEnrollment().getId())
                .userId(submission.getEnrollment().getUser().getId())
                .studentName(submission.getEnrollment().getUser().getFullName())
                .content(submission.getContent())
                .fileUrl(submission.getFileUrl())
                .score(submission.getScore())
                .passed(submission.getPassed())
                .feedback(submission.getFeedback())
                .status(submission.getStatus())
                .submittedAt(submission.getSubmittedAt())
                .gradedAt(submission.getGradedAt())
                .gradedById(gradedBy == null ? null : gradedBy.getId())
                .gradedByName(gradedBy == null ? null : gradedBy.getFullName())
                .dueAt(dueAt)
                .late(isLate(submission.getSubmittedAt(), dueAt))
                .build();
    }

    private AssignmentSubmission prepareResubmission(
            AssignmentSubmission submission,
            String content,
            String fileUrl
    ) {
        if (submission.getStatus() != SubmissionStatus.RETURNED) {
            throw new BusinessException("Assignment can only be resubmitted after it is returned",
                    HttpStatus.CONFLICT);
        }
        submission.setContent(content);
        submission.setFileUrl(fileUrl);
        submission.setStatus(SubmissionStatus.SUBMITTED);
        submission.setSubmittedAt(LocalDateTime.now());
        submission.setScore(null);
        submission.setPassed(null);
        submission.setFeedback(null);
        submission.setGradedAt(null);
        submission.setGradedBy(null);
        return submission;
    }

    private LocalDateTime dueAt(Assignment assignment, Enrollment enrollment) {
        if (assignment.getDueDays() == null) {
            return null;
        }
        return enrollment.getEnrolledAt().plusDays(assignment.getDueDays());
    }

    @Transactional(readOnly = true)
    public Set<Long> passedLessonIds(Long enrollmentId) {
        return assignmentSubmissionRepository.findPassedLessonIds(enrollmentId);
    }

    private boolean isLate(LocalDateTime submittedAt, LocalDateTime dueAt) {
        return submittedAt != null && dueAt != null && submittedAt.isAfter(dueAt);
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
