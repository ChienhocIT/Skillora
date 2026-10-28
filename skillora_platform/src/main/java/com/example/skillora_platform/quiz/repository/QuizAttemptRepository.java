package com.example.skillora_platform.quiz.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.skillora_platform.quiz.entity.QuizAttempt;

public interface QuizAttemptRepository extends JpaRepository<QuizAttempt, Long> {

    @Query("SELECT DISTINCT a.quiz.lesson.id FROM QuizAttempt a WHERE a.enrollment.id = :enrollmentId AND a.passed = true AND a.submittedAt IS NOT NULL")
    Set<Long> findPassedLessonIds(@Param("enrollmentId") Long enrollmentId);

    long countByEnrollmentIdAndQuizId(Long enrollmentId, Long quizId);

    @Lock(LockModeType.PESSIMISTIC_READ)
    Optional<QuizAttempt> findFirstByQuizIdOrderByIdAsc(Long quizId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<QuizAttempt> findFirstByEnrollmentIdAndQuizIdOrderByAttemptNoDesc(Long enrollmentId, Long quizId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<QuizAttempt> findByIdAndEnrollmentIdAndQuizId(Long id, Long enrollmentId, Long quizId);

    List<QuizAttempt> findByEnrollmentIdAndQuizIdOrderByAttemptNoDesc(Long enrollmentId, Long quizId);
}
