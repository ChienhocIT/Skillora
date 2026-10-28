package com.example.skillora_platform.quiz.service;

import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.skillora_platform.course.entity.Course;
import com.example.skillora_platform.course.service.CoursePermissionService;
import com.example.skillora_platform.course.service.LessonService;
import com.example.skillora_platform.enrollment.entity.Enrollment;
import com.example.skillora_platform.enrollment.service.LearningAccessService;
import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.quiz.dto.QuizAttemptResponse;
import com.example.skillora_platform.quiz.entity.Quiz;
import com.example.skillora_platform.quiz.repository.QuizAttemptRepository;
import com.example.skillora_platform.user.entity.User;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class QuizHistoryService {

    private final QuizService quizService;
    private final CoursePermissionService permissionService;
    private final LessonService lessonService;
    private final LearningAccessService learningAccessService;
    private final QuizAttemptRepository quizAttemptRepository;

    @Transactional(readOnly = true)
    public Set<Long> passedLessonIds(Long enrollmentId) {
        return quizAttemptRepository.findPassedLessonIds(enrollmentId);
    }

    @Transactional(readOnly = true)
    public List<QuizAttemptResponse> myAttempts(Long quizId, String actorEmail) {
        User actor = permissionService.requireActor(actorEmail);
        Quiz quiz = quizService.findQuizWithLesson(quizId);
        Course course = quiz.getLesson().getSection().getCourse();
        if (!lessonService.isPublishedLearningContent(quiz.getLesson())) {
            throw new BusinessException("Enrollment required to view quiz attempts", HttpStatus.FORBIDDEN);
        }
        Enrollment enrollment = learningAccessService.getActiveEnrollment(actor.getId(), course.getId());
        if (enrollment == null) {
            throw new BusinessException("Enrollment required to view quiz attempts", HttpStatus.FORBIDDEN);
        }

        return quizAttemptRepository.findByEnrollmentIdAndQuizIdOrderByAttemptNoDesc(enrollment.getId(), quiz.getId())
                .stream()
                .map(attempt -> quizService.toAttemptResponse(attempt, false))
                .toList();
    }
}
