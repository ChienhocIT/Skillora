package com.example.skillora_platform.assignment.repository;

import java.util.Optional;
import java.util.Set;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.skillora_platform.assignment.entity.AssignmentSubmission;
import com.example.skillora_platform.assignment.entity.SubmissionStatus;

public interface AssignmentSubmissionRepository extends JpaRepository<AssignmentSubmission, Long> {

    @Query("SELECT s.assignment.lesson.id FROM AssignmentSubmission s WHERE s.enrollment.id = :enrollmentId AND s.status = com.example.skillora_platform.assignment.entity.SubmissionStatus.GRADED AND s.passed = true")
    Set<Long> findPassedLessonIds(@Param("enrollmentId") Long enrollmentId);

    Optional<AssignmentSubmission> findByAssignmentIdAndEnrollmentId(Long assignmentId, Long enrollmentId);

    @Query("""
            SELECT s FROM AssignmentSubmission s
            JOIN FETCH s.assignment a
            JOIN FETCH a.lesson l
            JOIN FETCH l.section sec
            JOIN FETCH sec.course c
            JOIN FETCH c.instructor
            JOIN FETCH s.enrollment e
            JOIN FETCH e.user
            LEFT JOIN FETCH s.gradedBy
            WHERE s.id = :id
            """)
    Optional<AssignmentSubmission> findByIdWithDetails(@Param("id") Long id);

    @Query(
            value = """
                    SELECT s FROM AssignmentSubmission s
                    JOIN FETCH s.assignment a
                    JOIN FETCH a.lesson l
                    JOIN FETCH l.section sec
                    JOIN FETCH sec.course c
                    JOIN FETCH c.instructor
                    JOIN FETCH s.enrollment e
                    JOIN FETCH e.user
                    LEFT JOIN FETCH s.gradedBy
                    WHERE a.id = :assignmentId
                    ORDER BY s.submittedAt DESC
                    """,
            countQuery = "SELECT COUNT(s) FROM AssignmentSubmission s WHERE s.assignment.id = :assignmentId"
    )
    Page<AssignmentSubmission> findByAssignmentId(
            @Param("assignmentId") Long assignmentId,
            Pageable pageable
    );

    @Query(
            value = """
                    SELECT s FROM AssignmentSubmission s
                    JOIN FETCH s.assignment a
                    JOIN FETCH a.lesson l
                    JOIN FETCH l.section sec
                    JOIN FETCH sec.course c
                    JOIN FETCH c.instructor
                    JOIN FETCH s.enrollment e
                    JOIN FETCH e.user
                    LEFT JOIN FETCH s.gradedBy
                    WHERE a.id = :assignmentId
                    AND s.status = :status
                    ORDER BY s.submittedAt DESC
                    """,
            countQuery = """
                    SELECT COUNT(s) FROM AssignmentSubmission s
                    WHERE s.assignment.id = :assignmentId
                    AND s.status = :status
                    """
    )
    Page<AssignmentSubmission> findByAssignmentIdAndStatus(
            @Param("assignmentId") Long assignmentId,
            @Param("status") SubmissionStatus status,
            Pageable pageable
    );
}
