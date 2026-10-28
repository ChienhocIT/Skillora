package com.example.skillora_platform.enrollment.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.skillora_platform.common.Constants;
import com.example.skillora_platform.common.PageResponse;
import com.example.skillora_platform.course.entity.Course;
import com.example.skillora_platform.course.entity.CourseStatus;
import com.example.skillora_platform.course.repository.CourseRepository;
import com.example.skillora_platform.course.service.CoursePermissionService;
import com.example.skillora_platform.enrollment.dto.CertificateResponse;
import com.example.skillora_platform.enrollment.dto.EnrollmentResponse;
import com.example.skillora_platform.enrollment.entity.CourseCertificate;
import com.example.skillora_platform.enrollment.entity.Enrollment;
import com.example.skillora_platform.enrollment.entity.EnrollmentStatus;
import com.example.skillora_platform.enrollment.repository.CourseCertificateRepository;
import com.example.skillora_platform.enrollment.repository.EnrollmentRepository;
import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.exception.ResourceNotFoundException;
import com.example.skillora_platform.notification.event.CourseEnrolledEvent;
import com.example.skillora_platform.user.entity.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final CourseRepository courseRepository;
    private final CourseCertificateRepository courseCertificateRepository;
    private final CoursePermissionService permissionService;
    private final ApplicationEventPublisher eventPublisher;
    private final CompletionEligibilityService eligibilityService;

    @Transactional
    public EnrollmentResponse enroll(Long courseId, String actorEmail) {
        User actor = permissionService.requireActor(actorEmail);

        Course course = courseRepository.findById(courseId)
                .filter(c -> c.getDeletedAt() == null)
                .orElseThrow(() -> new ResourceNotFoundException("Course not found with id: " + courseId));

        if (course.getStatus() != CourseStatus.PUBLISHED) {
            throw new BusinessException("Course is not published", HttpStatus.BAD_REQUEST);
        }

        if (course.getInstructor().getId().equals(actor.getId())) {
            throw new BusinessException("Instructors cannot enroll in their own courses", HttpStatus.BAD_REQUEST);
        }

        if (enrollmentRepository.existsByUserIdAndCourseId(actor.getId(), courseId)) {
            throw new BusinessException("Already enrolled in this course", HttpStatus.CONFLICT);
        }

        if (course.getPrice().compareTo(BigDecimal.ZERO) > 0) {
            throw new BusinessException(
                    "This course requires payment. Please purchase through the checkout flow.",
                    HttpStatus.PAYMENT_REQUIRED
            );
        }

        Enrollment enrollment = Enrollment.builder()
                .user(actor)
                .course(course)
                .status(EnrollmentStatus.ACTIVE)
                .amountPaid(BigDecimal.ZERO)
                .progressPercent(BigDecimal.ZERO)
                .enrolledAt(LocalDateTime.now())
                .build();
        Enrollment saved = enrollmentRepository.save(enrollment);

        course.setTotalEnrollments(course.getTotalEnrollments() + 1);
        courseRepository.save(course);
        eventPublisher.publishEvent(new CourseEnrolledEvent(saved.getId()));

        log.info("User {} enrolled in free course {}", actor.getId(), courseId);
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<EnrollmentResponse> myEnrollments(
            String actorEmail,
            EnrollmentStatus status,
            int page,
            int size
    ) {
        User actor = permissionService.requireActor(actorEmail);
        int safeSize = Math.min(Math.max(size, 1), Constants.MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize);

        Page<Enrollment> enrollmentPage;
        if (status != null) {
            enrollmentPage = enrollmentRepository.findByUserIdAndStatusOrderByEnrolledAtDesc(
                    actor.getId(), status, pageable);
        } else {
            enrollmentPage = enrollmentRepository.findByUserIdOrderByEnrolledAtDesc(actor.getId(), pageable);
        }

        Page<EnrollmentResponse> responsePage = enrollmentPage.map(this::toResponse);
        return PageResponse.from(responsePage);
    }

    @Transactional(readOnly = true)
    public EnrollmentResponse getEnrollment(Long enrollmentId, String actorEmail) {
        User actor = permissionService.requireActor(actorEmail);
        Enrollment enrollment = findEnrollment(enrollmentId);
        requireEnrollmentOwner(enrollment, actor);
        return toResponse(enrollment);
    }

    @Transactional(readOnly = true)
    public CertificateResponse getCertificate(Long enrollmentId, String actorEmail) {
        User actor = permissionService.requireActor(actorEmail);
        Enrollment enrollment = findEnrollment(enrollmentId);
        requireEnrollmentOwner(enrollment, actor);

        if (enrollment.getStatus() != EnrollmentStatus.COMPLETED || !eligibilityService.assess(enrollment).eligible()) {
            throw new BusinessException("Course not yet completed", HttpStatus.BAD_REQUEST);
        }

        CourseCertificate certificate = courseCertificateRepository.findByEnrollmentId(enrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Certificate not found for enrollment: " + enrollmentId));
        if (certificate.getRevokedAt() != null) {
            throw new BusinessException("Certificate has been revoked", HttpStatus.CONFLICT);
        }

        return toCertificateResponse(certificate, enrollment);
    }

    private Enrollment findEnrollment(Long enrollmentId) {
        return enrollmentRepository.findById(enrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Enrollment not found with id: " + enrollmentId));
    }

    private void requireEnrollmentOwner(Enrollment enrollment, User actor) {
        if (!enrollment.getUser().getId().equals(actor.getId())
                && !permissionService.isAdmin(actor)) {
            throw new BusinessException("Access denied to this enrollment", HttpStatus.FORBIDDEN);
        }
    }

    private EnrollmentResponse toResponse(Enrollment enrollment) {
        Course course = enrollment.getCourse();
        return EnrollmentResponse.builder()
                .id(enrollment.getId())
                .userId(enrollment.getUser().getId())
                .courseId(course.getId())
                .courseTitle(course.getTitle())
                .courseSlug(course.getSlug())
                .courseThumbnailUrl(course.getThumbnailUrl())
                .courseLevel(course.getLevel() != null ? course.getLevel().name() : null)
                .instructorName(course.getInstructor().getFullName())
                .status(enrollment.getStatus())
                .amountPaid(enrollment.getAmountPaid())
                .progressPercent(enrollment.getProgressPercent())
                .enrolledAt(enrollment.getEnrolledAt())
                .completedAt(enrollment.getCompletedAt())
                .expiresAt(enrollment.getExpiresAt())
                .build();
    }

    private CertificateResponse toCertificateResponse(CourseCertificate cert, Enrollment enrollment) {
        return CertificateResponse.builder()
                .id(cert.getId())
                .enrollmentId(enrollment.getId())
                .courseId(enrollment.getCourse().getId())
                .courseTitle(enrollment.getCourse().getTitle())
                .studentName(enrollment.getUser().getFullName())
                .certificateCode(cert.getCertificateCode())
                .pdfUrl(cert.getPdfUrl())
                .issuedAt(cert.getIssuedAt())
                .build();
    }
}
