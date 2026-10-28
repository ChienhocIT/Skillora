package com.example.skillora_platform.assignment;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

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
import com.example.skillora_platform.assignment.repository.AssignmentRepository;
import com.example.skillora_platform.assignment.repository.AssignmentSubmissionRepository;
import com.example.skillora_platform.course.repository.CategoryRepository;
import com.example.skillora_platform.course.repository.CourseOutcomeRepository;
import com.example.skillora_platform.course.repository.CourseRepository;
import com.example.skillora_platform.course.repository.CourseRequirementRepository;
import com.example.skillora_platform.course.repository.LessonRepository;
import com.example.skillora_platform.course.repository.LessonResourceRepository;
import com.example.skillora_platform.course.repository.LessonVideoRepository;
import com.example.skillora_platform.course.repository.SectionRepository;
import com.example.skillora_platform.enrollment.repository.CourseCertificateRepository;
import com.example.skillora_platform.enrollment.entity.Enrollment;
import com.example.skillora_platform.enrollment.entity.EnrollmentStatus;
import com.example.skillora_platform.enrollment.repository.EnrollmentRepository;
import com.example.skillora_platform.enrollment.repository.LessonProgressRepository;
import com.example.skillora_platform.enrollment.service.LearningProgressService;
import com.example.skillora_platform.notification.repository.NotificationRepository;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@AutoConfigureMockMvc
class AssignmentIntegrationTest {
    @Autowired private LearningProgressService learningProgressService;

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
    @Autowired private AssignmentRepository assignmentRepository;
    @Autowired private AssignmentSubmissionRepository assignmentSubmissionRepository;
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
    void shouldCreateAssignmentAndEnforceOwnershipAndLessonType() throws Exception {
        CourseSetup setup = createPublishedCourseWithLesson("Assignment Ownership Course", "ASSIGNMENT");
        JsonNode assignment = createAssignment(setup.lessonId(), 7, instructorToken, status().isCreated());
        Long assignmentId = assignment.at("/data/id").asLong();

        mockMvc.perform(post("/api/v1/assignments")
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(assignmentJson(setup.lessonId(), "Student Assignment", 7)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/assignments")
                        .header("Authorization", bearer(otherInstructorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(assignmentJson(setup.lessonId(), "Other Assignment", 7)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/assignments")
                        .header("Authorization", bearer(instructorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(assignmentJson(setup.lessonId(), "Duplicate Assignment", 7)))
                .andExpect(status().isConflict());

        CourseSetup textSetup = createPublishedCourseWithLesson("Text Lesson Course", "TEXT");
        mockMvc.perform(post("/api/v1/assignments")
                        .header("Authorization", bearer(instructorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(assignmentJson(textSetup.lessonId(), "Invalid Assignment", 7)))
                .andExpect(status().isBadRequest());

        CourseSetup adminSetup = createPublishedCourseWithLesson("Admin Assignment Course", "ASSIGNMENT");
        mockMvc.perform(post("/api/v1/assignments")
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(assignmentJson(adminSetup.lessonId(), "Admin Assignment", 7)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.title").value("Admin Assignment"));

        mockMvc.perform(get("/api/v1/assignments/{id}", assignmentId)
                        .header("Authorization", bearer(instructorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lessonId").value(setup.lessonId()));
    }

    @Test
    void shouldGetAssignmentForEnrolledStudentAndDenyNonEnrolledAccess() throws Exception {
        CourseSetup setup = createPublishedCourseWithLesson("Assignment Access Course", "ASSIGNMENT");
        JsonNode assignment = createAssignment(setup.lessonId(), 7, instructorToken, status().isCreated());
        Long assignmentId = assignment.at("/data/id").asLong();

        mockMvc.perform(get("/api/v1/assignments/{id}", assignmentId)
                        .header("Authorization", bearer(otherStudentToken)))
                .andExpect(status().isForbidden());

        enroll(setup.courseId(), studentToken);

        mockMvc.perform(get("/api/v1/assignments/{id}", assignmentId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.dueAt").exists())
                .andExpect(jsonPath("$.data.overdue").value(false))
                .andExpect(jsonPath("$.data.mySubmission").doesNotExist());

        mockMvc.perform(get("/api/v1/assignments/{id}", assignmentId)
                        .header("Authorization", bearer(instructorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.courseId").value(setup.courseId()));
    }

    @Test
    void shouldDenyEnrolledStudentAccessToAssignmentOnUnpublishedLesson() throws Exception {
        CourseSetup setup = createPublishedCourseWithLesson(
                "Hidden Assignment Course", "ASSIGNMENT", false);
        JsonNode assignment = createAssignment(setup.lessonId(), 7, instructorToken, status().isCreated());
        Long assignmentId = assignment.at("/data/id").asLong();
        enroll(setup.courseId(), studentToken);

        mockMvc.perform(get("/api/v1/assignments/{id}", assignmentId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/assignments/{id}/submit", assignmentId)
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(submissionJson("Hidden answer")))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldSubmitValidateDuplicateAndAllowLateSubmission() throws Exception {
        CourseSetup setup = createPublishedCourseWithLesson("Assignment Submit Course", "ASSIGNMENT");
        JsonNode assignment = createAssignment(setup.lessonId(), 0, instructorToken, status().isCreated());
        Long assignmentId = assignment.at("/data/id").asLong();

        mockMvc.perform(post("/api/v1/assignments/{id}/submit", assignmentId)
                        .header("Authorization", bearer(otherStudentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(submissionJson("Non enrolled content")))
                .andExpect(status().isForbidden());

        // Keep the zero-day deadline clearly in the past across database timestamp precision.
        var enrollment = enrollmentRepository.saveAndFlush(Enrollment.builder()
                .user(student)
                .course(courseRepository.findById(setup.courseId()).orElseThrow())
                .status(EnrollmentStatus.ACTIVE)
                .amountPaid(BigDecimal.ZERO)
                .progressPercent(BigDecimal.ZERO)
                .enrolledAt(LocalDateTime.now().minusDays(1))
                .build());
        assertThat(enrollmentRepository.findById(enrollment.getId()).orElseThrow().getEnrolledAt())
                .isBefore(LocalDateTime.now().minusHours(12));

        mockMvc.perform(post("/api/v1/assignments/{id}/submit", assignmentId)
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/v1/assignments/{id}/submit", assignmentId)
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(submissionJson("My assignment answer")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.late").value(true));

        mockMvc.perform(post("/api/v1/assignments/{id}/submit", assignmentId)
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(submissionJson("Duplicate answer")))
                .andExpect(status().isConflict());

        mockMvc.perform(get("/api/v1/assignments/{id}/submissions?status=SUBMITTED", assignmentId)
                        .header("Authorization", bearer(instructorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].studentName").value("Student User"));
    }

    @Test
    void shouldReturnAndAllowResubmissionOnlyWhenReturned() throws Exception {
        CourseSetup setup = createPublishedCourseWithLesson("Assignment Return Course", "ASSIGNMENT");
        JsonNode assignment = createAssignment(setup.lessonId(), 7, instructorToken, status().isCreated());
        Long assignmentId = assignment.at("/data/id").asLong();
        enroll(setup.courseId(), studentToken);
        JsonNode submission = submitAssignment(assignmentId, "First answer", studentToken, status().isCreated());
        Long submissionId = submission.at("/data/id").asLong();

        mockMvc.perform(patch("/api/v1/submissions/{id}/grade", submissionId)
                        .header("Authorization", bearer(instructorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "status": "RETURNED", "feedback": "Please add more details." }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("RETURNED"))
                .andExpect(jsonPath("$.data.feedback").value("Please add more details."));

        mockMvc.perform(post("/api/v1/assignments/{id}/submit", assignmentId)
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(submissionJson("Updated answer")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.id").value(submissionId))
                .andExpect(jsonPath("$.data.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.data.content").value("Updated answer"));

        mockMvc.perform(get("/api/v1/assignments/{id}", assignmentId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.mySubmission.id").value(submissionId))
                .andExpect(jsonPath("$.data.mySubmission.status").value("SUBMITTED"));
    }

    @Test
    void shouldGradeSubmissionAndCompleteAssignmentLessonProgress() throws Exception {
        CourseSetup setup = createPublishedCourseWithLesson("Assignment Grading Course", "ASSIGNMENT");
        JsonNode assignment = createAssignment(setup.lessonId(), 7, instructorToken, status().isCreated());
        Long assignmentId = assignment.at("/data/id").asLong();
        Long enrollmentId = enroll(setup.courseId(), studentToken);
        JsonNode submission = submitAssignment(assignmentId, "Grade me", studentToken, status().isCreated());
        Long submissionId = submission.at("/data/id").asLong();

        mockMvc.perform(patch("/api/v1/submissions/{id}/grade", submissionId)
                        .header("Authorization", bearer(otherInstructorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "status": "GRADED", "passed": true, "score": 90, "feedback": "Good work." }
                                """))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/v1/submissions/{id}/grade", submissionId)
                        .header("Authorization", bearer(instructorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "status": "GRADED", "passed": true, "score": 101, "feedback": "Too high." }
                                """))
                .andExpect(status().isBadRequest());

        mockMvc.perform(patch("/api/v1/submissions/{id}/grade", submissionId)
                        .header("Authorization", bearer(instructorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "status": "GRADED", "passed": true, "score": 95, "feedback": "Excellent." }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("GRADED"))
                .andExpect(jsonPath("$.data.score").value(95));

        mockMvc.perform(patch("/api/v1/submissions/{id}/grade", submissionId)
                        .header("Authorization", bearer(instructorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "status": "RETURNED", "feedback": "Cannot return after grade." }
                                """))
                .andExpect(status().isConflict());

        mockMvc.perform(get("/api/v1/enrollments/{id}/progress", enrollmentId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(1)))
                .andExpect(jsonPath("$.data[0].lessonId").value(setup.lessonId()))
                .andExpect(jsonPath("$.data[0].completed").value(true));
    }

    @Test
    void shouldRequireExplicitPassAndRecheckCertificateAfterRegrading() throws Exception {
        CourseSetup setup = createPublishedCourseWithLesson("Pass decision course", "ASSIGNMENT");
        Long assignmentId = createAssignment(setup.lessonId(), 7, instructorToken, status().isCreated()).at("/data/id").asLong();
        Long enrollmentId = enroll(setup.courseId(), studentToken);
        mockMvc.perform(patch("/api/v1/enrollments/{id}/lessons/{lid}/progress", enrollmentId, setup.lessonId())
                        .header("Authorization", bearer(studentToken)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"completed\":true,\"watchedSeconds\":9999}"))
                .andExpect(status().isConflict());
        Long submissionId = submitAssignment(assignmentId, "Please assess", studentToken, status().isCreated())
                .at("/data/id").asLong();
        gradeDecision(submissionId, null, 95, status().isBadRequest());
        gradeDecision(submissionId, false, 95, status().isOk());
        certificate(enrollmentId, status().isBadRequest());
        // Explicit instructor judgment, rather than a hidden numeric pass threshold, determines eligibility.
        gradeDecision(submissionId, true, 0, status().isOk());
        JsonNode original = certificate(enrollmentId, status().isOk());
        org.assertj.core.api.Assertions.assertThat(courseCertificateRepository.count()).isEqualTo(1);
        gradeDecision(submissionId, false, 95, status().isOk());
        certificate(enrollmentId, status().isBadRequest());
        org.assertj.core.api.Assertions.assertThat(enrollmentRepository.findById(enrollmentId).orElseThrow().getStatus().name())
                .isEqualTo("ACTIVE");
        gradeDecision(submissionId, true, 95, status().isOk());
        JsonNode restored = certificate(enrollmentId, status().isOk());
        org.assertj.core.api.Assertions.assertThat(restored.at("/data/certificateCode"))
                .isEqualTo(original.at("/data/certificateCode"));
        org.assertj.core.api.Assertions.assertThat(courseCertificateRepository.count()).isEqualTo(1);
    }

    @Test
    void shouldRejectLegacyUnconfirmedGradeAndRevokedCertificate() throws Exception {
        CourseSetup setup = createPublishedCourseWithLesson("Legacy decision course", "ASSIGNMENT");
        Long assignmentId = createAssignment(setup.lessonId(), 7, instructorToken, status().isCreated()).at("/data/id").asLong();
        Long enrollmentId = enroll(setup.courseId(), studentToken);
        Long submissionId = submitAssignment(assignmentId, "Legacy grade", studentToken, status().isCreated())
                .at("/data/id").asLong();
        gradeDecision(submissionId, true, 95, status().isOk());
        var legacy = assignmentSubmissionRepository.findById(submissionId).orElseThrow();
        legacy.setPassed(null);
        assignmentSubmissionRepository.saveAndFlush(legacy);
        certificate(enrollmentId, status().isBadRequest());
        gradeDecision(submissionId, true, 95, status().isOk());
        certificate(enrollmentId, status().isOk());
        var cert = courseCertificateRepository.findByEnrollmentId(enrollmentId).orElseThrow();
        cert.setRevokedAt(java.time.LocalDateTime.now());
        courseCertificateRepository.saveAndFlush(cert);
        certificate(enrollmentId, status().isConflict());
    }

    @Test
    void shouldIssueOneCertificateWhenLastLessonsCompleteConcurrently() throws Exception {
        Long category = createCategory("Concurrent completion", adminToken);
        Long course = createCourse("Concurrent completion course", category, instructorToken);
        Long section = createSection(course, "Final lessons", instructorToken);
        Long first = createLesson(section, "First", "TEXT", instructorToken);
        Long second = createLesson(section, "Second", "TEXT", instructorToken);
        publishCourse(course, instructorToken);
        Long enrollment = enroll(course, studentToken);
        var executor = Executors.newFixedThreadPool(2);
        CountDownLatch start = new CountDownLatch(1);
        try {
            var futures = java.util.List.of(first, second).stream().map(lesson -> executor.submit(() -> {
                if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Start timeout");
                return learningProgressService.updateLearnerProgress(enrollment, lesson, null, true);
            })).toList();
            start.countDown();
            for (var future : futures) future.get(20, TimeUnit.SECONDS);
            certificate(enrollment, status().isOk());
            org.assertj.core.api.Assertions.assertThat(courseCertificateRepository.count()).isEqualTo(1);
        } finally {
            start.countDown();
            executor.shutdownNow();
            org.assertj.core.api.Assertions.assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
    }

    private void gradeDecision(Long id, Boolean passed, int score, ResultMatcher expected) throws Exception {
        String passField = passed == null ? "" : "\"passed\":" + passed + ",";
        mockMvc.perform(patch("/api/v1/submissions/{id}/grade", id).header("Authorization", bearer(instructorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"GRADED\",\"score\":" + score + "," + passField + "\"feedback\":\"Decision\"}"))
                .andExpect(expected);
    }

    private JsonNode certificate(Long enrollmentId, ResultMatcher expected) throws Exception {
        String body = mockMvc.perform(get("/api/v1/enrollments/{id}/certificate", enrollmentId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(expected).andReturn().getResponse().getContentAsString();
        return objectMapper.readTree(body);
    }

    private CourseSetup createPublishedCourseWithLesson(String title, String lessonType) throws Exception {
        return createPublishedCourseWithLesson(title, lessonType, true);
    }

    private CourseSetup createPublishedCourseWithLesson(
            String title,
            String lessonType,
            boolean lessonPublished
    ) throws Exception {
        Long categoryId = createCategory("Assignment", adminToken);
        Long courseId = createCourse(title, categoryId, instructorToken);
        Long sectionId = createSection(courseId, "Assignment Section", instructorToken);
        Long lessonId = createLesson(sectionId, "Assignment Lesson", lessonType, lessonPublished, instructorToken);
        publishCourse(courseId, instructorToken);
        return new CourseSetup(courseId, lessonId);
    }

    private JsonNode createAssignment(
            Long lessonId,
            Integer dueDays,
            String accessToken,
            ResultMatcher expectedStatus
    ) throws Exception {
        return postJson("/api/v1/assignments", assignmentJson(lessonId, "Build a project", dueDays),
                accessToken, expectedStatus);
    }

    private JsonNode submitAssignment(
            Long assignmentId,
            String content,
            String accessToken,
            ResultMatcher expectedStatus
    ) throws Exception {
        return postJson("/api/v1/assignments/%d/submit".formatted(assignmentId),
                submissionJson(content), accessToken, expectedStatus);
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

    private String assignmentJson(Long lessonId, String title, Integer dueDays) {
        String dueDaysJson = dueDays == null ? "null" : dueDays.toString();
        return """
                {
                    "lessonId": %d,
                    "title": "%s",
                    "instructions": "Submit your project repository URL and a short explanation.",
                    "maxScore": 100,
                    "dueDays": %s
                }
                """.formatted(lessonId, title, dueDaysJson);
    }

    private String submissionJson(String content) {
        return """
                {
                    "content": "%s",
                    "fileUrl": "https://github.com/demo/assignment"
                }
                """.formatted(content);
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
        assignmentSubmissionRepository.deleteAll();
        assignmentRepository.deleteAll();
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

    private record CourseSetup(Long courseId, Long lessonId) {
    }
}
