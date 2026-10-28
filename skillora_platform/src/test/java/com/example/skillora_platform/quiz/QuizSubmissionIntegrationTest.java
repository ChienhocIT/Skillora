package com.example.skillora_platform.quiz;

import java.util.HashSet;
import java.util.Set;
import java.time.LocalDateTime;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultMatcher;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.skillora_platform.admin.repository.AuditLogRepository;
import com.example.skillora_platform.course.repository.CategoryRepository;
import com.example.skillora_platform.course.repository.CourseOutcomeRepository;
import com.example.skillora_platform.course.repository.CourseRepository;
import com.example.skillora_platform.course.repository.CourseRequirementRepository;
import com.example.skillora_platform.course.repository.LessonRepository;
import com.example.skillora_platform.course.repository.LessonResourceRepository;
import com.example.skillora_platform.course.repository.LessonVideoRepository;
import com.example.skillora_platform.course.repository.SectionRepository;
import com.example.skillora_platform.enrollment.repository.CourseCertificateRepository;
import com.example.skillora_platform.enrollment.repository.EnrollmentRepository;
import com.example.skillora_platform.enrollment.repository.LessonProgressRepository;
import com.example.skillora_platform.notification.repository.NotificationRepository;
import com.example.skillora_platform.quiz.repository.AnswerOptionRepository;
import com.example.skillora_platform.quiz.repository.QuestionRepository;
import com.example.skillora_platform.quiz.repository.QuizAttemptAnswerOptionRepository;
import com.example.skillora_platform.quiz.repository.QuizAttemptAnswerRepository;
import com.example.skillora_platform.quiz.repository.QuizAttemptRepository;
import com.example.skillora_platform.quiz.service.QuizAttemptService;
import com.example.skillora_platform.quiz.service.QuizSubmissionService;
import com.example.skillora_platform.quiz.dto.QuizSubmitRequest;
import com.example.skillora_platform.quiz.repository.QuizRepository;
import com.example.skillora_platform.user.entity.Role;
import com.example.skillora_platform.user.entity.RoleName;
import com.example.skillora_platform.user.entity.User;
import com.example.skillora_platform.user.entity.UserStatus;
import com.example.skillora_platform.user.repository.InstructorProfileRepository;
import com.example.skillora_platform.user.repository.PasswordResetTokenRepository;
import com.example.skillora_platform.user.repository.RefreshTokenRepository;
import com.example.skillora_platform.user.repository.RoleRepository;
import com.example.skillora_platform.user.repository.UserProfileRepository;
import com.example.skillora_platform.user.repository.UserRepository;
import com.example.skillora_platform.user.service.JwtService;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "skillora.video.bunny.library-id=12345",
                "skillora.video.bunny.api-key=test-secret",
                "skillora.video.bunny.upload-expiration=PT2H"
        }
)
@ActiveProfiles("test")
@AutoConfigureMockMvc
class QuizSubmissionIntegrationTest {

    private static final String PASSWORD = "Password@123";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private UserProfileRepository userProfileRepository;
    @Autowired private InstructorProfileRepository instructorProfileRepository;
    @Autowired private RefreshTokenRepository refreshTokenRepository;
    @Autowired private PasswordResetTokenRepository passwordResetTokenRepository;
    @Autowired private CategoryRepository categoryRepository;
    @Autowired private CourseRepository courseRepository;
    @Autowired private CourseRequirementRepository courseRequirementRepository;
    @Autowired private CourseOutcomeRepository courseOutcomeRepository;
    @Autowired private SectionRepository sectionRepository;
    @Autowired private LessonRepository lessonRepository;
    @Autowired private LessonVideoRepository lessonVideoRepository;
    @Autowired private LessonResourceRepository lessonResourceRepository;
    @Autowired private EnrollmentRepository enrollmentRepository;
    @Autowired private LessonProgressRepository lessonProgressRepository;
    @Autowired private CourseCertificateRepository courseCertificateRepository;
    @Autowired private QuizRepository quizRepository;
    @Autowired private QuestionRepository questionRepository;
    @Autowired private AnswerOptionRepository answerOptionRepository;
    @Autowired private QuizAttemptRepository quizAttemptRepository;
    @Autowired private QuizAttemptService attemptService;
    @Autowired private QuizSubmissionService submissionService;
    @Autowired private QuizAttemptAnswerRepository quizAttemptAnswerRepository;
    @Autowired private QuizAttemptAnswerOptionRepository quizAttemptAnswerOptionRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private AuditLogRepository auditLogRepository;

    private User admin;
    private User instructor;
    private User otherInstructor;
    private User student;
    private User otherStudent;
    private String adminToken;
    private String instructorToken;
    private String otherInstructorToken;
    private String studentToken;
    private String otherStudentToken;

    @BeforeEach
    void setUp() {
        cleanDatabase();
        admin = createUser("admin@example.com", "Admin User", RoleName.ADMIN);
        instructor = createUser("instructor@example.com", "Instructor User", RoleName.INSTRUCTOR);
        otherInstructor = createUser("other.instructor@example.com", "Other Instructor", RoleName.INSTRUCTOR);
        student = createUser("student@example.com", "Student User", RoleName.STUDENT);
        otherStudent = createUser("other.student@example.com", "Other Student", RoleName.STUDENT);
        adminToken = token(admin);
        instructorToken = token(instructor);
        otherInstructorToken = token(otherInstructor);
        studentToken = token(student);
        otherStudentToken = token(otherStudent);
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
    }

    @Test
    void shouldCreateUpdateAndEnforceQuizOwnership() throws Exception {
        Long lessonId = createPublishedQuizCourse("Ownership Course");
        JsonNode quiz = createSingleQuestionQuiz(lessonId, 2, instructorToken);
        Long quizId = quiz.at("/data/id").asLong();

        mockMvc.perform(put("/api/v1/quizzes/{id}", quizId)
                        .header("Authorization", bearer(otherInstructorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(singleQuizJson(lessonId, "Hacked Quiz", 2)))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/v1/quizzes/{id}", quizId)
                        .header("Authorization", bearer(instructorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(singleQuizJson(lessonId, "Updated Quiz", 2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.title").value("Updated Quiz"))
                .andExpect(jsonPath("$.data.questions", hasSize(1)))
                .andExpect(jsonPath("$.data.questions[0].answerOptions[0].correct").value(true));
    }

    @Test
    void shouldHideCorrectAnswersForStudentAndDenyNonEnrolledAccess() throws Exception {
        Long lessonId = createPublishedQuizCourse("Access Quiz Course");
        JsonNode quiz = createSingleQuestionQuiz(lessonId, 2, instructorToken);
        Long quizId = quiz.at("/data/id").asLong();

        mockMvc.perform(get("/api/v1/quizzes/{id}", quizId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isForbidden());

        Long courseId = quiz.at("/data/courseId").asLong();
        enroll(courseId, studentToken);

        mockMvc.perform(get("/api/v1/quizzes/{id}", quizId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.questions", hasSize(0)));
        startAttempt(quizId, studentToken);
        mockMvc.perform(get("/api/v1/quizzes/{id}", quizId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions[0].answerOptions[0].correct").doesNotExist())
                .andExpect(jsonPath("$.data.questions[0].answerOptions[1].correct").doesNotExist())
                .andExpect(jsonPath("$.data.questions[0].explanation").doesNotExist());

        mockMvc.perform(get("/api/v1/quizzes/{id}", quizId)
                        .header("Authorization", bearer(instructorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questions[0].answerOptions[0].correct").value(true));
    }

    @Test
    void shouldDenyEnrolledStudentAccessToQuizOnUnpublishedLesson() throws Exception {
        Long lessonId = createPublishedQuizCourse("Hidden Quiz Course", false);
        JsonNode quiz = createSingleQuestionQuiz(lessonId, 2, instructorToken);
        Long quizId = quiz.at("/data/id").asLong();
        Long courseId = quiz.at("/data/courseId").asLong();
        enroll(courseId, studentToken);

        mockMvc.perform(get("/api/v1/quizzes/{id}", quizId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/quizzes/{id}/submit", quizId)
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(wrongSingleSubmissionJson(quiz)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldGradeAllQuestionTypesAndCompleteQuizLesson() throws Exception {
        Long lessonId = createPublishedQuizCourse("Grading Course");
        JsonNode quiz = createFullQuiz(lessonId, 2, instructorToken);
        Long quizId = quiz.at("/data/id").asLong();
        Long courseId = quiz.at("/data/courseId").asLong();
        Long enrollmentId = enroll(courseId, studentToken);

        mockMvc.perform(post("/api/v1/quizzes/{id}/submit", quizId)
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(withAttempt(quiz, correctSubmissionJson(quiz))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.score").value(100.00))
                .andExpect(jsonPath("$.data.passed").value(true))
                .andExpect(jsonPath("$.data.answers", hasSize(4)))
                .andExpect(jsonPath("$.data.answers[0].correct").value(true))
                .andExpect(jsonPath("$.data.answers[3].textAnswer").value("spring boot"));

        mockMvc.perform(get("/api/v1/enrollments/{id}/progress", enrollmentId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].lessonId").value(lessonId))
                .andExpect(jsonPath("$.data[0].completed").value(true));
    }

    @Test
    void shouldEnforceMaxAttemptsAndReturnAttemptHistory() throws Exception {
        Long lessonId = createPublishedQuizCourse("Attempts Course");
        JsonNode quiz = createSingleQuestionQuiz(lessonId, 1, instructorToken);
        Long quizId = quiz.at("/data/id").asLong();
        Long courseId = quiz.at("/data/courseId").asLong();
        enroll(courseId, studentToken);

        mockMvc.perform(post("/api/v1/quizzes/{id}/submit", quizId)
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(withAttempt(quiz, wrongSingleSubmissionJson(quiz))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.score").value(0.00))
                .andExpect(jsonPath("$.data.passed").value(false));

        mockMvc.perform(get("/api/v1/quizzes/{id}/attempts", quizId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].attemptNo").value(1))
                .andExpect(jsonPath("$.data[0].answers").doesNotExist());

        mockMvc.perform(post("/api/v1/quizzes/{id}/attempts/start", quizId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldRejectUnknownQuestionAndOptionIds() throws Exception {
        Long lessonId = createPublishedQuizCourse("Validation Course");
        JsonNode quiz = createSingleQuestionQuiz(lessonId, 2, instructorToken);
        Long quizId = quiz.at("/data/id").asLong();
        Long courseId = quiz.at("/data/courseId").asLong();
        Long questionId = quiz.at("/data/questions/0/id").asLong();
        enroll(courseId, studentToken);
        Long attemptId = startAttempt(quizId, studentToken).at("/data/id").asLong();

        mockMvc.perform(post("/api/v1/quizzes/{id}/submit", quizId)
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "attemptId": %d, "answers": [{ "questionId": 999999, "selectedOptionIds": [1] }] }
                                """.formatted(attemptId)))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/quizzes/{id}/submit", quizId)
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "attemptId": %d, "answers": [{ "questionId": %d, "selectedOptionIds": [999999] }] }
                                """.formatted(attemptId, questionId)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void shouldDenyAttemptsForNonEnrolledStudent() throws Exception {
        Long lessonId = createPublishedQuizCourse("History Access Course");
        JsonNode quiz = createSingleQuestionQuiz(lessonId, 2, instructorToken);
        Long quizId = quiz.at("/data/id").asLong();

        mockMvc.perform(get("/api/v1/quizzes/{id}/attempts", quizId)
                        .header("Authorization", bearer(otherStudentToken)))
                .andExpect(status().isForbidden());
    }

    private JsonNode startAttempt(Long quizId, String accessToken) throws Exception {
        return postJson("/api/v1/quizzes/" + quizId + "/attempts/start", "{}", accessToken, status().isOk());
    }

    private String withAttempt(JsonNode quiz, String raw) throws Exception {
        var request = (com.fasterxml.jackson.databind.node.ObjectNode) objectMapper.readTree(raw);
        request.put("attemptId", startAttempt(quiz.at("/data/id").asLong(), studentToken).at("/data/id").asLong());
        return objectMapper.writeValueAsString(request);
    }

    @Test
    void shouldResumeOneTimedAttemptAndHideTextKeys() throws Exception {
        Long lessonId = createPublishedQuizCourse("Timed TEXT course");
        var body = (com.fasterxml.jackson.databind.node.ObjectNode) objectMapper.readTree(fullQuizJson(lessonId, 2));
        body.put("timeLimitMins", 5);
        JsonNode quiz = postJson("/api/v1/quizzes", objectMapper.writeValueAsString(body), instructorToken,
                status().isCreated());
        Long id = quiz.at("/data/id").asLong();
        enroll(quiz.at("/data/courseId").asLong(), studentToken);
        JsonNode first = startAttempt(id, studentToken);
        JsonNode resumed = startAttempt(id, studentToken);
        org.assertj.core.api.Assertions.assertThat(resumed.at("/data/id")).isEqualTo(first.at("/data/id"));
        org.assertj.core.api.Assertions.assertThat(resumed.at("/data/deadlineAt")).isEqualTo(first.at("/data/deadlineAt"));
        mockMvc.perform(get("/api/v1/quizzes/{id}", id).header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.questionCount").value(4))
                .andExpect(jsonPath("$.data.questions[3].answerOptions", hasSize(0)));
        var before = quizAttemptRepository.findById(first.at("/data/id").asLong()).orElseThrow();
        org.assertj.core.api.Assertions.assertThat(before.getDeadlineAt()).isEqualTo(before.getStartedAt().plusMinutes(5));
        mockMvc.perform(put("/api/v1/quizzes/{id}", id).header("Authorization", bearer(instructorToken))
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isConflict());
        // An incorrect TEXT answer earns no credit; an options payload cannot impersonate a text response.
        var submission = (com.fasterxml.jackson.databind.node.ObjectNode) objectMapper.readTree(correctSubmissionJson(quiz));
        submission.put("attemptId", before.getId());
        ((com.fasterxml.jackson.databind.node.ObjectNode) submission.at("/answers/3")).put("textAnswer", "wrong");
        JsonNode result = postJson("/api/v1/quizzes/" + id + "/submit", objectMapper.writeValueAsString(submission),
                studentToken, status().isCreated());
        org.assertj.core.api.Assertions.assertThat(result.at("/data/score").decimalValue()).isEqualByComparingTo("80");
        mockMvc.perform(put("/api/v1/quizzes/{id}", id).header("Authorization", bearer(instructorToken))
                        .contentType(MediaType.APPLICATION_JSON).content(objectMapper.writeValueAsString(body)))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldExpireAttemptConsumeQuotaAndNeverRecordLateAnswers() throws Exception {
        JsonNode quiz = createSingleQuestionQuiz(createPublishedQuizCourse("Expiry course"), 1, instructorToken);
        Long id = quiz.at("/data/id").asLong();
        enroll(quiz.at("/data/courseId").asLong(), studentToken);
        Long attemptId = startAttempt(id, studentToken).at("/data/id").asLong();
        var attempt = quizAttemptRepository.findById(attemptId).orElseThrow();
        attempt.setDeadlineAt(LocalDateTime.now().minusSeconds(1));
        quizAttemptRepository.saveAndFlush(attempt);
        var body = (com.fasterxml.jackson.databind.node.ObjectNode) objectMapper.readTree(wrongSingleSubmissionJson(quiz));
        body.put("attemptId", attemptId);
        postJson("/api/v1/quizzes/" + id + "/submit", objectMapper.writeValueAsString(body), studentToken,
                status().isConflict());
        mockMvc.perform(get("/api/v1/quizzes/{id}/attempts", id).header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data[0].status").value("EXPIRED"))
                .andExpect(jsonPath("$.data[0].submittedAt").doesNotExist());
        postJson("/api/v1/quizzes/" + id + "/attempts/start", "{}", studentToken, status().isConflict());
        org.assertj.core.api.Assertions.assertThat(quizAttemptAnswerRepository.count()).isZero();
    }

    @Test
    void shouldRequireOwnedStartedAttemptAndValidateTextAnswers() throws Exception {
        JsonNode quiz = createFullQuiz(createPublishedQuizCourse("Owned TEXT course"), 2, instructorToken);
        Long id = quiz.at("/data/id").asLong();
        Long courseId = quiz.at("/data/courseId").asLong();
        enroll(courseId, studentToken);
        enroll(courseId, otherStudentToken);
        postJson("/api/v1/quizzes/" + id + "/submit", correctSubmissionJson(quiz), studentToken, status().isBadRequest());
        String owned = withAttempt(quiz, correctSubmissionJson(quiz));
        postJson("/api/v1/quizzes/" + id + "/submit", owned, otherStudentToken, status().isNotFound());
        var body = (com.fasterxml.jackson.databind.node.ObjectNode) objectMapper.readTree(owned);
        ((com.fasterxml.jackson.databind.node.ObjectNode) body.at("/answers/3")).put("textAnswer", " ");
        postJson("/api/v1/quizzes/" + id + "/submit", objectMapper.writeValueAsString(body), studentToken,
                status().isBadRequest());
        org.assertj.core.api.Assertions.assertThat(quizAttemptAnswerRepository.count()).isZero();
    }

    @Test
    void shouldSerializeConcurrentStartsAndDuplicateSubmissions() throws Exception {
        JsonNode quiz = createFullQuiz(createPublishedQuizCourse("Concurrent quiz course"), 1, instructorToken);
        Long id = quiz.at("/data/id").asLong();
        Long enrollmentId = enroll(quiz.at("/data/courseId").asLong(), studentToken);
        var executor = Executors.newFixedThreadPool(2);
        try {
            CountDownLatch ready = new CountDownLatch(2);
            CountDownLatch start = new CountDownLatch(1);
            var futures = java.util.stream.IntStream.range(0, 2).mapToObj(i -> executor.submit(() -> {
                ready.countDown();
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
                return attemptService.start(id, student.getEmail());
            })).toList();
            org.assertj.core.api.Assertions.assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            Long attemptId = futures.get(0).get(20, TimeUnit.SECONDS).getId();
            org.assertj.core.api.Assertions.assertThat(futures.get(1).get(20, TimeUnit.SECONDS).getId()).isEqualTo(attemptId);
            var body = (com.fasterxml.jackson.databind.node.ObjectNode) objectMapper.readTree(correctSubmissionJson(quiz));
            body.put("attemptId", attemptId);
            QuizSubmitRequest request = objectMapper.treeToValue(body, QuizSubmitRequest.class);
            var first = executor.submit(() -> submissionService.submit(id, request, student.getEmail()));
            var second = executor.submit(() -> submissionService.submit(id, request, student.getEmail()));
            org.assertj.core.api.Assertions.assertThat(first.get(20, TimeUnit.SECONDS).getScore())
                    .isEqualByComparingTo("100");
            org.assertj.core.api.Assertions.assertThat(second.get(20, TimeUnit.SECONDS).getId()).isEqualTo(attemptId);
            org.assertj.core.api.Assertions.assertThat(quizAttemptRepository.countByEnrollmentIdAndQuizId(enrollmentId, id))
                    .isEqualTo(1);
            org.assertj.core.api.Assertions.assertThat(quizAttemptAnswerRepository.count()).isEqualTo(4);
        } finally {
            executor.shutdownNow();
            org.assertj.core.api.Assertions.assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private Long createPublishedQuizCourse(String title) throws Exception {
        return createPublishedQuizCourse(title, true);
    }

    private Long createPublishedQuizCourse(String title, boolean lessonPublished) throws Exception {
        Long categoryId = createCategory("Quiz", adminToken);
        Long courseId = createCourse(title, categoryId, instructorToken);
        Long sectionId = createSection(courseId, "Quiz Section", instructorToken);
        Long lessonId = createLesson(sectionId, "Quiz Lesson", "QUIZ", lessonPublished, instructorToken);
        publishCourse(courseId, instructorToken);
        return lessonId;
    }

    private JsonNode createSingleQuestionQuiz(Long lessonId, int maxAttempts, String accessToken) throws Exception {
        return postJson("/api/v1/quizzes", singleQuizJson(lessonId, "Java Quiz", maxAttempts),
                accessToken, status().isCreated());
    }

    private JsonNode createFullQuiz(Long lessonId, int maxAttempts, String accessToken) throws Exception {
        return postJson("/api/v1/quizzes", fullQuizJson(lessonId, maxAttempts),
                accessToken, status().isCreated());
    }

    private Long enroll(Long courseId, String accessToken) throws Exception {
        JsonNode response = postJson("/api/v1/courses/%d/enroll".formatted(courseId),
                "{}", accessToken, status().isCreated());
        return response.at("/data/id").asLong();
    }

    private void publishCourse(Long courseId, String accessToken) throws Exception {
        mockMvc.perform(patch("/api/v1/courses/{id}/publish", courseId)
                        .header("Authorization", bearer(accessToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REVIEWING"));
        mockMvc.perform(patch("/api/v1/admin/courses/{id}/approve", courseId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PUBLISHED"));
    }

    private Long createCategory(String name, String accessToken) throws Exception {
        JsonNode response = postJson("/api/v1/categories", """
                { "name": "%s", "orderIndex": 1 }
                """.formatted(name), accessToken, status().isCreated());
        return response.at("/data/id").asLong();
    }

    private Long createCourse(String title, Long categoryId, String accessToken) throws Exception {
        JsonNode response = postJson("/api/v1/courses", """
                {
                    "title": "%s",
                    "subtitle": "Subtitle",
                    "description": "Description",
                    "level": "BEGINNER",
                    "language": "vi",
                    "price": 0,
                    "currency": "VND",
                    "categoryIds": [%d],
                    "requirements": ["Laptop"],
                    "outcomes": ["Learn"]
                }
                """.formatted(title, categoryId), accessToken, status().isCreated());
        return response.at("/data/id").asLong();
    }

    private Long createSection(Long courseId, String title, String accessToken) throws Exception {
        JsonNode response = postJson("/api/v1/courses/%d/sections".formatted(courseId), """
                {
                    "title": "%s",
                    "description": "Section description",
                    "orderIndex": 0,
                    "published": true
                }
                """.formatted(title), accessToken, status().isCreated());
        return response.at("/data/id").asLong();
    }

    private Long createLesson(Long sectionId, String title, String type, String accessToken) throws Exception {
        return createLesson(sectionId, title, type, true, accessToken);
    }

    private Long createLesson(
            Long sectionId,
            String title,
            String type,
            boolean published,
            String accessToken
    ) throws Exception {
        int orderIndex = lessonRepository.findBySectionIdAndDeletedAtIsNullOrderByOrderIndexAscIdAsc(sectionId)
                .size();
        JsonNode response = postJson("/api/v1/sections/%d/lessons".formatted(sectionId), """
                {
                    "title": "%s",
                    "type": "%s",
                    "content": "Content",
                    "durationSeconds": 0,
                    "preview": false,
                    "published": %s,
                    "orderIndex": %d
                }
                """.formatted(title, type, published, orderIndex), accessToken, status().isCreated());
        return response.at("/data/id").asLong();
    }

    private JsonNode postJson(String path, String json, String accessToken, ResultMatcher expectedStatus)
            throws Exception {
        String response = mockMvc.perform(post(path)
                        .header("Authorization", bearer(accessToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(expectedStatus)
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response);
    }

    private String singleQuizJson(Long lessonId, String title, int maxAttempts) {
        return """
                {
                    "lessonId": %d,
                    "title": "%s",
                    "description": "Quiz description",
                    "passScore": 70,
                    "maxAttempts": %d,
                    "shuffleQuestions": false,
                    "questions": [
                        {
                            "content": "Which language runs on the JVM?",
                            "type": "SINGLE",
                            "points": 10,
                            "orderIndex": 0,
                            "explanation": "Java is the JVM language here.",
                            "answerOptions": [
                                { "content": "Java", "correct": true, "orderIndex": 0 },
                                { "content": "Python", "correct": false, "orderIndex": 1 }
                            ]
                        }
                    ]
                }
                """.formatted(lessonId, title, maxAttempts);
    }

    private String fullQuizJson(Long lessonId, int maxAttempts) {
        return """
                {
                    "lessonId": %d,
                    "title": "Full Quiz",
                    "description": "Full grading quiz",
                    "passScore": 70,
                    "timeLimitMins": 15,
                    "maxAttempts": %d,
                    "shuffleQuestions": false,
                    "questions": [
                        {
                            "content": "Which language runs on the JVM?",
                            "type": "SINGLE",
                            "points": 10,
                            "orderIndex": 0,
                            "answerOptions": [
                                { "content": "Java", "correct": true, "orderIndex": 0 },
                                { "content": "Python", "correct": false, "orderIndex": 1 }
                            ]
                        },
                        {
                            "content": "Select Spring projects",
                            "type": "MULTIPLE",
                            "points": 20,
                            "orderIndex": 1,
                            "answerOptions": [
                                { "content": "Spring Boot", "correct": true, "orderIndex": 0 },
                                { "content": "Laravel", "correct": false, "orderIndex": 1 },
                                { "content": "Spring Security", "correct": true, "orderIndex": 2 }
                            ]
                        },
                        {
                            "content": "Java is statically typed",
                            "type": "TRUE_FALSE",
                            "points": 10,
                            "orderIndex": 2,
                            "answerOptions": [
                                { "content": "True", "correct": true, "orderIndex": 0 },
                                { "content": "False", "correct": false, "orderIndex": 1 }
                            ]
                        },
                        {
                            "content": "Name the main Spring backend framework",
                            "type": "TEXT",
                            "points": 10,
                            "orderIndex": 3,
                            "answerOptions": [
                                { "content": "Spring Boot", "correct": true, "orderIndex": 0 }
                            ]
                        }
                    ]
                }
                """.formatted(lessonId, maxAttempts);
    }

    private String correctSubmissionJson(JsonNode quiz) {
        return """
                {
                    "answers": [
                        { "questionId": %d, "selectedOptionIds": [%d] },
                        { "questionId": %d, "selectedOptionIds": [%d, %d] },
                        { "questionId": %d, "selectedOptionIds": [%d] },
                        { "questionId": %d, "textAnswer": " spring boot " }
                    ]
                }
                """.formatted(
                quiz.at("/data/questions/0/id").asLong(),
                quiz.at("/data/questions/0/answerOptions/0/id").asLong(),
                quiz.at("/data/questions/1/id").asLong(),
                quiz.at("/data/questions/1/answerOptions/0/id").asLong(),
                quiz.at("/data/questions/1/answerOptions/2/id").asLong(),
                quiz.at("/data/questions/2/id").asLong(),
                quiz.at("/data/questions/2/answerOptions/0/id").asLong(),
                quiz.at("/data/questions/3/id").asLong()
        );
    }

    private String wrongSingleSubmissionJson(JsonNode quiz) {
        return """
                {
                    "attemptId": 0,
                    "answers": [
                        { "questionId": %d, "selectedOptionIds": [%d] }
                    ]
                }
                """.formatted(
                quiz.at("/data/questions/0/id").asLong(),
                quiz.at("/data/questions/0/answerOptions/1/id").asLong()
        );
    }

    private User createUser(String email, String fullName, RoleName roleName) {
        Role role = roleRepository.findByName(roleName).orElseThrow();
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(PASSWORD))
                .fullName(fullName)
                .status(UserStatus.ACTIVE)
                .emailVerified(true)
                .roles(new HashSet<>(Set.of(role)))
                .build();
        return userRepository.save(user);
    }

    private String token(User user) {
        return jwtService.generateAccessToken(user);
    }

    private String bearer(String token) {
        return "Bearer " + token;
    }

    private void cleanDatabase() {
        auditLogRepository.deleteAll();
        notificationRepository.deleteAll();
        quizAttemptAnswerOptionRepository.deleteAll();
        quizAttemptAnswerRepository.deleteAll();
        quizAttemptRepository.deleteAll();
        answerOptionRepository.deleteAll();
        questionRepository.deleteAll();
        quizRepository.deleteAll();
        courseCertificateRepository.deleteAll();
        lessonProgressRepository.deleteAll();
        enrollmentRepository.deleteAll();
        lessonResourceRepository.deleteAll();
        lessonVideoRepository.deleteAll();
        lessonRepository.deleteAll();
        sectionRepository.deleteAll();
        courseRequirementRepository.deleteAll();
        courseOutcomeRepository.deleteAll();
        courseRepository.deleteAll();
        categoryRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        instructorProfileRepository.deleteAll();
        userProfileRepository.deleteAll();
        userRepository.deleteAll();
    }
}
