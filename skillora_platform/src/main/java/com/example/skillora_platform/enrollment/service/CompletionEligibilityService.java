package com.example.skillora_platform.enrollment.service;

import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.skillora_platform.assignment.service.AssignmentSubmissionService;
import com.example.skillora_platform.course.entity.Lesson;
import com.example.skillora_platform.course.repository.LessonRepository;
import com.example.skillora_platform.enrollment.entity.Enrollment;
import com.example.skillora_platform.enrollment.entity.LessonProgress;
import com.example.skillora_platform.enrollment.repository.LessonProgressRepository;
import com.example.skillora_platform.quiz.service.QuizHistoryService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CompletionEligibilityService {
    private final LessonRepository lessonRepository;
    private final LessonProgressRepository progressRepository;
    private final QuizHistoryService quizHistoryService;
    private final AssignmentSubmissionService assignmentSubmissionService;

    @Transactional(readOnly = true)
    public Assessment assess(Enrollment enrollment) {
        var lessons = lessonRepository.findPublishedLessonsByCourseId(enrollment.getCourse().getId());
        Set<Long> completed = progressRepository.findByEnrollmentIdOrderByLessonIdAsc(enrollment.getId()).stream()
                .filter(LessonProgress::isCompleted).map(progress -> progress.getLesson().getId())
                .collect(Collectors.toSet());
        Set<Long> passedQuizzes = quizHistoryService.passedLessonIds(enrollment.getId());
        Set<Long> passedAssignments = assignmentSubmissionService.passedLessonIds(enrollment.getId());
        long count = lessons.stream().filter(lesson -> completed.contains(lesson.getId()))
                .filter(lesson -> assessmentPassed(lesson, passedQuizzes, passedAssignments)).count();
        return new Assessment(count, lessons.size());
    }

    private boolean assessmentPassed(Lesson lesson, Set<Long> quizzes, Set<Long> assignments) {
        return switch (lesson.getType()) {
            case QUIZ -> quizzes.contains(lesson.getId());
            case ASSIGNMENT -> assignments.contains(lesson.getId());
            default -> true;
        };
    }

    public record Assessment(long completedLessons, int totalLessons) {
        public boolean eligible() { return totalLessons > 0 && completedLessons == totalLessons; }
    }
}
