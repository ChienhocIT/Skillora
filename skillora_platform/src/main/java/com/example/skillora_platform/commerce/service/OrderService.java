package com.example.skillora_platform.commerce.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.skillora_platform.commerce.dto.CheckoutRequest;
import com.example.skillora_platform.commerce.dto.OrderItemResponse;
import com.example.skillora_platform.commerce.dto.OrderResponse;
import com.example.skillora_platform.commerce.entity.Cart;
import com.example.skillora_platform.commerce.entity.CartItem;
import com.example.skillora_platform.commerce.entity.Coupon;
import com.example.skillora_platform.commerce.entity.Order;
import com.example.skillora_platform.commerce.entity.OrderItem;
import com.example.skillora_platform.commerce.entity.OrderStatus;
import com.example.skillora_platform.commerce.entity.PaymentGateway;
import com.example.skillora_platform.commerce.repository.CartItemRepository;
import com.example.skillora_platform.commerce.repository.CouponRepository;
import com.example.skillora_platform.commerce.repository.OrderRepository;
import com.example.skillora_platform.common.Constants;
import com.example.skillora_platform.common.PageResponse;
import com.example.skillora_platform.course.entity.Course;
import com.example.skillora_platform.course.entity.CourseStatus;
import com.example.skillora_platform.course.repository.CourseRepository;
import com.example.skillora_platform.course.service.CoursePermissionService;
import com.example.skillora_platform.enrollment.entity.Enrollment;
import com.example.skillora_platform.enrollment.entity.EnrollmentStatus;
import com.example.skillora_platform.enrollment.repository.EnrollmentRepository;
import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.exception.ResourceNotFoundException;
import com.example.skillora_platform.notification.event.CourseEnrolledEvent;
import com.example.skillora_platform.notification.event.OrderCancelledEvent;
import com.example.skillora_platform.notification.event.OrderCreatedEvent;
import com.example.skillora_platform.notification.event.OrderPaidEvent;
import com.example.skillora_platform.notification.event.PaymentFailedEvent;
import com.example.skillora_platform.notification.event.PaymentPaidEvent;
import com.example.skillora_platform.user.entity.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class OrderService {

    private static final int MONEY_SCALE = 2;

    private final OrderRepository orderRepository;
    private final EntityManager entityManager;
    private final CartItemRepository cartItemRepository;
    private final CouponRepository couponRepository;
    private final CourseRepository courseRepository;
    private final EnrollmentRepository enrollmentRepository;
    private final CoursePermissionService permissionService;
    private final CartService cartService;
    private final CouponService couponService;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public OrderResponse checkout(CheckoutRequest request, String actorEmail) {
        User actor = permissionService.requireActor(actorEmail);
        Cart cart = cartService.findCartWithItems(actor);
        List<CartItem> cartItems = cartService.sortedItems(cart);
        if (cart == null || cartItems.isEmpty()) {
            throw new BusinessException("Cart is empty", HttpStatus.BAD_REQUEST);
        }

        validateCart(actor, cart);
        BigDecimal subtotal = scale(cartService.subtotal(cart));
        String currency = cartService.currencyOrDefault(cart);
        LocalDateTime now = LocalDateTime.now();
        AppliedCoupon appliedCoupon = couponService.applyCoupon(request.getCouponCode(), subtotal, now);
        boolean freeCheckout = appliedCoupon.totalAmount().compareTo(BigDecimal.ZERO) == 0;

        Order order = Order.builder()
                .user(actor)
                .coupon(appliedCoupon.coupon())
                .subtotalAmount(subtotal)
                .discountAmount(appliedCoupon.discountAmount())
                .totalAmount(appliedCoupon.totalAmount())
                .currency(currency)
                .status(freeCheckout ? OrderStatus.PAID : OrderStatus.PENDING)
                .paymentGateway(freeCheckout ? PaymentGateway.FREE : null)
                .paidAt(freeCheckout ? now : null)
                .build();
        attachOrderItems(order, cartItems, appliedCoupon.discountAmount(), subtotal);

        Order saved = orderRepository.saveAndFlush(order);
        if (freeCheckout) {
            createEnrollments(saved, actor, now);
            consumeCoupon(saved.getCoupon());
        }
        cartItemRepository.deleteByCartId(cart.getId());
        eventPublisher.publishEvent(new OrderCreatedEvent(saved.getId()));
        if (freeCheckout) {
            eventPublisher.publishEvent(new OrderPaidEvent(saved.getId()));
        }

        log.info("User {} checked out order {} with status {}", actor.getId(), saved.getId(), saved.getStatus());
        return toResponse(saved);
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderResponse> myOrders(String actorEmail, int page, int size) {
        User actor = permissionService.requireActor(actorEmail);
        int safeSize = Math.min(Math.max(size, 1), Constants.MAX_PAGE_SIZE);
        Pageable pageable = PageRequest.of(Math.max(page, 0), safeSize);
        Page<OrderResponse> orders = orderRepository
                .findDistinctByUserIdOrderByCreatedAtDesc(actor.getId(), pageable)
                .map(this::toResponse);
        return PageResponse.from(orders);
    }

    @Transactional(readOnly = true)
    public OrderResponse getOrderById(Long orderId, String actorEmail) {
        User actor = permissionService.requireActor(actorEmail);
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + orderId));
        if (!order.getUser().getId().equals(actor.getId())) {
            throw new BusinessException("You do not own this order", HttpStatus.FORBIDDEN);
        }
        return toResponse(order);
    }

    @Transactional
    public OrderResponse cancelOrder(Long orderId, String actorEmail) {
        User actor = permissionService.requireActor(actorEmail);
        Order order = lockOrder(orderId);
        if (!order.getUser().getId().equals(actor.getId())) {
            throw new BusinessException("You do not own this order", HttpStatus.FORBIDDEN);
        }
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new BusinessException("Only PENDING orders can be cancelled", HttpStatus.CONFLICT);
        }
        order.setStatus(OrderStatus.CANCELLED);
        Order saved = orderRepository.save(order);
        eventPublisher.publishEvent(new OrderCancelledEvent(saved.getId()));
        log.info("User {} cancelled order {}", actor.getId(), saved.getId());
        return toResponse(saved);
    }

    @Transactional
    public void markPaidFromGateway(
            Long orderId,
            PaymentGateway gateway,
            String gatewayTransactionId,
            Long paymentTransactionId
    ) {
        Order order = lockOrder(orderId);
        if (order.getStatus() == OrderStatus.PAID) {
            return;
        }
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new BusinessException("Only PENDING orders can be marked as paid", HttpStatus.CONFLICT);
        }

        LocalDateTime now = LocalDateTime.now();
        order.setStatus(OrderStatus.PAID);
        order.setPaymentGateway(gateway);
        order.setGatewayTransactionId(gatewayTransactionId);
        order.setPaidAt(now);
        order.setFailureReason(null);
        createEnrollments(order, order.getUser(), now);
        consumeCoupon(order.getCoupon());
        orderRepository.save(order);
        eventPublisher.publishEvent(new OrderPaidEvent(order.getId()));
        eventPublisher.publishEvent(new PaymentPaidEvent(order.getId(), paymentTransactionId));

        log.info("Order {} marked as paid by {}", order.getId(), gateway);
    }

    @Transactional
    public void markFailedFromGateway(Long orderId, Long paymentTransactionId, String reason) {
        Order order = lockOrder(orderId);
        if (order.getStatus() != OrderStatus.PENDING) {
            return;
        }
        order.setFailureReason(reason);
        orderRepository.save(order);
        eventPublisher.publishEvent(new PaymentFailedEvent(order.getId(), paymentTransactionId, reason));

        log.info("Payment attempt failed for order {}, keeping order pending: {}", order.getId(), reason);
    }

    @Transactional
    public Order lockOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + orderId));
        // Refresh under the lock: a callback may already hold an older managed Order instance.
        entityManager.refresh(order, LockModeType.PESSIMISTIC_WRITE);
        return order;
    }

    private void validateCart(User actor, Cart cart) {
        cartService.requireSingleCurrency(cart);
        for (CartItem item : cartService.sortedItems(cart)) {
            Course course = item.getCourse();
            if (course.getDeletedAt() != null || course.getStatus() != CourseStatus.PUBLISHED) {
                throw new BusinessException("Course is no longer available: " + course.getTitle(),
                        HttpStatus.BAD_REQUEST);
            }
            if (enrollmentRepository.existsByUserIdAndCourseId(actor.getId(), course.getId())) {
                throw new BusinessException("Already enrolled in course: " + course.getTitle(), HttpStatus.CONFLICT);
            }
        }
    }

    private void attachOrderItems(
            Order order,
            List<CartItem> cartItems,
            BigDecimal totalDiscount,
            BigDecimal subtotal
    ) {
        BigDecimal allocatedDiscount = BigDecimal.ZERO;
        List<CartItem> items = new ArrayList<>(cartItems);
        for (int i = 0; i < items.size(); i++) {
            Course course = items.get(i).getCourse();
            BigDecimal price = scale(cartService.effectivePrice(course));
            BigDecimal itemDiscount = i == items.size() - 1
                    ? totalDiscount.subtract(allocatedDiscount)
                    : proportionalDiscount(price, subtotal, totalDiscount);
            itemDiscount = scale(itemDiscount.min(price).max(BigDecimal.ZERO));
            allocatedDiscount = allocatedDiscount.add(itemDiscount);

            OrderItem orderItem = OrderItem.builder()
                    .order(order)
                    .course(course)
                    .price(price)
                    .discountAmount(itemDiscount)
                    .finalPrice(scale(price.subtract(itemDiscount).max(BigDecimal.ZERO)))
                    .courseTitleSnapshot(course.getTitle())
                    .build();
            order.getItems().add(orderItem);
        }
    }

    private BigDecimal proportionalDiscount(BigDecimal price, BigDecimal subtotal, BigDecimal totalDiscount) {
        if (subtotal.compareTo(BigDecimal.ZERO) <= 0 || totalDiscount.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return price.multiply(totalDiscount).divide(subtotal, MONEY_SCALE, RoundingMode.HALF_UP);
    }

    private void createEnrollments(Order order, User actor, LocalDateTime now) {
        for (OrderItem item : order.getItems()) {
            Course course = item.getCourse();
            if (enrollmentRepository.existsByUserIdAndCourseId(actor.getId(), course.getId())) {
                log.info("Enrollment already exists for user {} and course {}, skipping duplicate",
                        actor.getId(), course.getId());
                continue;
            }
            Enrollment enrollment = Enrollment.builder()
                    .user(actor)
                    .course(course)
                    .orderItemId(item.getId())
                    .status(EnrollmentStatus.ACTIVE)
                    .amountPaid(item.getFinalPrice())
                    .progressPercent(BigDecimal.ZERO)
                    .enrolledAt(now)
                    .build();
            Enrollment savedEnrollment = enrollmentRepository.save(enrollment);
            eventPublisher.publishEvent(new CourseEnrolledEvent(savedEnrollment.getId()));

            course.setTotalEnrollments(course.getTotalEnrollments() + 1);
            courseRepository.save(course);
        }
    }

    private void consumeCoupon(Coupon coupon) {
        if (coupon == null) {
            return;
        }
        coupon.setUsedCount(coupon.getUsedCount() + 1);
        couponRepository.save(coupon);
    }

    private OrderResponse toResponse(Order order) {
        Coupon coupon = order.getCoupon();
        List<OrderItemResponse> items = order.getItems().stream()
                .map(this::toItemResponse)
                .toList();
        return OrderResponse.builder()
                .id(order.getId())
                .status(order.getStatus())
                .subtotalAmount(order.getSubtotalAmount())
                .discountAmount(order.getDiscountAmount())
                .totalAmount(order.getTotalAmount())
                .currency(order.getCurrency())
                .paymentGateway(order.getPaymentGateway())
                .gatewayTransactionId(order.getGatewayTransactionId())
                .paidAt(order.getPaidAt())
                .failureReason(order.getFailureReason())
                .couponId(coupon == null ? null : coupon.getId())
                .couponCode(coupon == null ? null : coupon.getCode())
                .items(items)
                .createdAt(order.getCreatedAt())
                .updatedAt(order.getUpdatedAt())
                .build();
    }

    private OrderItemResponse toItemResponse(OrderItem item) {
        return OrderItemResponse.builder()
                .id(item.getId())
                .courseId(item.getCourse().getId())
                .courseTitleSnapshot(item.getCourseTitleSnapshot())
                .price(item.getPrice())
                .discountAmount(item.getDiscountAmount())
                .finalPrice(item.getFinalPrice())
                .createdAt(item.getCreatedAt())
                .build();
    }

    private BigDecimal scale(BigDecimal value) {
        return value.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }
}
