package com.example.skillora_platform.notification;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.example.skillora_platform.assignment.dto.AssignmentGradeRequest;
import com.example.skillora_platform.assignment.entity.Assignment;
import com.example.skillora_platform.assignment.entity.AssignmentSubmission;
import com.example.skillora_platform.assignment.entity.SubmissionStatus;
import com.example.skillora_platform.assignment.repository.AssignmentRepository;
import com.example.skillora_platform.assignment.repository.AssignmentSubmissionRepository;
import com.example.skillora_platform.assignment.service.AssignmentGradingService;
import com.example.skillora_platform.chat.repository.ChatConversationRepository;
import com.example.skillora_platform.chat.repository.ChatMessageRepository;
import com.example.skillora_platform.commerce.entity.Coupon;
import com.example.skillora_platform.commerce.entity.DiscountType;
import com.example.skillora_platform.commerce.entity.Order;
import com.example.skillora_platform.commerce.entity.PaymentGateway;
import com.example.skillora_platform.commerce.entity.PaymentTransaction;
import com.example.skillora_platform.commerce.entity.TxStatus;
import com.example.skillora_platform.commerce.repository.CartItemRepository;
import com.example.skillora_platform.commerce.repository.CartRepository;
import com.example.skillora_platform.commerce.repository.CouponRepository;
import com.example.skillora_platform.commerce.repository.OrderItemRepository;
import com.example.skillora_platform.commerce.repository.OrderRepository;
import com.example.skillora_platform.commerce.repository.PaymentTransactionRepository;
import com.example.skillora_platform.commerce.repository.WishlistRepository;
import com.example.skillora_platform.course.entity.Course;
import com.example.skillora_platform.course.entity.CourseLevel;
import com.example.skillora_platform.course.entity.CourseStatus;
import com.example.skillora_platform.course.entity.Lesson;
import com.example.skillora_platform.course.entity.LessonType;
import com.example.skillora_platform.course.entity.Section;
import com.example.skillora_platform.course.repository.CourseRepository;
import com.example.skillora_platform.course.repository.LessonRepository;
import com.example.skillora_platform.course.repository.SectionRepository;
import com.example.skillora_platform.enrollment.entity.Enrollment;
import com.example.skillora_platform.enrollment.entity.EnrollmentStatus;
import com.example.skillora_platform.enrollment.repository.CourseCertificateRepository;
import com.example.skillora_platform.enrollment.repository.EnrollmentRepository;
import com.example.skillora_platform.enrollment.repository.LessonProgressRepository;
import com.example.skillora_platform.enrollment.service.LearningProgressService;
import com.example.skillora_platform.notification.entity.Notification;
import com.example.skillora_platform.notification.entity.NotificationType;
import com.example.skillora_platform.notification.event.PaymentFailedEvent;
import com.example.skillora_platform.notification.event.PaymentPaidEvent;
import com.example.skillora_platform.notification.repository.NotificationRepository;
import com.example.skillora_platform.notification.service.NotificationService;
import com.example.skillora_platform.review.dto.ReviewCreateRequest;
import com.example.skillora_platform.review.repository.ReviewLikeRepository;
import com.example.skillora_platform.review.repository.ReviewRepository;
import com.example.skillora_platform.review.service.ReviewService;
import com.example.skillora_platform.user.entity.Role;
import com.example.skillora_platform.user.entity.RoleName;
import com.example.skillora_platform.user.entity.User;
import com.example.skillora_platform.user.entity.UserStatus;
import com.example.skillora_platform.user.repository.RoleRepository;
import com.example.skillora_platform.user.repository.UserRepository;
import com.example.skillora_platform.user.service.JwtService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@AutoConfigureMockMvc
class NotificationIntegrationTest {

    private static final String PASSWORD = "Password@123";

    @Autowired private MockMvc mockMvc;
    @Autowired private JwtService jwtService;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private CourseRepository courseRepository;
    @Autowired private SectionRepository sectionRepository;
    @Autowired private LessonRepository lessonRepository;
    @Autowired private EnrollmentRepository enrollmentRepository;
    @Autowired private LessonProgressRepository lessonProgressRepository;
    @Autowired private CourseCertificateRepository courseCertificateRepository;
    @Autowired private AssignmentRepository assignmentRepository;
    @Autowired private AssignmentSubmissionRepository assignmentSubmissionRepository;
    @Autowired private ReviewRepository reviewRepository;
    @Autowired private ReviewLikeRepository reviewLikeRepository;
    @Autowired private CartRepository cartRepository;
    @Autowired private CartItemRepository cartItemRepository;
    @Autowired private WishlistRepository wishlistRepository;
    @Autowired private CouponRepository couponRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private OrderItemRepository orderItemRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private NotificationRepository notificationRepository;
    @Autowired private ChatConversationRepository chatConversationRepository;
    @Autowired private ChatMessageRepository chatMessageRepository;
    @Autowired private NotificationService notificationService;
    @Autowired private LearningProgressService learningProgressService;
    @Autowired private AssignmentGradingService assignmentGradingService;
    @Autowired private ReviewService reviewService;
    @Autowired private ApplicationEventPublisher eventPublisher;
    @Autowired private PlatformTransactionManager transactionManager;

    private User instructor;
    private User student;
    private String studentToken;

    @BeforeEach
    void setUp() {
        cleanDatabase();
        instructor = createUser("notify.instructor@example.com", "Notify Instructor", RoleName.INSTRUCTOR);
        student = createUser("notify.student@example.com", "Notify Student", RoleName.STUDENT);
        studentToken = token(student);
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
    }

    @Test
    void shouldListMarkReadMarkAllReadAndOpenStream() throws Exception {
        Notification first = createNotification(NotificationType.COURSE_ENROLLED, "First notification");

        mockMvc.perform(get("/api/v1/notifications")
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].read").value(false))
                .andExpect(jsonPath("$.data.content[0].data.source").value("test"));

        mockMvc.perform(patch("/api/v1/notifications/{id}/read", first.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.read").value(true));

        createNotification(NotificationType.ORDER_CREATED, "Second notification");
        mockMvc.perform(patch("/api/v1/notifications/read-all")
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(1));

        mockMvc.perform(get("/api/v1/notifications/stream")
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(request().asyncStarted());
    }

    @Test
    void shouldCreateNotificationsFromDomainEvents() throws Exception {
        Course freeCourse = createCourse("Free Notification Course", BigDecimal.ZERO);
        mockMvc.perform(post("/api/v1/courses/{id}/enroll", freeCourse.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isCreated());

        Course progressCourse = createCourse("Certificate Course", BigDecimal.ZERO);
        Lesson textLesson = createLesson(progressCourse, LessonType.TEXT, "Certificate Lesson");
        Enrollment progressEnrollment = createEnrollment(student, progressCourse);
        learningProgressService.updateProgress(progressEnrollment.getId(), textLesson.getId(), null, true);

        Course assignmentCourse = createCourse("Assignment Notify Course", BigDecimal.ZERO);
        Lesson assignmentLesson = createLesson(assignmentCourse, LessonType.ASSIGNMENT, "Assignment Lesson");
        Assignment assignment = assignmentRepository.save(Assignment.builder()
                .lesson(assignmentLesson)
                .title("Notification Assignment")
                .maxScore(100)
                .build());
        AssignmentSubmission submission = assignmentSubmissionRepository.save(AssignmentSubmission.builder()
                .assignment(assignment)
                .enrollment(createEnrollment(student, assignmentCourse))
                .content("Submission content")
                .status(SubmissionStatus.SUBMITTED)
                .build());
        AssignmentGradeRequest gradeRequest = new AssignmentGradeRequest();
        gradeRequest.setStatus(SubmissionStatus.GRADED);
        gradeRequest.setPassed(true);
        gradeRequest.setScore(BigDecimal.valueOf(95));
        gradeRequest.setFeedback("Good work");
        assignmentGradingService.grade(submission.getId(), gradeRequest, instructor.getEmail());

        Course reviewCourse = createCourse("Review Notify Course", BigDecimal.ZERO);
        createEnrollment(student, reviewCourse);
        ReviewCreateRequest reviewRequest = new ReviewCreateRequest();
        reviewRequest.setCourseId(reviewCourse.getId());
        reviewRequest.setRating(5);
        reviewRequest.setContent("Great course");
        Long reviewId = reviewService.create(reviewRequest, student.getEmail()).getId();
        reviewService.delete(reviewId, student.getEmail());

        Course paidCourse = createCourse("Free Checkout Notify Course", BigDecimal.valueOf(100000));
        couponRepository.save(Coupon.builder()
                .code("FULL_NOTIFY")
                .name("Full notification coupon")
                .discountType(DiscountType.FIXED)
                .discountValue(BigDecimal.valueOf(200000))
                .maxUses(100)
                .usedCount(0)
                .active(true)
                .startsAt(LocalDateTime.now().minusDays(1))
                .expiresAt(LocalDateTime.now().plusDays(1))
                .build());
        mockMvc.perform(post("/api/v1/cart/{courseId}", paidCourse.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/orders/checkout")
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "couponCode": "FULL_NOTIFY" }
                                """))
                .andExpect(status().isCreated());

        Course cancellableCourse = createCourse("Pending Cancel Notify Course", BigDecimal.valueOf(150000));
        mockMvc.perform(post("/api/v1/cart/{courseId}", cancellableCourse.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/orders/checkout")
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "couponCode": null }
                                """))
                .andExpect(status().isCreated());
        Order pendingOrder = orderRepository
                .findDistinctByUserIdOrderByCreatedAtDesc(
                        student.getId(), org.springframework.data.domain.PageRequest.of(0, 1))
                .getContent()
                .get(0);
        mockMvc.perform(patch("/api/v1/orders/{id}/cancel", pendingOrder.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk());

        publishPaymentEvents(pendingOrder);

        List<NotificationType> studentTypes = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(
                        student.getId(), org.springframework.data.domain.PageRequest.of(0, 50))
                .map(Notification::getType)
                .getContent();
        assertThat(studentTypes).contains(
                NotificationType.COURSE_ENROLLED,
                NotificationType.CERTIFICATE_ISSUED,
                NotificationType.ASSIGNMENT_GRADED,
                NotificationType.ORDER_CREATED,
                NotificationType.ORDER_CANCELLED,
                NotificationType.ORDER_PAID,
                NotificationType.PAYMENT_FAILED,
                NotificationType.PAYMENT_PAID
        );

        List<NotificationType> instructorTypes = notificationRepository
                .findByUserIdOrderByCreatedAtDesc(
                        instructor.getId(), org.springframework.data.domain.PageRequest.of(0, 10))
                .map(Notification::getType)
                .getContent();
        assertThat(instructorTypes).contains(NotificationType.REVIEW_CREATED, NotificationType.REVIEW_DELETED);
    }

    private Notification createNotification(NotificationType type, String title) {
        notificationService.createNotification(student.getId(), type, title, "Notification content",
                Map.of("source", "test"));
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(
                student.getId(), org.springframework.data.domain.PageRequest.of(0, 1))
                .getContent()
                .get(0);
    }

    private void publishPaymentEvents(Order order) {
        TransactionTemplate template = new TransactionTemplate(transactionManager);
        template.executeWithoutResult(status -> {
            PaymentTransaction failedTransaction = paymentTransactionRepository.save(PaymentTransaction.builder()
                    .order(order)
                    .gateway(PaymentGateway.VNPAY)
                    .amount(order.getTotalAmount())
                    .currency(order.getCurrency())
                    .status(TxStatus.FAILED)
                    .message("Gateway rejected payment")
                    .build());
            PaymentTransaction paidTransaction = paymentTransactionRepository.save(PaymentTransaction.builder()
                    .order(order)
                    .gateway(PaymentGateway.VNPAY)
                    .amount(order.getTotalAmount())
                    .currency(order.getCurrency())
                    .status(TxStatus.SUCCESS)
                    .message("Gateway confirmed payment")
                    .build());
            eventPublisher.publishEvent(new PaymentFailedEvent(
                    order.getId(), failedTransaction.getId(), "Gateway rejected payment"));
            eventPublisher.publishEvent(new PaymentPaidEvent(order.getId(), paidTransaction.getId()));
        });
    }

    private Course createCourse(String title, BigDecimal price) {
        Course course = Course.builder()
                .instructor(instructor)
                .title(title)
                .slug(slug(title))
                .subtitle("Notification integration course")
                .description("Course description")
                .level(CourseLevel.BEGINNER)
                .language("vi")
                .price(price)
                .currency("VND")
                .status(CourseStatus.PUBLISHED)
                .totalLessons(0)
                .totalDurationSeconds(0)
                .totalEnrollments(0)
                .avgRating(BigDecimal.ZERO)
                .totalReviews(0)
                .publishedAt(LocalDateTime.now())
                .build();
        return courseRepository.save(course);
    }

    private Lesson createLesson(Course course, LessonType type, String title) {
        Section section = sectionRepository.save(Section.builder()
                .course(course)
                .title(title + " Section")
                .orderIndex((int) (System.nanoTime() % 100000))
                .published(true)
                .build());
        Lesson lesson = Lesson.builder()
                .section(section)
                .title(title)
                .slug(slug(title))
                .type(type)
                .content("Lesson content")
                .durationSeconds(60)
                .preview(false)
                .published(true)
                .orderIndex(1)
                .build();
        return lessonRepository.save(lesson);
    }

    private Enrollment createEnrollment(User user, Course course) {
        return enrollmentRepository.save(Enrollment.builder()
                .user(user)
                .course(course)
                .status(EnrollmentStatus.ACTIVE)
                .amountPaid(BigDecimal.ZERO)
                .progressPercent(BigDecimal.ZERO)
                .enrolledAt(LocalDateTime.now())
                .build());
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

    private String slug(String title) {
        return title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-")
                + "-" + System.nanoTime();
    }

    private void cleanDatabase() {
        notificationRepository.deleteAll();
        chatMessageRepository.deleteAll();
        chatConversationRepository.deleteAll();
        reviewLikeRepository.deleteAll();
        reviewRepository.deleteAll();
        assignmentSubmissionRepository.deleteAll();
        assignmentRepository.deleteAll();
        lessonProgressRepository.deleteAll();
        courseCertificateRepository.deleteAll();
        enrollmentRepository.deleteAll();
        cartItemRepository.deleteAll();
        cartRepository.deleteAll();
        wishlistRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        orderItemRepository.deleteAll();
        orderRepository.deleteAll();
        couponRepository.deleteAll();
        lessonRepository.deleteAll();
        sectionRepository.deleteAll();
        courseRepository.deleteAll();
        userRepository.deleteAll();
    }
}
