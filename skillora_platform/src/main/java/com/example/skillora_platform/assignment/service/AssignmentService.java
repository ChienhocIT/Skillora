package com.example.skillora_platform.assignment.service;

import java.time.LocalDateTime;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.skillora_platform.assignment.dto.AssignmentCreateRequest;
import com.example.skillora_platform.assignment.dto.AssignmentResponse;
import com.example.skillora_platform.assignment.dto.AssignmentSubmissionResponse;
import com.example.skillora_platform.assignment.entity.Assignment;
import com.example.skillora_platform.assignment.entity.AssignmentSubmission;
import com.example.skillora_platform.assignment.repository.AssignmentRepository;
import com.example.skillora_platform.assignment.repository.AssignmentSubmissionRepository;
import com.example.skillora_platform.course.entity.Course;
import com.example.skillora_platform.course.entity.Lesson;
import com.example.skillora_platform.course.entity.LessonType;
import com.example.skillora_platform.course.service.CoursePermissionService;
import com.example.skillora_platform.course.service.LessonService;
import com.example.skillora_platform.enrollment.entity.Enrollment;
import com.example.skillora_platform.enrollment.service.LearningAccessService;
import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.exception.ResourceNotFoundException;
import com.example.skillora_platform.user.entity.User;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AssignmentService {

    private static final int DEFAULT_MAX_SCORE = 100;

    private final AssignmentRepository assignmentRepository;
    private final AssignmentSubmissionRepository assignmentSubmissionRepository;
    private final LessonService lessonService;
    private final CoursePermissionService permissionService;
    private final LearningAccessService learningAccessService;

    @Transactional
    public AssignmentResponse create(AssignmentCreateRequest request, String actorEmail) {
        Lesson lesson = lessonService.findActiveLesson(request.getLessonId());
        User actor = permissionService.requireInstructorOrAdmin(actorEmail);
        permissionService.requireOwnerOrAdmin(lesson.getSection().getCourse(), actor);
        validateAssignmentLesson(lesson);

        if (assignmentRepository.existsByLessonId(lesson.getId())) {
            throw new BusinessException("Assignment already exists for this lesson", HttpStatus.CONFLICT);
        }

        Assignment assignment = Assignment.builder()
                .lesson(lesson)
                .title(request.getTitle().trim())
                .instructions(trimToNull(request.getInstructions()))
                .maxScore(request.getMaxScore() == null ? DEFAULT_MAX_SCORE : request.getMaxScore())
                .dueDays(request.getDueDays())
                .build();

        return toResponse(assignmentRepository.save(assignment), null);
    }

    @Transactional(readOnly = true)
    public AssignmentResponse get(Long id, String actorEmail) {
        Assignment assignment = findAssignmentWithLesson(id);
        User actor = permissionService.requireActor(actorEmail);
        Course course = assignment.getLesson().getSection().getCourse();

        if (permissionService.canManage(course, actor)) {
            return toResponse(assignment, null);
        }

        if (!lessonService.isPublishedLearningContent(assignment.getLesson())) {
            throw new BusinessException("Enrollment required to access this assignment", HttpStatus.FORBIDDEN);
        }

        Enrollment enrollment = learningAccessService.getActiveEnrollment(actor.getId(), course.getId());
        if (enrollment == null) {
            throw new BusinessException("Enrollment required to access this assignment", HttpStatus.FORBIDDEN);
        }

        AssignmentSubmission submission = assignmentSubmissionRepository
                .findByAssignmentIdAndEnrollmentId(assignment.getId(), enrollment.getId())
                .orElse(null);
        return toResponse(assignment, enrollment, submission);
    }

    @Transactional(readOnly = true)
    public Assignment findAssignmentWithLesson(Long id) {
        return assignmentRepository.findByIdWithLesson(id)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found with id: " + id));
    }

    public void requireManageAccess(Assignment assignment, User actor) {
        permissionService.requireOwnerOrAdmin(assignment.getLesson().getSection().getCourse(), actor);
    }

    private AssignmentResponse toResponse(Assignment assignment, Enrollment enrollment) {
        return toResponse(assignment, enrollment, null);
    }

    private AssignmentResponse toResponse(
            Assignment assignment,
            Enrollment enrollment,
            AssignmentSubmission submission
    ) {
        LocalDateTime dueAt = dueAt(assignment, enrollment);
        return AssignmentResponse.builder()
                .id(assignment.getId())
                .lessonId(assignment.getLesson().getId())
                .courseId(assignment.getLesson().getSection().getCourse().getId())
                .lessonTitle(assignment.getLesson().getTitle())
                .title(assignment.getTitle())
                .instructions(assignment.getInstructions())
                .maxScore(assignment.getMaxScore())
                .dueDays(assignment.getDueDays())
                .dueAt(dueAt)
                .overdue(dueAt != null && LocalDateTime.now().isAfter(dueAt))
                .mySubmission(submission == null ? null : toSubmissionResponse(submission))
                .createdAt(assignment.getCreatedAt())
                .updatedAt(assignment.getUpdatedAt())
                .build();
    }

    private AssignmentSubmissionResponse toSubmissionResponse(AssignmentSubmission submission) {
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

    private void validateAssignmentLesson(Lesson lesson) {
        if (lesson.getType() != LessonType.ASSIGNMENT) {
            throw new BusinessException("Assignment can only be attached to an ASSIGNMENT lesson",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private LocalDateTime dueAt(Assignment assignment, Enrollment enrollment) {
        if (enrollment == null || assignment.getDueDays() == null) {
            return null;
        }
        return enrollment.getEnrolledAt().plusDays(assignment.getDueDays());
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
