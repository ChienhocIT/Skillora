package com.example.skillora_platform.quiz.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Isolation;

import com.example.skillora_platform.enrollment.entity.Enrollment;
import com.example.skillora_platform.enrollment.entity.EnrollmentStatus;
import com.example.skillora_platform.enrollment.service.LearningProgressService;
import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.quiz.dto.QuizAnswerSubmitRequest;
import com.example.skillora_platform.quiz.dto.QuizAttemptResponse;
import com.example.skillora_platform.quiz.dto.QuizSubmitRequest;
import com.example.skillora_platform.quiz.entity.AnswerOption;
import com.example.skillora_platform.quiz.entity.Question;
import com.example.skillora_platform.quiz.entity.QuestionType;
import com.example.skillora_platform.quiz.entity.Quiz;
import com.example.skillora_platform.quiz.entity.QuizAttempt;
import com.example.skillora_platform.quiz.entity.QuizAttemptAnswer;
import com.example.skillora_platform.quiz.entity.QuizAttemptAnswerOption;
import com.example.skillora_platform.quiz.entity.QuizAttemptAnswerOptionId;
import com.example.skillora_platform.quiz.repository.QuizAttemptRepository;
import com.example.skillora_platform.user.entity.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuizSubmissionService {

    private final QuizService quizService;
    private final QuizAttemptService attemptService;
    private final LearningProgressService learningProgressService;
    private final QuizAttemptRepository quizAttemptRepository;

    @Transactional(isolation = Isolation.READ_COMMITTED)
    public QuizAttemptResponse submit(Long quizId, QuizSubmitRequest request, String actorEmail) {
        QuizAttempt attempt = attemptService.requireAttempt(quizId, request.getAttemptId(), actorEmail);
        if (attempt.getSubmittedAt() != null) {
            return quizService.toAttemptResponse(attempt, true);
        }
        if (attempt.isExpired()) {
            throw new BusinessException("Quiz attempt has expired", HttpStatus.CONFLICT);
        }
        Quiz quiz = attempt.getQuiz();
        Enrollment enrollment = attempt.getEnrollment();
        User actor = attempt.getUser();
        List<Question> questions = quizService.loadQuestions(quiz);
        Map<Long, QuizAnswerSubmitRequest> submittedAnswers = validateAnswerCoverage(request, questions);
        attempt.setSubmittedAt(LocalDateTime.now());

        List<PendingSelection> pendingSelections = new ArrayList<>();
        BigDecimal earnedPoints = BigDecimal.ZERO;
        int totalPoints = 0;

        for (Question question : questions) {
            GradeResult grade = grade(question, submittedAnswers.get(question.getId()));
            totalPoints += question.getPoints();
            earnedPoints = earnedPoints.add(grade.pointsEarned());

            QuizAttemptAnswer attemptAnswer = QuizAttemptAnswer.builder()
                    .attempt(attempt)
                    .question(question)
                    .textAnswer(trimToNull(submittedAnswers.get(question.getId()).getTextAnswer()))
                    .correct(grade.correct())
                    .pointsEarned(grade.pointsEarned())
                    .build();
            attempt.getAnswers().add(attemptAnswer);
            grade.selectedOptions().forEach(option ->
                    pendingSelections.add(new PendingSelection(attemptAnswer, option)));
        }

        BigDecimal score = earnedPoints
                .multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(totalPoints), 2, RoundingMode.HALF_UP);
        attempt.setScore(score);
        attempt.setPassed(score.compareTo(BigDecimal.valueOf(quiz.getPassScore())) >= 0);

        QuizAttempt savedAttempt = quizAttemptRepository.saveAndFlush(attempt);
        attachSelectedOptions(pendingSelections);
        savedAttempt = quizAttemptRepository.save(savedAttempt);

        if (savedAttempt.isPassed() && enrollment.getStatus() == EnrollmentStatus.ACTIVE) {
            learningProgressService.updateProgress(enrollment.getId(), quiz.getLesson().getId(), null, true);
        }

        log.info("User {} submitted quiz {} attempt {} with score {}",
                actor.getId(), quiz.getId(), savedAttempt.getAttemptNo(), savedAttempt.getScore());
        return quizService.toAttemptResponse(savedAttempt, true);
    }

    private Map<Long, QuizAnswerSubmitRequest> validateAnswerCoverage(
            QuizSubmitRequest request,
            List<Question> questions
    ) {
        Map<Long, Question> questionById = questions.stream()
                .collect(Collectors.toMap(Question::getId, question -> question));
        Map<Long, QuizAnswerSubmitRequest> answerByQuestionId = new HashMap<>();

        for (QuizAnswerSubmitRequest answer : request.getAnswers()) {
            if (!questionById.containsKey(answer.getQuestionId())) {
                throw new BusinessException("Submitted answer contains unknown question id", HttpStatus.BAD_REQUEST);
            }
            if (answerByQuestionId.put(answer.getQuestionId(), answer) != null) {
                throw new BusinessException("Submitted answers contain duplicate question id", HttpStatus.BAD_REQUEST);
            }
        }

        if (answerByQuestionId.size() != questions.size()) {
            throw new BusinessException("Submitted answers must cover every quiz question", HttpStatus.BAD_REQUEST);
        }

        return answerByQuestionId;
    }

    private GradeResult grade(Question question, QuizAnswerSubmitRequest answer) {
        Map<Long, AnswerOption> optionById = question.getAnswerOptions().stream()
                .collect(Collectors.toMap(AnswerOption::getId, option -> option));
        Set<Long> selectedIds = selectedIds(answer);
        List<AnswerOption> selectedOptions = selectedIds.stream()
                .map(optionId -> findOption(optionById, optionId))
                .toList();

        if (question.getType() == QuestionType.TEXT && (!selectedIds.isEmpty()
                || answer.getTextAnswer() == null || answer.getTextAnswer().isBlank())) {
            throw new BusinessException("Text questions require a text answer without selected options",
                    HttpStatus.BAD_REQUEST);
        }
        boolean correct = switch (question.getType()) {
            case SINGLE, TRUE_FALSE -> gradeSingleChoice(question, selectedIds);
            case MULTIPLE -> gradeMultipleChoice(question, selectedIds);
            case TEXT -> gradeText(question, answer.getTextAnswer());
        };
        BigDecimal pointsEarned = correct ? BigDecimal.valueOf(question.getPoints()) : BigDecimal.ZERO;
        return new GradeResult(correct, pointsEarned, selectedOptions);
    }

    private boolean gradeSingleChoice(Question question, Set<Long> selectedIds) {
        if (selectedIds.size() != 1) {
            throw new BusinessException("Single choice answers require exactly one selected option",
                    HttpStatus.BAD_REQUEST);
        }
        return selectedIds.equals(correctOptionIds(question));
    }

    private boolean gradeMultipleChoice(Question question, Set<Long> selectedIds) {
        if (selectedIds.isEmpty()) {
            throw new BusinessException("Multiple choice answers require at least one selected option",
                    HttpStatus.BAD_REQUEST);
        }
        return selectedIds.equals(correctOptionIds(question));
    }

    private boolean gradeText(Question question, String textAnswer) {
        String normalizedAnswer = normalize(textAnswer);
        return question.getAnswerOptions().stream()
                .filter(AnswerOption::isCorrect)
                .map(AnswerOption::getContent)
                .map(this::normalize)
                .anyMatch(normalizedAnswer::equals);
    }

    private Set<Long> selectedIds(QuizAnswerSubmitRequest answer) {
        List<Long> selectedOptionIds = answer.getSelectedOptionIds() == null
                ? List.of()
                : answer.getSelectedOptionIds();
        Set<Long> selectedIds = new HashSet<>(selectedOptionIds);
        if (selectedIds.size() != selectedOptionIds.size()) {
            throw new BusinessException("Selected option ids must be unique", HttpStatus.BAD_REQUEST);
        }
        return selectedIds;
    }

    private AnswerOption findOption(Map<Long, AnswerOption> optionById, Long optionId) {
        AnswerOption option = optionById.get(optionId);
        if (option == null) {
            throw new BusinessException("Submitted answer contains unknown option id", HttpStatus.BAD_REQUEST);
        }
        return option;
    }

    private Set<Long> correctOptionIds(Question question) {
        return question.getAnswerOptions().stream()
                .filter(AnswerOption::isCorrect)
                .map(AnswerOption::getId)
                .collect(Collectors.toSet());
    }

    private void attachSelectedOptions(List<PendingSelection> pendingSelections) {
        for (PendingSelection selection : pendingSelections) {
            QuizAttemptAnswer answer = selection.answer();
            AnswerOption option = selection.option();
            answer.getSelectedOptions().add(QuizAttemptAnswerOption.builder()
                    .id(new QuizAttemptAnswerOptionId(answer.getId(), option.getId()))
                    .attemptAnswer(answer)
                    .option(option)
                    .build());
        }
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private record GradeResult(boolean correct, BigDecimal pointsEarned, List<AnswerOption> selectedOptions) {
    }

    private record PendingSelection(QuizAttemptAnswer answer, AnswerOption option) {
    }
}
