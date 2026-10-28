package com.example.skillora_platform.quiz.service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.time.OffsetDateTime;
import java.time.ZoneId;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.skillora_platform.course.entity.Course;
import com.example.skillora_platform.course.entity.Lesson;
import com.example.skillora_platform.course.entity.LessonType;
import com.example.skillora_platform.course.service.CoursePermissionService;
import com.example.skillora_platform.course.service.LessonService;
import com.example.skillora_platform.enrollment.service.LearningAccessService;
import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.exception.ResourceNotFoundException;
import com.example.skillora_platform.quiz.dto.AnswerOptionRequest;
import com.example.skillora_platform.quiz.dto.AnswerOptionResponse;
import com.example.skillora_platform.quiz.dto.QuestionRequest;
import com.example.skillora_platform.quiz.dto.QuestionResponse;
import com.example.skillora_platform.quiz.dto.QuizAttemptAnswerResponse;
import com.example.skillora_platform.quiz.dto.QuizAttemptResponse;
import com.example.skillora_platform.quiz.dto.QuizCreateRequest;
import com.example.skillora_platform.quiz.dto.QuizResponse;
import com.example.skillora_platform.quiz.dto.QuizUpdateRequest;
import com.example.skillora_platform.quiz.entity.AnswerOption;
import com.example.skillora_platform.quiz.entity.Question;
import com.example.skillora_platform.quiz.entity.QuestionType;
import com.example.skillora_platform.quiz.entity.Quiz;
import com.example.skillora_platform.quiz.entity.QuizAttempt;
import com.example.skillora_platform.quiz.entity.QuizAttemptAnswer;
import com.example.skillora_platform.quiz.repository.QuestionRepository;
import com.example.skillora_platform.quiz.repository.QuizRepository;
import com.example.skillora_platform.quiz.repository.QuizAttemptRepository;
import com.example.skillora_platform.user.entity.User;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class QuizService {

    private static final int DEFAULT_PASS_SCORE = 70;
    private static final int DEFAULT_QUESTION_POINTS = 10;

    private final QuizRepository quizRepository;
    private final QuestionRepository questionRepository;
    private final LessonService lessonService;
    private final CoursePermissionService permissionService;
    private final LearningAccessService learningAccessService;
    private final QuizAttemptRepository attemptRepository;
    private final EntityManager entityManager;

    @Transactional
    public QuizResponse create(QuizCreateRequest request, String actorEmail) {
        Lesson lesson = lessonService.findActiveLesson(request.getLessonId());
        User actor = permissionService.requireInstructorOrAdmin(actorEmail);
        permissionService.requireOwnerOrAdmin(lesson.getSection().getCourse(), actor);
        validateQuizLesson(lesson);

        if (quizRepository.existsByLessonId(lesson.getId())) {
            throw new BusinessException("Quiz already exists for this lesson", HttpStatus.CONFLICT);
        }

        Quiz quiz = Quiz.builder()
                .lesson(lesson)
                .title(request.getTitle().trim())
                .description(trimToNull(request.getDescription()))
                .passScore(defaultPassScore(request.getPassScore()))
                .timeLimitMins(request.getTimeLimitMins())
                .maxAttempts(request.getMaxAttempts())
                .shuffleQuestions(Boolean.TRUE.equals(request.getShuffleQuestions()))
                .build();
        quiz.getQuestions().addAll(buildQuestions(quiz, request.getQuestions()));

        return toResponse(quizRepository.save(quiz), true);
    }

    @Transactional(readOnly = true)
    public QuizResponse get(Long id, String actorEmail) {
        Quiz quiz = findQuizWithLesson(id);
        boolean includeCorrect = requireReadAccess(quiz, actorEmail);
        boolean includeQuestions = includeCorrect;
        if (!includeCorrect) {
            User actor = permissionService.requireActor(actorEmail);
            var enrollment = learningAccessService.getActiveEnrollment(actor.getId(),
                    quiz.getLesson().getSection().getCourse().getId());
            includeQuestions = attemptRepository.findByEnrollmentIdAndQuizIdOrderByAttemptNoDesc(
                            enrollment.getId(), id).stream().findFirst()
                    .filter(attempt -> attempt.getSubmittedAt() == null && !attempt.isExpired()).isPresent();
        }
        return toResponse(quiz, includeCorrect, includeQuestions);
    }

    @Transactional
    public QuizResponse update(Long id, QuizUpdateRequest request, String actorEmail) {
        Quiz quiz = findQuizWithLesson(id);
        User actor = permissionService.requireInstructorOrAdmin(actorEmail);
        permissionService.requireOwnerOrAdmin(quiz.getLesson().getSection().getCourse(), actor);

        entityManager.refresh(quiz, LockModeType.PESSIMISTIC_WRITE);
        if (attemptRepository.findFirstByQuizIdOrderByIdAsc(id).isPresent()) {
            throw new BusinessException("Quiz with attempts cannot be edited", HttpStatus.CONFLICT);
        }

        Lesson lesson = lessonService.findActiveLesson(request.getLessonId());
        permissionService.requireOwnerOrAdmin(lesson.getSection().getCourse(), actor);
        validateQuizLesson(lesson);

        if (quizRepository.existsByLessonIdAndIdNot(lesson.getId(), id)) {
            throw new BusinessException("Quiz already exists for this lesson", HttpStatus.CONFLICT);
        }

        quiz.setLesson(lesson);
        quiz.setTitle(request.getTitle().trim());
        quiz.setDescription(trimToNull(request.getDescription()));
        quiz.setPassScore(defaultPassScore(request.getPassScore()));
        quiz.setTimeLimitMins(request.getTimeLimitMins());
        quiz.setMaxAttempts(request.getMaxAttempts());
        quiz.setShuffleQuestions(Boolean.TRUE.equals(request.getShuffleQuestions()));
        quiz.getQuestions().clear();
        quizRepository.saveAndFlush(quiz);
        quiz.getQuestions().addAll(buildQuestions(quiz, request.getQuestions()));

        return toResponse(quizRepository.save(quiz), true);
    }

    @Transactional(readOnly = true)
    public Quiz findQuizWithLesson(Long id) {
        return quizRepository.findByIdWithLesson(id)
                .orElseThrow(() -> new ResourceNotFoundException("Quiz not found with id: " + id));
    }

    @Transactional
    public Quiz lockQuizForAttempt(Long id) {
        Quiz quiz = findQuizWithLesson(id);
        entityManager.refresh(quiz, LockModeType.PESSIMISTIC_WRITE);
        return quiz;
    }

    @Transactional(readOnly = true)
    public List<Question> loadQuestions(Quiz quiz) {
        return questionRepository.findByQuizIdOrderByOrderIndexAscIdAsc(quiz.getId());
    }

    public QuizResponse toResponse(Quiz quiz, boolean includeCorrect) {
        return toResponse(quiz, includeCorrect, true);
    }

    private QuizResponse toResponse(Quiz quiz, boolean includeCorrect, boolean includeQuestions) {
        List<Question> source = loadQuestions(quiz);
        List<QuestionResponse> questions = (includeQuestions ? source.stream() : java.util.stream.Stream.<Question>empty())
                .map(question -> toQuestionResponse(question, includeCorrect))
                .toList();
        return QuizResponse.builder()
                .id(quiz.getId())
                .lessonId(quiz.getLesson().getId())
                .courseId(quiz.getLesson().getSection().getCourse().getId())
                .title(quiz.getTitle())
                .description(quiz.getDescription())
                .passScore(quiz.getPassScore())
                .timeLimitMins(quiz.getTimeLimitMins())
                .maxAttempts(quiz.getMaxAttempts())
                .shuffleQuestions(quiz.isShuffleQuestions())
                .questionCount(source.size())
                .questions(questions)
                .createdAt(quiz.getCreatedAt())
                .updatedAt(quiz.getUpdatedAt())
                .build();
    }

    public QuizAttemptResponse toAttemptResponse(QuizAttempt attempt, boolean includeAnswers) {
        List<QuizAttemptAnswerResponse> answers = includeAnswers ? attempt.getAnswers().stream()
                .map(this::toAttemptAnswerResponse)
                .toList() : null;
        return QuizAttemptResponse.builder()
                .id(attempt.getId())
                .quizId(attempt.getQuiz().getId())
                .enrollmentId(attempt.getEnrollment().getId())
                .userId(attempt.getUser().getId())
                .attemptNo(attempt.getAttemptNo())
                .score(attempt.getScore())
                .passed(attempt.isPassed())
                .startedAt(attempt.getStartedAt())
                .submittedAt(attempt.getSubmittedAt())
                .status(attempt.getSubmittedAt() != null ? "SUBMITTED" : attempt.isExpired() ? "EXPIRED" : "IN_PROGRESS")
                .deadlineAt(attempt.getDeadlineAt() == null ? null
                        : attempt.getDeadlineAt().atZone(ZoneId.systemDefault()).toOffsetDateTime())
                .serverTime(OffsetDateTime.now())
                .answers(answers)
                .build();
    }

    private boolean requireReadAccess(Quiz quiz, String actorEmail) {
        User actor = permissionService.requireActor(actorEmail);
        Course course = quiz.getLesson().getSection().getCourse();
        if (permissionService.canManage(course, actor)) {
            return true;
        }
        if (lessonService.isPublishedLearningContent(quiz.getLesson())
                && learningAccessService.hasActiveEnrollment(actor.getId(), course.getId())) {
            return false;
        }
        throw new BusinessException("Enrollment required to access this quiz", HttpStatus.FORBIDDEN);
    }

    private List<Question> buildQuestions(Quiz quiz, List<QuestionRequest> requests) {
        validateQuestionOrder(requests);
        List<Question> questions = new ArrayList<>();
        for (int i = 0; i < requests.size(); i++) {
            QuestionRequest request = requests.get(i);
            int orderIndex = request.getOrderIndex() == null ? i : request.getOrderIndex();
            validateQuestionRequest(request);

            Question question = Question.builder()
                    .quiz(quiz)
                    .content(request.getContent().trim())
                    .type(request.getType())
                    .points(request.getPoints() == null ? DEFAULT_QUESTION_POINTS : request.getPoints())
                    .orderIndex(orderIndex)
                    .explanation(trimToNull(request.getExplanation()))
                    .build();
            question.getAnswerOptions().addAll(buildAnswerOptions(question, request.getAnswerOptions()));
            questions.add(question);
        }
        return questions;
    }

    private List<AnswerOption> buildAnswerOptions(Question question, List<AnswerOptionRequest> requests) {
        List<AnswerOption> options = new ArrayList<>();
        Set<Integer> orderIndexes = new HashSet<>();
        for (int i = 0; i < requests.size(); i++) {
            AnswerOptionRequest request = requests.get(i);
            int orderIndex = request.getOrderIndex() == null ? i : request.getOrderIndex();
            if (!orderIndexes.add(orderIndex)) {
                throw new BusinessException("Answer option order index must be unique", HttpStatus.BAD_REQUEST);
            }
            options.add(AnswerOption.builder()
                    .question(question)
                    .content(request.getContent().trim())
                    .correct(Boolean.TRUE.equals(request.getCorrect()))
                    .orderIndex(orderIndex)
                    .build());
        }
        return options;
    }

    private void validateQuestionRequest(QuestionRequest request) {
        List<AnswerOptionRequest> options = request.getAnswerOptions() == null ? List.of() : request.getAnswerOptions();
        long correctCount = options.stream()
                .filter(option -> Boolean.TRUE.equals(option.getCorrect()))
                .count();

        if (request.getType() != QuestionType.TEXT && options.size() < 2) {
            throw new BusinessException("Non-text questions require at least two answer options",
                    HttpStatus.BAD_REQUEST);
        }

        if (request.getType() == QuestionType.SINGLE && correctCount != 1) {
            throw new BusinessException("Single choice questions require exactly one correct option",
                    HttpStatus.BAD_REQUEST);
        }
        if (request.getType() == QuestionType.TRUE_FALSE && (options.size() != 2 || correctCount != 1)) {
            throw new BusinessException("True/false questions require exactly two options and one correct option",
                    HttpStatus.BAD_REQUEST);
        }
        if (request.getType() == QuestionType.MULTIPLE && correctCount < 1) {
            throw new BusinessException("Multiple choice questions require at least one correct option",
                    HttpStatus.BAD_REQUEST);
        }
        if (request.getType() == QuestionType.TEXT && correctCount < 1) {
            throw new BusinessException("Text questions require at least one correct answer option",
                    HttpStatus.BAD_REQUEST);
        }
    }

    private void validateQuestionOrder(List<QuestionRequest> requests) {
        Set<Integer> orderIndexes = new HashSet<>();
        for (int i = 0; i < requests.size(); i++) {
            int orderIndex = requests.get(i).getOrderIndex() == null ? i : requests.get(i).getOrderIndex();
            if (!orderIndexes.add(orderIndex)) {
                throw new BusinessException("Question order index must be unique", HttpStatus.BAD_REQUEST);
            }
        }
    }

    private void validateQuizLesson(Lesson lesson) {
        if (lesson.getType() != LessonType.QUIZ) {
            throw new BusinessException("Quiz can only be attached to a QUIZ lesson", HttpStatus.BAD_REQUEST);
        }
    }

    private QuestionResponse toQuestionResponse(Question question, boolean includeCorrect) {
        List<AnswerOptionResponse> options = (!includeCorrect && question.getType() == QuestionType.TEXT
                ? java.util.stream.Stream.<AnswerOption>empty() : question.getAnswerOptions().stream())
                .map(option -> AnswerOptionResponse.builder()
                        .id(option.getId())
                        .content(option.getContent())
                        .correct(includeCorrect ? option.isCorrect() : null)
                        .orderIndex(option.getOrderIndex())
                        .build())
                .toList();
        return QuestionResponse.builder()
                .id(question.getId())
                .content(question.getContent())
                .type(question.getType())
                .points(question.getPoints())
                .orderIndex(question.getOrderIndex())
                .explanation(includeCorrect ? question.getExplanation() : null)
                .answerOptions(options)
                .build();
    }

    private QuizAttemptAnswerResponse toAttemptAnswerResponse(QuizAttemptAnswer answer) {
        List<Long> selectedOptionIds = answer.getSelectedOptions().stream()
                .map(selectedOption -> selectedOption.getOption().getId())
                .toList();
        return QuizAttemptAnswerResponse.builder()
                .questionId(answer.getQuestion().getId())
                .correct(answer.getCorrect())
                .pointsEarned(answer.getPointsEarned())
                .selectedOptionIds(selectedOptionIds)
                .textAnswer(answer.getTextAnswer())
                .build();
    }

    private int defaultPassScore(Integer value) {
        return value == null ? DEFAULT_PASS_SCORE : value;
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
