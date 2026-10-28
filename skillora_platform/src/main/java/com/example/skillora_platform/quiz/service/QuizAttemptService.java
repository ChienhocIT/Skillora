package com.example.skillora_platform.quiz.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.skillora_platform.course.service.CoursePermissionService;
import com.example.skillora_platform.course.service.LessonService;
import com.example.skillora_platform.enrollment.entity.Enrollment;
import com.example.skillora_platform.enrollment.entity.EnrollmentStatus;
import com.example.skillora_platform.enrollment.service.LearningAccessService;
import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.quiz.dto.QuizAttemptResponse;
import com.example.skillora_platform.quiz.entity.Quiz;
import com.example.skillora_platform.quiz.entity.QuizAttempt;
import com.example.skillora_platform.quiz.repository.QuizAttemptRepository;
import com.example.skillora_platform.user.entity.User;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class QuizAttemptService {

    private final QuizService quizService;
    private final CoursePermissionService permissionService;
    private final LessonService lessonService;
    private final LearningAccessService learningAccessService;
    private final QuizAttemptRepository repository;
    private final EntityManager entityManager;

    @Transactional
    public QuizAttemptResponse start(Long quizId, String actorEmail) {
        Session session = lockSession(quizId, actorEmail);
        var current = repository.findFirstByEnrollmentIdAndQuizIdOrderByAttemptNoDesc(
                session.enrollment().getId(), quizId);
        if (current.isPresent() && current.get().getSubmittedAt() == null && !current.get().isExpired()) {
            return quizService.toAttemptResponse(current.get(), false);
        }
        long count = current.map(QuizAttempt::getAttemptNo).orElse(0);
        if (session.quiz().getMaxAttempts() != null && count >= session.quiz().getMaxAttempts()) {
            throw new BusinessException("Maximum quiz attempts reached", HttpStatus.CONFLICT);
        }
        if (quizService.loadQuestions(session.quiz()).isEmpty()) {
            throw new BusinessException("Quiz has no questions", HttpStatus.CONFLICT);
        }
        LocalDateTime now = LocalDateTime.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        QuizAttempt attempt = QuizAttempt.builder()
                .quiz(session.quiz()).enrollment(session.enrollment()).user(session.actor())
                .attemptNo((int) count + 1).startedAt(now)
                .deadlineAt(session.quiz().getTimeLimitMins() == null ? null
                        : now.plusMinutes(session.quiz().getTimeLimitMins()))
                .score(BigDecimal.ZERO).passed(false).build();
        return quizService.toAttemptResponse(repository.saveAndFlush(attempt), false);
    }

    @Transactional
    public QuizAttempt requireAttempt(Long quizId, Long attemptId, String actorEmail) {
        Session session = lockSession(quizId, actorEmail);
        return repository.findByIdAndEnrollmentIdAndQuizId(attemptId, session.enrollment().getId(), quizId)
                .orElseThrow(() -> new BusinessException("Quiz attempt not found", HttpStatus.NOT_FOUND));
    }

    private Session lockSession(Long quizId, String actorEmail) {
        User actor = permissionService.requireActor(actorEmail);
        Quiz quiz = quizService.findQuizWithLesson(quizId);
        Enrollment enrollment = learningAccessService.getActiveEnrollment(actor.getId(),
                quiz.getLesson().getSection().getCourse().getId());
        if (enrollment == null || !lessonService.isPublishedLearningContent(quiz.getLesson())) {
            throw new BusinessException("Enrollment required to attempt this quiz", HttpStatus.FORBIDDEN);
        }
        // All starts and submissions for this enrollment serialize, including the first attempt.
        entityManager.refresh(enrollment, LockModeType.PESSIMISTIC_WRITE);
        if (enrollment.getStatus() != EnrollmentStatus.ACTIVE
                && enrollment.getStatus() != EnrollmentStatus.COMPLETED) {
            throw new BusinessException("Enrollment required to attempt this quiz", HttpStatus.FORBIDDEN);
        }
        quiz = quizService.lockQuizForAttempt(quizId);
        if (!enrollment.getCourse().getId().equals(quiz.getLesson().getSection().getCourse().getId())
                || !lessonService.isPublishedLearningContent(quiz.getLesson())) {
            throw new BusinessException("Enrollment required to attempt this quiz", HttpStatus.FORBIDDEN);
        }
        return new Session(quiz, enrollment, actor);
    }

    private record Session(Quiz quiz, Enrollment enrollment, User actor) { }
}
