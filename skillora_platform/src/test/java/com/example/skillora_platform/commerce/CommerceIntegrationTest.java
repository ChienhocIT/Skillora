package com.example.skillora_platform.commerce;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.ResultMatcher;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.skillora_platform.commerce.entity.Coupon;
import com.example.skillora_platform.commerce.entity.DiscountType;
import com.example.skillora_platform.commerce.entity.Order;
import com.example.skillora_platform.commerce.entity.OrderStatus;
import com.example.skillora_platform.commerce.entity.PaymentGateway;
import com.example.skillora_platform.commerce.entity.PaymentTransaction;
import com.example.skillora_platform.commerce.entity.TxStatus;
import com.example.skillora_platform.commerce.dto.MomoIpnRequest;
import com.example.skillora_platform.commerce.repository.CartItemRepository;
import com.example.skillora_platform.commerce.repository.CartRepository;
import com.example.skillora_platform.commerce.repository.CouponRepository;
import com.example.skillora_platform.commerce.repository.OrderItemRepository;
import com.example.skillora_platform.commerce.repository.OrderRepository;
import com.example.skillora_platform.commerce.repository.PaymentTransactionRepository;
import com.example.skillora_platform.commerce.repository.WishlistRepository;
import com.example.skillora_platform.commerce.service.MomoClient;
import com.example.skillora_platform.commerce.service.MomoCreatePaymentPayload;
import com.example.skillora_platform.commerce.service.MomoCreatePaymentResult;
import com.example.skillora_platform.commerce.service.PaymentService;
import com.example.skillora_platform.course.entity.Course;
import com.example.skillora_platform.course.entity.CourseLevel;
import com.example.skillora_platform.course.entity.CourseStatus;
import com.example.skillora_platform.course.repository.CourseRepository;
import com.example.skillora_platform.enrollment.entity.Enrollment;
import com.example.skillora_platform.enrollment.entity.EnrollmentStatus;
import com.example.skillora_platform.enrollment.repository.EnrollmentRepository;
import com.example.skillora_platform.notification.entity.NotificationType;
import com.example.skillora_platform.notification.repository.NotificationRepository;
import com.example.skillora_platform.user.entity.Role;
import com.example.skillora_platform.user.entity.RoleName;
import com.example.skillora_platform.user.entity.User;
import com.example.skillora_platform.user.entity.UserStatus;
import com.example.skillora_platform.user.repository.RoleRepository;
import com.example.skillora_platform.user.repository.UserRepository;
import com.example.skillora_platform.user.service.JwtService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("test")
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "skillora.payment.public-base-url=http://localhost:8080",
        "skillora.payment.result-url=http://localhost:5173/payments/result",
        "skillora.payment.vnpay.tmn-code=TESTTMN",
        "skillora.payment.vnpay.hash-secret=test-vnpay-secret",
        "skillora.payment.momo.partner-code=MOMO",
        "skillora.payment.momo.access-key=test-access",
        "skillora.payment.momo.secret-key=test-momo-secret",
        "skillora.payment.momo.endpoint=http://localhost/momo"
})
class CommerceIntegrationTest {

    private static final String PASSWORD = "Password@123";

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private JwtService jwtService;
    @Autowired private PaymentService paymentService;
    @Autowired private PlatformTransactionManager transactionManager;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private RoleRepository roleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private CourseRepository courseRepository;
    @Autowired private EnrollmentRepository enrollmentRepository;
    @Autowired private WishlistRepository wishlistRepository;
    @Autowired private CartRepository cartRepository;
    @Autowired private CartItemRepository cartItemRepository;
    @Autowired private CouponRepository couponRepository;
    @Autowired private OrderRepository orderRepository;
    @Autowired private OrderItemRepository orderItemRepository;
    @Autowired private PaymentTransactionRepository paymentTransactionRepository;
    @Autowired private NotificationRepository notificationRepository;

    @MockBean private MomoClient momoClient;

    private User instructor;
    private User student;
    private User otherStudent;
    private String instructorToken;
    private String studentToken;
    private String otherStudentToken;

    @BeforeEach
    void setUp() {
        cleanDatabase();
        instructor = createUser("instructor@example.com", "Instructor User", RoleName.INSTRUCTOR);
        student = createUser("student@example.com", "Student User", RoleName.STUDENT);
        otherStudent = createUser("other.student@example.com", "Other Student", RoleName.STUDENT);
        instructorToken = token(instructor);
        studentToken = token(student);
        otherStudentToken = token(otherStudent);
    }

    @AfterEach
    void tearDown() {
        cleanDatabase();
    }

    @Test
    void shouldAddListAndRemoveWishlistIdempotentlyAndDenyInstructor() throws Exception {
        Course course = createCourse("Wishlist Course", money("199000"), CourseStatus.PUBLISHED, false);

        mockMvc.perform(post("/api/v1/wishlist/{courseId}", course.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.itemCount").value(1))
                .andExpect(jsonPath("$.data.items[0].course.title").value("Wishlist Course"));

        mockMvc.perform(post("/api/v1/wishlist/{courseId}", course.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.itemCount").value(1));

        mockMvc.perform(get("/api/v1/wishlist")
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items", hasSize(1)));

        mockMvc.perform(delete("/api/v1/wishlist/{courseId}", course.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isNoContent());

        mockMvc.perform(delete("/api/v1/wishlist/{courseId}", course.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/wishlist")
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.itemCount").value(0));

        mockMvc.perform(post("/api/v1/wishlist/{courseId}", course.getId())
                        .header("Authorization", bearer(instructorToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldAddListRemoveCartAndRejectInvalidOrAlreadyEnrolledCourses() throws Exception {
        Course course = createCourse("Cart Course", money("199000"), CourseStatus.PUBLISHED, false);

        mockMvc.perform(post("/api/v1/cart/{courseId}", course.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.itemCount").value(1))
                .andExpect(jsonPath("$.data.subtotalAmount").value(199000.0));

        mockMvc.perform(post("/api/v1/cart/{courseId}", course.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.itemCount").value(1));

        mockMvc.perform(get("/api/v1/cart")
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items", hasSize(1)));

        mockMvc.perform(delete("/api/v1/cart/{courseId}", course.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/cart")
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.itemCount").value(0));

        Course draft = createCourse("Draft Cart Course", money("100000"), CourseStatus.DRAFT, false);
        mockMvc.perform(post("/api/v1/cart/{courseId}", draft.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isBadRequest());

        Course deleted = createCourse("Deleted Cart Course", money("100000"), CourseStatus.PUBLISHED, true);
        mockMvc.perform(post("/api/v1/cart/{courseId}", deleted.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isNotFound());

        createEnrollment(student, course, null, BigDecimal.ZERO);
        mockMvc.perform(post("/api/v1/cart/{courseId}", course.getId())
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldValidateCouponsAgainstCurrentCart() throws Exception {
        Course course = createCourse("Coupon Course", money("200000"), CourseStatus.PUBLISHED, false);
        addToCart(course.getId(), studentToken, status().isCreated());
        createCoupon("WELCOME20", DiscountType.PERCENT, money("20"), 100, 0, money("100000"),
                true, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1));
        createCoupon("FIXED50K", DiscountType.FIXED, money("50000"), 100, 0, null,
                true, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1));
        createCoupon("INACTIVE", DiscountType.PERCENT, money("10"), 100, 0, null,
                false, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1));
        createCoupon("EXPIRED", DiscountType.PERCENT, money("10"), 100, 0, null,
                true, LocalDateTime.now().minusDays(5), LocalDateTime.now().minusDays(1));
        createCoupon("USEDUP", DiscountType.PERCENT, money("10"), 1, 1, null,
                true, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1));
        createCoupon("MINHIGH", DiscountType.PERCENT, money("10"), 100, 0, money("300000"),
                true, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1));

        validateCoupon("WELCOME20", status().isOk())
                .andExpect(jsonPath("$.data.discountAmount").value(40000.0))
                .andExpect(jsonPath("$.data.totalAmount").value(160000.0));

        validateCoupon("FIXED50K", status().isOk())
                .andExpect(jsonPath("$.data.discountAmount").value(50000.0))
                .andExpect(jsonPath("$.data.totalAmount").value(150000.0));

        validateCoupon("INACTIVE", status().isBadRequest());
        validateCoupon("EXPIRED", status().isBadRequest());
        validateCoupon("USEDUP", status().isBadRequest());
        validateCoupon("MINHIGH", status().isBadRequest());
    }

    @Test
    void shouldCheckoutPaidCartAsPendingWithoutEnrollmentAndWithoutConsumingCoupon() throws Exception {
        Course course = createCourse("Paid Checkout Course", money("200000"), CourseStatus.PUBLISHED, false);
        Coupon coupon = createCoupon("SAVE20", DiscountType.PERCENT, money("20"), 100, 0, null,
                true, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1));
        addToCart(course.getId(), studentToken, status().isCreated());

        mockMvc.perform(post("/api/v1/orders/checkout")
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "couponCode": "SAVE20" }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.totalAmount").value(160000.0))
                .andExpect(jsonPath("$.data.items", hasSize(1)))
                .andExpect(jsonPath("$.data.items[0].finalPrice").value(160000.0));

        assertThat(enrollmentRepository.existsByUserIdAndCourseId(student.getId(), course.getId())).isFalse();
        assertThat(couponRepository.findById(coupon.getId()).orElseThrow().getUsedCount()).isZero();

        mockMvc.perform(get("/api/v1/cart")
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.itemCount").value(0));

        mockMvc.perform(get("/api/v1/orders/me")
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(1)))
                .andExpect(jsonPath("$.data.content[0].status").value("PENDING"));

        mockMvc.perform(get("/api/v1/orders/me")
                        .header("Authorization", bearer(otherStudentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.content", hasSize(0)));
    }

    @Test
    void shouldCheckoutZeroTotalAsPaidAndCreateEnrollment() throws Exception {
        Course course = createCourse("Zero Checkout Course", money("100000"), CourseStatus.PUBLISHED, false);
        Coupon coupon = createCoupon("FULLFREE", DiscountType.FIXED, money("200000"), 100, 0, null,
                true, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1));
        addToCart(course.getId(), studentToken, status().isCreated());

        JsonNode response = postJson("/api/v1/orders/checkout", """
                { "couponCode": "FULLFREE" }
                """, studentToken, status().isCreated());
        Long orderItemId = response.at("/data/items/0/id").asLong();

        assertThat(response.at("/data/status").asText()).isEqualTo("PAID");
        assertThat(response.at("/data/paymentGateway").asText()).isEqualTo("FREE");
        assertThat(response.at("/data/totalAmount").decimalValue()).isEqualByComparingTo(BigDecimal.ZERO);

        Enrollment enrollment = enrollmentRepository.findByUserIdAndCourseId(student.getId(), course.getId())
                .orElseThrow();
        assertThat(enrollment.getStatus()).isEqualTo(EnrollmentStatus.ACTIVE);
        assertThat(enrollment.getOrderItemId()).isEqualTo(orderItemId);
        assertThat(couponRepository.findById(coupon.getId()).orElseThrow().getUsedCount()).isEqualTo(1);
        assertThat(courseRepository.findById(course.getId()).orElseThrow().getTotalEnrollments()).isEqualTo(1);
    }

    @Test
    void shouldGetOrderByIdAndDenyOtherStudent() throws Exception {
        Course course = createCourse("GetById Course", money("150000"), CourseStatus.PUBLISHED, false);
        addToCart(course.getId(), studentToken, status().isCreated());

        JsonNode checkoutResponse = postJson("/api/v1/orders/checkout", """
                { "couponCode": null }
                """, studentToken, status().isCreated());
        Long orderId = checkoutResponse.at("/data/id").asLong();

        mockMvc.perform(get("/api/v1/orders/{id}", orderId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(orderId))
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.items", hasSize(1)));

        mockMvc.perform(get("/api/v1/orders/{id}", orderId)
                        .header("Authorization", bearer(otherStudentToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/orders/{id}", 999999L)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isNotFound());
    }

    @Test
    void shouldCancelPendingOrderAndRejectNonPendingCancel() throws Exception {
        Course course = createCourse("Cancel Course", money("120000"), CourseStatus.PUBLISHED, false);
        addToCart(course.getId(), studentToken, status().isCreated());

        JsonNode checkoutResponse = postJson("/api/v1/orders/checkout", """
                { "couponCode": null }
                """, studentToken, status().isCreated());
        Long orderId = checkoutResponse.at("/data/id").asLong();
        assertThat(checkoutResponse.at("/data/status").asText()).isEqualTo("PENDING");

        mockMvc.perform(patch("/api/v1/orders/{id}/cancel", orderId)
                        .header("Authorization", bearer(otherStudentToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(patch("/api/v1/orders/{id}/cancel", orderId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("CANCELLED"));

        mockMvc.perform(patch("/api/v1/orders/{id}/cancel", orderId)
                        .header("Authorization", bearer(studentToken)))
                .andExpect(status().isConflict());
    }

    @Test
    void shouldCreateVnPayPaymentAndCompleteViaDuplicateSafeIpn() throws Exception {
        Course course = createCourse("VNPay Success Course", money("200000"), CourseStatus.PUBLISHED, false);
        Coupon coupon = createCoupon("VNPAY20", DiscountType.PERCENT, money("20"), 100, 0, null,
                true, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1));
        addToCart(course.getId(), studentToken, status().isCreated());
        Long orderId = postJson("/api/v1/orders/checkout", """
                { "couponCode": "VNPAY20" }
                """, studentToken, status().isCreated()).at("/data/id").asLong();

        JsonNode createResponse = postJson("/api/v1/payments/vnpay/create", """
                { "orderId": %d }
                """.formatted(orderId), studentToken, status().isCreated());
        Long txId = createResponse.at("/data/paymentTransactionId").asLong();
        assertThat(createResponse.at("/data/payUrl").asText()).contains("vnp_SecureHash=");

        PaymentTransaction tx = paymentTransactionRepository.findById(txId).orElseThrow();
        Map<String, String> params = signedVnPayParams(tx, "00", "00", "VNPAY_TX_001", tx.getPayType(),
                vnPayMinorAmount(tx.getAmount()));

        getVnPayIpn(params)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.RspCode").value("00"));
        postVnPayIpn(params)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.RspCode").value("00"));

        Order paidOrder = orderRepository.findDetailedById(orderId).orElseThrow();
        PaymentTransaction paidTx = paymentTransactionRepository.findById(txId).orElseThrow();
        assertThat(paidOrder.getStatus()).isEqualTo(OrderStatus.PAID);
        assertThat(paidOrder.getPaymentGateway()).isEqualTo(PaymentGateway.VNPAY);
        assertThat(paidOrder.getGatewayTransactionId()).isEqualTo("VNPAY_TX_001");
        assertThat(paidTx.getStatus()).isEqualTo(TxStatus.SUCCESS);
        assertThat(enrollmentRepository.countByUserId(student.getId())).isEqualTo(1);
        assertThat(couponRepository.findById(coupon.getId()).orElseThrow().getUsedCount()).isEqualTo(1);
        assertThat(courseRepository.findById(course.getId()).orElseThrow().getTotalEnrollments()).isEqualTo(1);
        assertThat(notificationRepository.findAll().stream().map(notification -> notification.getType()).toList())
                .contains(NotificationType.ORDER_PAID, NotificationType.PAYMENT_PAID);
    }

    @Test
    void shouldRejectVnPayInvalidSignatureWithoutChangingOrder() throws Exception {
        Long orderId = createPendingGatewayOrder("VNPay Invalid Signature Course", studentToken);
        Long txId = postJson("/api/v1/payments/vnpay/create", """
                { "orderId": %d }
                """.formatted(orderId), studentToken, status().isCreated())
                .at("/data/paymentTransactionId").asLong();
        PaymentTransaction tx = paymentTransactionRepository.findById(txId).orElseThrow();

        Map<String, String> params = unsignedVnPayParams(tx, "00", "00", "VNPAY_TX_BAD_SIG",
                vnPayMinorAmount(tx.getAmount()));
        params.put("vnp_SecureHash", "bad-signature");

        postVnPayIpn(params)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.RspCode").value("97"));

        assertThat(orderRepository.findById(orderId).orElseThrow().getStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(paymentTransactionRepository.findById(txId).orElseThrow().getStatus()).isEqualTo(TxStatus.PENDING);
        assertThat(enrollmentRepository.countByUserId(student.getId())).isZero();
    }

    @Test
    void shouldRejectVnPayAmountMismatchWithoutCreatingEnrollment() throws Exception {
        Long orderId = createPendingGatewayOrder("VNPay Amount Mismatch Course", studentToken);
        Long txId = postJson("/api/v1/payments/vnpay/create", """
                { "orderId": %d }
                """.formatted(orderId), studentToken, status().isCreated())
                .at("/data/paymentTransactionId").asLong();
        PaymentTransaction tx = paymentTransactionRepository.findById(txId).orElseThrow();

        postVnPayIpn(signedVnPayParams(tx, "00", "00", "VNPAY_TX_AMOUNT", null, "999999"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.RspCode").value("04"));

        assertThat(orderRepository.findById(orderId).orElseThrow().getStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(paymentTransactionRepository.findById(txId).orElseThrow().getStatus()).isEqualTo(TxStatus.FAILED);
        assertThat(enrollmentRepository.countByUserId(student.getId())).isZero();
    }

    @Test
    void shouldKeepOrderPendingForTerminalVnPayFailureAndAllowRetry() throws Exception {
        Long orderId = createPendingGatewayOrder("VNPay Failed Course", studentToken);
        Long txId = postJson("/api/v1/payments/vnpay/create", """
                { "orderId": %d }
                """.formatted(orderId), studentToken, status().isCreated())
                .at("/data/paymentTransactionId").asLong();
        PaymentTransaction tx = paymentTransactionRepository.findById(txId).orElseThrow();

        postVnPayIpn(signedVnPayParams(tx, "24", "02", "VNPAY_TX_FAILED", null,
                        vnPayMinorAmount(tx.getAmount())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.RspCode").value("00"));

        assertThat(orderRepository.findById(orderId).orElseThrow().getStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(paymentTransactionRepository.findById(txId).orElseThrow().getStatus()).isEqualTo(TxStatus.FAILED);
        assertThat(enrollmentRepository.countByUserId(student.getId())).isZero();
        assertThat(notificationRepository.findAll().stream().map(notification -> notification.getType()).toList())
                .contains(NotificationType.PAYMENT_FAILED);

        Long retryTxId = postJson("/api/v1/payments/vnpay/create", """
                { "orderId": %d }
                """.formatted(orderId), studentToken, status().isCreated())
                .at("/data/paymentTransactionId").asLong();
        assertThat(retryTxId).isNotEqualTo(txId);
        assertThat(paymentTransactionRepository.findById(retryTxId).orElseThrow().getStatus())
                .isEqualTo(TxStatus.PENDING);
    }

    @Test
    void shouldRejectGatewayCreateForNonOwner() throws Exception {
        Long orderId = createPendingGatewayOrder("Non Owner Gateway Course", studentToken);

        mockMvc.perform(post("/api/v1/payments/vnpay/create")
                        .header("Authorization", bearer(otherStudentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "orderId": %d }
                                """.formatted(orderId)))
                .andExpect(status().isForbidden());
    }

    @Test
    void shouldCreateMomoPaymentAndCompleteViaIpn() throws Exception {
        when(momoClient.createPayment(any(MomoCreatePaymentPayload.class))).thenAnswer(invocation -> {
            MomoCreatePaymentPayload payload = invocation.getArgument(0);
            assertThat(payload.partnerCode()).isEqualTo("MOMO");
            assertThat(payload.storeName()).isEqualTo("Skillora");
            assertThat(payload.storeId()).isEqualTo("SkilloraStore");
            assertThat(payload.requestType()).isEqualTo("captureWallet");
            assertThat(payload.ipnUrl()).isEqualTo("http://localhost:8080/api/v1/payments/momo/ipn");
            assertThat(payload.redirectUrl()).isEqualTo("http://localhost:8080/api/v1/payments/momo/return");
            return new MomoCreatePaymentResult(
                    payload.partnerCode(),
                    payload.requestId(),
                    payload.orderId(),
                    payload.amount(),
                    123L,
                    "Successful.",
                    0,
                    "https://pay.momo.vn/" + payload.orderId(),
                    "https://momo.vn/short/" + payload.orderId()
            );
        });
        Long orderId = createPendingGatewayOrder("MoMo Success Course", studentToken);

        JsonNode createResponse = postJson("/api/v1/payments/momo/create", """
                { "orderId": %d }
                """.formatted(orderId), studentToken, status().isCreated());
        Long txId = createResponse.at("/data/paymentTransactionId").asLong();
        PaymentTransaction tx = paymentTransactionRepository.findById(txId).orElseThrow();
        JsonNode rawRequest = objectMapper.readTree(tx.getRawRequest());
        assertThat(rawRequest.at("/storeName").asText()).isEqualTo("Skillora");
        assertThat(rawRequest.at("/partnerName").isMissingNode()).isTrue();
        assertThat(rawRequest.at("/requestType").asText()).isEqualTo("captureWallet");

        MomoIpnRequest ipn = momoIpn(tx, 0, "Successful.", "qr", "1001");
        ipn.setSignature(paymentService.signMomoIpnForTest(ipn));
        postMomoIpn(ipn).andExpect(status().isNoContent());
        postMomoIpn(ipn).andExpect(status().isNoContent());

        Order paidOrder = orderRepository.findDetailedById(orderId).orElseThrow();
        PaymentTransaction paidTx = paymentTransactionRepository.findById(txId).orElseThrow();
        assertThat(paidOrder.getStatus()).isEqualTo(OrderStatus.PAID);
        assertThat(paidOrder.getPaymentGateway()).isEqualTo(PaymentGateway.MOMO);
        assertThat(paidOrder.getGatewayTransactionId()).isEqualTo("1001");
        assertThat(paidTx.getStatus()).isEqualTo(TxStatus.SUCCESS);
        assertThat(enrollmentRepository.countByUserId(student.getId())).isEqualTo(1);
    }

    @Test
    void shouldRejectMomoIpnWithInvalidSignature() throws Exception {
        when(momoClient.createPayment(any(MomoCreatePaymentPayload.class))).thenAnswer(invocation -> {
            MomoCreatePaymentPayload payload = invocation.getArgument(0);
            return new MomoCreatePaymentResult(payload.partnerCode(), payload.requestId(), payload.orderId(),
                    payload.amount(), 123L, "Successful.", 0, "https://pay.momo.vn/" + payload.orderId(), null);
        });
        Long orderId = createPendingGatewayOrder("MoMo Bad Signature Course", studentToken);
        Long txId = postJson("/api/v1/payments/momo/create", """
                { "orderId": %d }
                """.formatted(orderId), studentToken, status().isCreated())
                .at("/data/paymentTransactionId").asLong();
        PaymentTransaction tx = paymentTransactionRepository.findById(txId).orElseThrow();
        MomoIpnRequest ipn = momoIpn(tx, 0, "Successful.", "qr", "1002");
        ipn.setSignature("bad-signature");

        postMomoIpn(ipn).andExpect(status().isBadRequest());

        assertThat(orderRepository.findById(orderId).orElseThrow().getStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(paymentTransactionRepository.findById(txId).orElseThrow().getStatus()).isEqualTo(TxStatus.PENDING);
        assertThat(enrollmentRepository.countByUserId(student.getId())).isZero();
    }

    @Test
    void shouldKeepOrderPendingForTerminalMomoFailureAndAllowRetry() throws Exception {
        when(momoClient.createPayment(any(MomoCreatePaymentPayload.class))).thenAnswer(invocation -> {
            MomoCreatePaymentPayload payload = invocation.getArgument(0);
            return new MomoCreatePaymentResult(payload.partnerCode(), payload.requestId(), payload.orderId(),
                    payload.amount(), 123L, "Created.", 0, "https://pay.momo.vn/" + payload.orderId(), null);
        });
        Long orderId = createPendingGatewayOrder("MoMo Failed Course", studentToken);
        Long txId = postJson("/api/v1/payments/momo/create", """
                { "orderId": %d }
                """.formatted(orderId), studentToken, status().isCreated())
                .at("/data/paymentTransactionId").asLong();
        PaymentTransaction tx = paymentTransactionRepository.findById(txId).orElseThrow();
        MomoIpnRequest ipn = momoIpn(tx, 1006, "Payment failed.", "qr", "1003");
        ipn.setSignature(paymentService.signMomoIpnForTest(ipn));

        postMomoIpn(ipn).andExpect(status().isNoContent());

        assertThat(orderRepository.findById(orderId).orElseThrow().getStatus()).isEqualTo(OrderStatus.PENDING);
        assertThat(paymentTransactionRepository.findById(txId).orElseThrow().getStatus()).isEqualTo(TxStatus.FAILED);
        assertThat(enrollmentRepository.countByUserId(student.getId())).isZero();

        Long retryTxId = postJson("/api/v1/payments/momo/create", """
                { "orderId": %d }
                """.formatted(orderId), studentToken, status().isCreated())
                .at("/data/paymentTransactionId").asLong();
        assertThat(retryTxId).isNotEqualTo(txId);
    }

    @Test
    void shouldSerializeConcurrentReturnAndIpnWithAlreadyLoadedPendingOrders() throws Exception {
        Course course = createCourse("Concurrent settlement", money("200000"), CourseStatus.PUBLISHED, false);
        Coupon coupon = createCoupon("CONCURRENT20", DiscountType.PERCENT, money("20"), 100, 0, null,
                true, LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(1));
        addToCart(course.getId(), studentToken, status().isCreated());
        Long orderId = postJson("/api/v1/orders/checkout", "{\"couponCode\":\"CONCURRENT20\"}",
                studentToken, status().isCreated()).at("/data/id").asLong();
        Long txId = postJson("/api/v1/payments/vnpay/create", "{\"orderId\":" + orderId + "}",
                studentToken, status().isCreated()).at("/data/paymentTransactionId").asLong();
        PaymentTransaction tx = paymentTransactionRepository.findById(txId).orElseThrow();
        Map<String, String> params = signedVnPayParams(tx, "00", "00", "RACE_TX", null,
                vnPayMinorAmount(tx.getAmount()));
        CountDownLatch ready = new CountDownLatch(2);
        CountDownLatch start = new CountDownLatch(1);
        var executor = Executors.newFixedThreadPool(2);
        try {
            var futures = java.util.stream.IntStream.range(0, 2).mapToObj(index -> executor.submit(() ->
                    new TransactionTemplate(transactionManager).execute(transaction -> {
                        assertThat(orderRepository.findById(orderId).orElseThrow().getStatus()).isEqualTo(OrderStatus.PENDING);
                        ready.countDown();
                        try {
                            if (!start.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("Callback start timed out");
                        } catch (InterruptedException ex) {
                            Thread.currentThread().interrupt();
                            throw new IllegalStateException(ex);
                        }
                        if (index == 0) {
                            assertThat(paymentService.handleVnPayIpn(params).rspCode()).isEqualTo("00");
                        } else {
                            assertThat(paymentService.handleVnPayReturn(params).getUrl()).contains("status=PAID");
                        }
                        return true;
                    }))).toList();
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            for (var future : futures) assertThat(future.get(20, TimeUnit.SECONDS)).isTrue();
        } finally {
            start.countDown();
            executor.shutdownNow();
            assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();
        }
        assertThat(orderRepository.findById(orderId).orElseThrow().getStatus()).isEqualTo(OrderStatus.PAID);
        assertThat(enrollmentRepository.countByUserId(student.getId())).isEqualTo(1);
        assertThat(couponRepository.findById(coupon.getId()).orElseThrow().getUsedCount()).isEqualTo(1);
        var notifications = notificationRepository.findAll();
        assertThat(notifications.stream().filter(item -> item.getType() == NotificationType.ORDER_PAID).count()).isEqualTo(1);
        assertThat(notifications.stream().filter(item -> item.getType() == NotificationType.PAYMENT_PAID).count()).isEqualTo(1);
    }

    @Test
    void shouldNotEnrollOnSuccessfulCallbackAfterOrderCancellation() throws Exception {
        Long orderId = createPendingGatewayOrder("Cancelled callback", studentToken);
        Long txId = postJson("/api/v1/payments/vnpay/create", "{\"orderId\":" + orderId + "}",
                studentToken, status().isCreated()).at("/data/paymentTransactionId").asLong();
        PaymentTransaction tx = paymentTransactionRepository.findById(txId).orElseThrow();
        Map<String, String> params = signedVnPayParams(tx, "00", "00", "LATE_TX", null,
                vnPayMinorAmount(tx.getAmount()));
        mockMvc.perform(patch("/api/v1/orders/{id}/cancel", orderId).header("Authorization", bearer(studentToken)))
                .andExpect(status().isOk());
        assertThatThrownBy(() -> paymentService.handleVnPayIpn(params))
                .isInstanceOf(com.example.skillora_platform.exception.BusinessException.class);
        assertThat(orderRepository.findById(orderId).orElseThrow().getStatus()).isEqualTo(OrderStatus.CANCELLED);
        assertThat(paymentTransactionRepository.findById(txId).orElseThrow().getStatus()).isEqualTo(TxStatus.PENDING);
        assertThat(enrollmentRepository.countByUserId(student.getId())).isZero();
    }

    private JsonNode addToCart(Long courseId, String accessToken, ResultMatcher expectedStatus) throws Exception {
        String response = mockMvc.perform(post("/api/v1/cart/{courseId}", courseId)
                        .header("Authorization", bearer(accessToken)))
                .andExpect(expectedStatus)
                .andReturn()
                .getResponse()
                .getContentAsString();
        return objectMapper.readTree(response);
    }

    private ResultActions validateCoupon(String code, ResultMatcher expectedStatus) throws Exception {
        return mockMvc.perform(post("/api/v1/coupons/validate")
                        .header("Authorization", bearer(studentToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                { "code": "%s" }
                                """.formatted(code)))
                .andExpect(expectedStatus);
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

    private Long createPendingGatewayOrder(String title, String accessToken) throws Exception {
        Course course = createCourse(title, money("120000"), CourseStatus.PUBLISHED, false);
        addToCart(course.getId(), accessToken, status().isCreated());
        return postJson("/api/v1/orders/checkout", """
                { "couponCode": null }
                """, accessToken, status().isCreated()).at("/data/id").asLong();
    }

    private ResultActions postVnPayIpn(Map<String, String> params) throws Exception {
        MockHttpServletRequestBuilder request = post("/api/v1/payments/vnpay/ipn")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED);
        params.forEach(request::param);
        return mockMvc.perform(request);
    }

    private ResultActions getVnPayIpn(Map<String, String> params) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/v1/payments/vnpay/ipn");
        params.forEach(request::param);
        return mockMvc.perform(request);
    }

    private ResultActions postMomoIpn(MomoIpnRequest request) throws Exception {
        return mockMvc.perform(post("/api/v1/payments/momo/ipn")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)));
    }

    private Map<String, String> signedVnPayParams(
            PaymentTransaction tx,
            String responseCode,
            String transactionStatus,
            String transactionNo,
            String cardType,
            String amount
    ) {
        return paymentService.signVnPayParamsForTest(
                unsignedVnPayParams(tx, responseCode, transactionStatus, transactionNo, amount, cardType));
    }

    private Map<String, String> unsignedVnPayParams(
            PaymentTransaction tx,
            String responseCode,
            String transactionStatus,
            String transactionNo,
            String amount
    ) {
        return unsignedVnPayParams(tx, responseCode, transactionStatus, transactionNo, amount, null);
    }

    private Map<String, String> unsignedVnPayParams(
            PaymentTransaction tx,
            String responseCode,
            String transactionStatus,
            String transactionNo,
            String amount,
            String cardType
    ) {
        Map<String, String> params = new LinkedHashMap<>();
        params.put("vnp_TmnCode", "TESTTMN");
        params.put("vnp_TxnRef", tx.getGatewayOrderId());
        params.put("vnp_Amount", amount);
        params.put("vnp_ResponseCode", responseCode);
        params.put("vnp_TransactionStatus", transactionStatus);
        params.put("vnp_TransactionNo", transactionNo);
        params.put("vnp_PayDate", "20260605120000");
        if (cardType != null) {
            params.put("vnp_CardType", cardType);
        }
        return params;
    }

    private String vnPayMinorAmount(BigDecimal amount) {
        return String.valueOf(amount.movePointRight(2).longValueExact());
    }

    private MomoIpnRequest momoIpn(
            PaymentTransaction tx,
            int resultCode,
            String message,
            String payType,
            String transId
    ) {
        MomoIpnRequest request = new MomoIpnRequest();
        request.setPartnerCode("MOMO");
        request.setOrderId(tx.getGatewayOrderId());
        request.setRequestId(tx.getRequestId());
        request.setAmount(tx.getAmount().setScale(0).longValueExact());
        request.setOrderInfo("Skillora order #" + tx.getOrder().getId());
        request.setOrderType("momo_wallet");
        request.setTransId(Long.valueOf(transId));
        request.setResultCode(resultCode);
        request.setMessage(message);
        request.setPayType(payType);
        request.setResponseTime(1760000000000L);
        request.setExtraData("");
        return request;
    }

    private Course createCourse(String title, BigDecimal price, CourseStatus status, boolean deleted) {
        Course course = Course.builder()
                .instructor(instructor)
                .title(title)
                .slug(slug(title))
                .subtitle("Commerce test course")
                .description("Commerce test course description")
                .level(CourseLevel.BEGINNER)
                .language("vi")
                .price(price)
                .currency("VND")
                .status(status)
                .totalLessons(0)
                .totalDurationSeconds(0)
                .totalEnrollments(0)
                .avgRating(BigDecimal.ZERO)
                .totalReviews(0)
                .publishedAt(status == CourseStatus.PUBLISHED ? LocalDateTime.now() : null)
                .deletedAt(deleted ? LocalDateTime.now() : null)
                .build();
        return courseRepository.save(course);
    }

    private Coupon createCoupon(
            String code,
            DiscountType type,
            BigDecimal value,
            Integer maxUses,
            int usedCount,
            BigDecimal minOrderAmount,
            boolean active,
            LocalDateTime startsAt,
            LocalDateTime expiresAt
    ) {
        return couponRepository.save(Coupon.builder()
                .code(code)
                .name(code + " coupon")
                .discountType(type)
                .discountValue(value)
                .maxUses(maxUses)
                .usedCount(usedCount)
                .minOrderAmount(minOrderAmount)
                .active(active)
                .startsAt(startsAt)
                .expiresAt(expiresAt)
                .build());
    }

    private Enrollment createEnrollment(User user, Course course, Long orderItemId, BigDecimal amountPaid) {
        return enrollmentRepository.save(Enrollment.builder()
                .user(user)
                .course(course)
                .orderItemId(orderItemId)
                .status(EnrollmentStatus.ACTIVE)
                .amountPaid(amountPaid)
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

    private BigDecimal money(String value) {
        return new BigDecimal(value);
    }

    private String slug(String title) {
        return title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-")
                + "-" + System.nanoTime();
    }

    private void cleanDatabase() {
        notificationRepository.deleteAll();
        enrollmentRepository.deleteAll();
        cartItemRepository.deleteAll();
        cartRepository.deleteAll();
        wishlistRepository.deleteAll();
        paymentTransactionRepository.deleteAll();
        orderItemRepository.deleteAll();
        orderRepository.deleteAll();
        couponRepository.deleteAll();
        courseRepository.deleteAll();
        userRepository.deleteAll();
    }
}
