package com.example.skillora_platform.commerce.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.servlet.view.RedirectView;
import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.skillora_platform.commerce.dto.MomoIpnRequest;
import com.example.skillora_platform.commerce.dto.PaymentCreateResponse;
import com.example.skillora_platform.commerce.dto.VnPayIpnResponse;
import com.example.skillora_platform.commerce.entity.Order;
import com.example.skillora_platform.commerce.entity.OrderStatus;
import com.example.skillora_platform.commerce.entity.PaymentGateway;
import com.example.skillora_platform.commerce.entity.PaymentTransaction;
import com.example.skillora_platform.commerce.entity.TxStatus;
import com.example.skillora_platform.commerce.repository.OrderRepository;
import com.example.skillora_platform.commerce.repository.PaymentTransactionRepository;
import com.example.skillora_platform.config.MomoProperties;
import com.example.skillora_platform.config.PaymentProperties;
import com.example.skillora_platform.config.VnPayProperties;
import com.example.skillora_platform.course.service.CoursePermissionService;
import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.exception.ResourceNotFoundException;
import com.example.skillora_platform.user.entity.User;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class PaymentService {

    private static final DateTimeFormatter VNPAY_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");
    private static final String VNPAY_VERSION = "2.1.0";
    private static final String VNPAY_COMMAND = "pay";
    private static final String DEFAULT_IP = "127.0.0.1";
    private static final String VND = "VND";

    private final OrderRepository orderRepository;
    private final PaymentTransactionRepository paymentTransactionRepository;
    private final CoursePermissionService permissionService;
    private final OrderService orderService;
    private final PaymentProperties paymentProperties;
    private final VnPayProperties vnPayProperties;
    private final MomoProperties momoProperties;
    private final MomoClient momoClient;
    private final ObjectMapper objectMapper;

    @Transactional
    public PaymentCreateResponse createVnPayPayment(Long orderId, String actorEmail, String clientIp) {
        ensurePaymentEnabled();
        if (!vnPayProperties.configured()) {
            throw new BusinessException("VNPay is not configured", HttpStatus.SERVICE_UNAVAILABLE);
        }
        Order order = requirePayableOrder(orderId, actorEmail);
        PaymentTransaction tx = createPendingTransaction(order, PaymentGateway.VNPAY);
        String gatewayOrderId = tx.getId().toString();
        tx.setGatewayOrderId(gatewayOrderId);

        Map<String, String> params = new TreeMap<>();
        params.put("vnp_Version", VNPAY_VERSION);
        params.put("vnp_Command", VNPAY_COMMAND);
        params.put("vnp_TmnCode", vnPayProperties.tmnCode());
        params.put("vnp_Amount", String.valueOf(toVnPayAmount(order.getTotalAmount())));
        params.put("vnp_CurrCode", VND);
        params.put("vnp_TxnRef", gatewayOrderId);
        params.put("vnp_OrderInfo", "Skillora order #" + order.getId());
        params.put("vnp_OrderType", vnPayProperties.resolvedOrderType());
        params.put("vnp_Locale", vnPayProperties.resolvedLocale());
        params.put("vnp_ReturnUrl", callbackUrl("/api/v1/payments/vnpay/return"));
        params.put("vnp_IpAddr", normalizedIp(clientIp));
        params.put("vnp_CreateDate", VNPAY_DATE_FORMAT.format(LocalDateTime.now()));

        String signData = toQueryString(params);
        String secureHash = PaymentSignatureUtils.hmacSha512(vnPayProperties.hashSecret(), signData);
        String payUrl = vnPayProperties.resolvedPaymentUrl() + "?" + signData + "&vnp_SecureHash=" + secureHash;
        tx.setPayUrl(payUrl);
        tx.setRawRequest(toJson(params));
        paymentTransactionRepository.save(tx);

        return toPaymentCreateResponse(order, tx, payUrl);
    }

    @Transactional
    public PaymentCreateResponse createMomoPayment(Long orderId, String actorEmail) {
        ensurePaymentEnabled();
        if (!momoProperties.configured()) {
            throw new BusinessException("MoMo is not configured", HttpStatus.SERVICE_UNAVAILABLE);
        }
        Order order = requirePayableOrder(orderId, actorEmail);
        PaymentTransaction tx = createPendingTransaction(order, PaymentGateway.MOMO);
        String gatewayOrderId = tx.getId().toString();
        String requestId = "MOMO-" + tx.getId() + "-" + System.currentTimeMillis();
        tx.setGatewayOrderId(gatewayOrderId);
        tx.setRequestId(requestId);

        String redirectUrl = callbackUrl("/api/v1/payments/momo/return");
        String ipnUrl = callbackUrl("/api/v1/payments/momo/ipn");
        String orderInfo = "Skillora order #" + order.getId();
        long amount = toMomoAmount(order.getTotalAmount());
        String extraData = "";
        String rawSignature = momoCreateSignature(amount, extraData, ipnUrl, gatewayOrderId,
                orderInfo, redirectUrl, requestId);
        String signature = PaymentSignatureUtils.hmacSha256(momoProperties.secretKey(), rawSignature);

        MomoCreatePaymentPayload payload = new MomoCreatePaymentPayload(
                momoProperties.partnerCode(),
                momoProperties.resolvedPartnerName(),
                momoProperties.resolvedStoreId(),
                requestId,
                amount,
                gatewayOrderId,
                orderInfo,
                redirectUrl,
                ipnUrl,
                momoProperties.resolvedRequestType(),
                extraData,
                "vi",
                signature
        );
        tx.setRawRequest(toJson(payload));
        MomoCreatePaymentResult result = momoClient.createPayment(payload);
        tx.setRawResponse(toJson(result));
        if (result == null || result.resultCode() == null || result.resultCode() != 0 || isBlank(result.payUrl())) {
            tx.setStatus(TxStatus.FAILED);
            tx.setResultCode(result == null || result.resultCode() == null ? null : result.resultCode().toString());
            tx.setMessage(result == null ? "MoMo did not return a response" : result.message());
            paymentTransactionRepository.save(tx);
            throw new BusinessException("MoMo payment gateway did not create a pay URL", HttpStatus.BAD_GATEWAY);
        }

        tx.setStatus(TxStatus.PENDING);
        tx.setResultCode(result.resultCode().toString());
        tx.setMessage(result.message());
        tx.setPayUrl(result.payUrl());
        tx.setResponseTime(result.responseTime());
        paymentTransactionRepository.save(tx);
        return toPaymentCreateResponse(order, tx, result.payUrl());
    }

    @Transactional
    public VnPayIpnResponse handleVnPayIpn(Map<String, String> params) {
        PaymentCallbackResult result = processVnPayCallback(params);
        return new VnPayIpnResponse(result.rspCode(), result.message());
    }

    @Transactional
    public RedirectView handleVnPayReturn(Map<String, String> params) {
        PaymentCallbackResult result = processVnPayCallback(params);
        String redirectUrl = UriComponentsBuilder.fromUriString(paymentProperties.resolvedResultUrl())
                .queryParam("gateway", "VNPAY")
                .queryParam("orderId", result.orderId())
                .queryParam("status", result.status())
                .queryParam("code", result.rspCode())
                .build()
                .toUriString();
        return new RedirectView(redirectUrl);
    }

    @Transactional
    public void handleMomoIpn(MomoIpnRequest request) {
        if (!momoProperties.configured()) {
            throw new BusinessException("MoMo is not configured", HttpStatus.SERVICE_UNAVAILABLE);
        }
        if (!momoProperties.partnerCode().equals(request.getPartnerCode())) {
            log.warn("Rejected MoMo IPN with invalid partner code. expected={}, actual={}, orderId={}, requestId={}",
                    momoProperties.partnerCode(), request.getPartnerCode(), request.getOrderId(),
                    request.getRequestId());
            throw new BusinessException("Invalid MoMo partner code", HttpStatus.BAD_REQUEST);
        }
        if (!verifyMomoSignature(request)) {
            log.warn("Rejected MoMo IPN with invalid signature. partnerCode={}, orderId={}, requestId={}, resultCode={}",
                    request.getPartnerCode(), request.getOrderId(), request.getRequestId(),
                    request.getResultCode());
            throw new BusinessException("Invalid MoMo signature", HttpStatus.BAD_REQUEST);
        }

        PaymentTransaction tx = paymentTransactionRepository
                .findByGatewayAndGatewayOrderId(PaymentGateway.MOMO, request.getOrderId())
                .orElseThrow(() -> new ResourceNotFoundException("Payment transaction not found: "
                        + request.getOrderId()));
        Order order = orderService.lockOrder(tx.getOrder().getId());
        if (request.getAmount() == null || request.getAmount() != toMomoAmount(order.getTotalAmount())) {
            markTransactionFailed(tx, "MoMo amount mismatch", request.getResultCode(), request.getMessage(),
                    request.getTransId() == null ? null : request.getTransId().toString(), request.getPayType(),
                    request.getResponseTime(), request);
            throw new BusinessException("MoMo amount mismatch", HttpStatus.BAD_REQUEST);
        }

        if (tx.getStatus() == TxStatus.SUCCESS || order.getStatus() == OrderStatus.PAID) {
            return;
        }

        String gatewayTransactionId = request.getTransId() == null ? null : request.getTransId().toString();
        if (request.getResultCode() != null && request.getResultCode() == 0) {
            markTransactionSuccess(tx, request.getResultCode().toString(), request.getMessage(),
                    gatewayTransactionId, request.getPayType(), request.getResponseTime(), request);
            orderService.markPaidFromGateway(order.getId(), PaymentGateway.MOMO, gatewayTransactionId, tx.getId());
            return;
        }

        String reason = request.getMessage() == null ? "MoMo payment failed" : request.getMessage();
        markTransactionFailed(tx, reason, request.getResultCode(), request.getMessage(), gatewayTransactionId,
                request.getPayType(), request.getResponseTime(), request);
        orderService.markFailedFromGateway(order.getId(), tx.getId(), reason);
    }

    private PaymentCallbackResult processVnPayCallback(Map<String, String> params) {
        if (params == null || params.isEmpty() || isBlank(params.get("vnp_TxnRef"))) {
            return PaymentCallbackResult.invalid("99", "Input data required", null);
        }
        if (!vnPayProperties.configured()) {
            log.warn("Rejected VNPay callback because VNPay is not configured. params={}", redactedParams(params));
            return PaymentCallbackResult.invalid("99", "VNPay is not configured", null);
        }
        String tmnCode = params.get("vnp_TmnCode");
        if (isBlank(tmnCode) || !vnPayProperties.tmnCode().equals(tmnCode)) {
            log.warn("Rejected VNPay callback with invalid terminal code. expected={}, actual={}, params={}",
                    vnPayProperties.tmnCode(), tmnCode, redactedParams(params));
            return PaymentCallbackResult.invalid("97", "Invalid terminal code", null);
        }
        if (!verifyVnPaySignature(params)) {
            log.warn("Rejected VNPay callback with invalid signature. params={}", redactedParams(params));
            return PaymentCallbackResult.invalid("97", "Invalid signature", null);
        }

        PaymentTransaction tx = paymentTransactionRepository
                .findByGatewayAndGatewayOrderId(PaymentGateway.VNPAY, params.get("vnp_TxnRef"))
                .orElse(null);
        if (tx == null) {
            return PaymentCallbackResult.invalid("01", "Order not found", null);
        }
        Order order = orderService.lockOrder(tx.getOrder().getId());
        if (!String.valueOf(toVnPayAmount(order.getTotalAmount())).equals(params.get("vnp_Amount"))) {
            markTransactionFailed(tx, "VNPay amount mismatch", parseInt(params.get("vnp_ResponseCode")),
                    "VNPay amount mismatch", params.get("vnp_TransactionNo"), params.get("vnp_CardType"),
                    null, params);
            return PaymentCallbackResult.invalid("04", "Invalid amount", order.getId());
        }
        if (tx.getStatus() == TxStatus.SUCCESS || order.getStatus() == OrderStatus.PAID) {
            return PaymentCallbackResult.success(order.getId(), "PAID");
        }

        String responseCode = params.get("vnp_ResponseCode");
        String transactionStatus = params.get("vnp_TransactionStatus");
        String gatewayTransactionId = params.get("vnp_TransactionNo");
        if ("00".equals(responseCode) && (transactionStatus == null || "00".equals(transactionStatus))) {
            markTransactionSuccess(tx, responseCode, "VNPay payment successful", gatewayTransactionId,
                    params.get("vnp_CardType"), null, params);
            orderService.markPaidFromGateway(order.getId(), PaymentGateway.VNPAY, gatewayTransactionId, tx.getId());
            return PaymentCallbackResult.success(order.getId(), "PAID");
        }

        String reason = "VNPay payment failed with code " + responseCode;
        markTransactionFailed(tx, reason, parseInt(responseCode), reason, gatewayTransactionId,
                params.get("vnp_CardType"), null, params);
        orderService.markFailedFromGateway(order.getId(), tx.getId(), reason);
        return PaymentCallbackResult.success(order.getId(), "FAILED");
    }

    private PaymentTransaction createPendingTransaction(Order order, PaymentGateway gateway) {
        PaymentTransaction tx = PaymentTransaction.builder()
                .order(order)
                .gateway(gateway)
                .amount(order.getTotalAmount())
                .currency(order.getCurrency())
                .status(TxStatus.PENDING)
                .build();
        return paymentTransactionRepository.saveAndFlush(tx);
    }

    private void ensurePaymentEnabled() {
        if (!paymentProperties.enabled()) {
            throw new BusinessException("Payment is disabled", HttpStatus.SERVICE_UNAVAILABLE);
        }
    }

    private Order requirePayableOrder(Long orderId, String actorEmail) {
        User actor = permissionService.requireActor(actorEmail);
        Order order = orderRepository.findDetailedById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found with id: " + orderId));
        if (!order.getUser().getId().equals(actor.getId())) {
            throw new BusinessException("You do not own this order", HttpStatus.FORBIDDEN);
        }
        if (order.getStatus() != OrderStatus.PENDING) {
            throw new BusinessException("Only PENDING orders can be paid", HttpStatus.CONFLICT);
        }
        if (order.getTotalAmount().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException("Zero-total orders do not need gateway payment", HttpStatus.BAD_REQUEST);
        }
        if (!VND.equalsIgnoreCase(order.getCurrency())) {
            throw new BusinessException("Only VND orders are supported by VNPay/MoMo", HttpStatus.BAD_REQUEST);
        }
        return order;
    }

    private void markTransactionSuccess(
            PaymentTransaction tx,
            String resultCode,
            String message,
            String gatewayTransactionId,
            String payType,
            Long responseTime,
            Object rawResponse
    ) {
        tx.setStatus(TxStatus.SUCCESS);
        tx.setResultCode(resultCode);
        tx.setMessage(message);
        tx.setGatewayTransactionId(gatewayTransactionId);
        tx.setPayType(payType);
        tx.setResponseTime(responseTime);
        tx.setRawResponse(toJson(rawResponse));
        paymentTransactionRepository.save(tx);
    }

    private void markTransactionFailed(
            PaymentTransaction tx,
            String reason,
            Integer resultCode,
            String message,
            String gatewayTransactionId,
            String payType,
            Long responseTime,
            Object rawResponse
    ) {
        tx.setStatus(TxStatus.FAILED);
        tx.setResultCode(resultCode == null ? null : resultCode.toString());
        tx.setMessage(message == null ? reason : message);
        tx.setGatewayTransactionId(gatewayTransactionId);
        tx.setPayType(payType);
        tx.setResponseTime(responseTime);
        tx.setRawResponse(toJson(rawResponse));
        paymentTransactionRepository.save(tx);
    }

    private boolean verifyVnPaySignature(Map<String, String> params) {
        String actual = params.get("vnp_SecureHash");
        Map<String, String> signParams = new TreeMap<>();
        params.forEach((key, value) -> {
            if (!"vnp_SecureHash".equals(key) && !"vnp_SecureHashType".equals(key) && value != null) {
                signParams.put(key, value);
            }
        });
        String expected = PaymentSignatureUtils.hmacSha512(vnPayProperties.hashSecret(), toQueryString(signParams));
        return PaymentSignatureUtils.matches(expected, actual);
    }

    private boolean verifyMomoSignature(MomoIpnRequest request) {
        String expected = PaymentSignatureUtils.hmacSha256(momoProperties.secretKey(), momoIpnSignature(request));
        return PaymentSignatureUtils.matches(expected, request.getSignature());
    }

    private String momoCreateSignature(
            long amount,
            String extraData,
            String ipnUrl,
            String orderId,
            String orderInfo,
            String redirectUrl,
            String requestId
    ) {
        return "accessKey=" + momoProperties.accessKey()
                + "&amount=" + amount
                + "&extraData=" + safe(extraData)
                + "&ipnUrl=" + ipnUrl
                + "&orderId=" + orderId
                + "&orderInfo=" + orderInfo
                + "&partnerCode=" + momoProperties.partnerCode()
                + "&redirectUrl=" + redirectUrl
                + "&requestId=" + requestId
                + "&requestType=" + momoProperties.resolvedRequestType();
    }

    private String momoIpnSignature(MomoIpnRequest request) {
        return "accessKey=" + momoProperties.accessKey()
                + "&amount=" + safe(request.getAmount())
                + "&extraData=" + safe(request.getExtraData())
                + "&message=" + safe(request.getMessage())
                + "&orderId=" + safe(request.getOrderId())
                + "&orderInfo=" + safe(request.getOrderInfo())
                + "&orderType=" + safe(request.getOrderType())
                + "&partnerCode=" + safe(request.getPartnerCode())
                + "&payType=" + safe(request.getPayType())
                + "&requestId=" + safe(request.getRequestId())
                + "&responseTime=" + safe(request.getResponseTime())
                + "&resultCode=" + safe(request.getResultCode())
                + "&transId=" + safe(request.getTransId());
    }

    private String toQueryString(Map<String, String> params) {
        return params.entrySet().stream()
                .filter(entry -> entry.getValue() != null && !entry.getValue().isBlank())
                .map(entry -> encode(entry.getKey()) + "=" + encode(entry.getValue()))
                .reduce((left, right) -> left + "&" + right)
                .orElse("");
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private long toVnPayAmount(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.UNNECESSARY).movePointRight(2).longValueExact();
    }

    private long toMomoAmount(BigDecimal amount) {
        return amount.setScale(0, RoundingMode.UNNECESSARY).longValueExact();
    }

    private String callbackUrl(String path) {
        return paymentProperties.resolvedPublicBaseUrl() + path;
    }

    private String normalizedIp(String clientIp) {
        if (clientIp == null || clientIp.isBlank() || "0:0:0:0:0:0:0:1".equals(clientIp)) {
            return DEFAULT_IP;
        }
        return clientIp;
    }

    private PaymentCreateResponse toPaymentCreateResponse(Order order, PaymentTransaction tx, String payUrl) {
        return PaymentCreateResponse.builder()
                .orderId(order.getId())
                .paymentTransactionId(tx.getId())
                .gateway(tx.getGateway())
                .amount(order.getTotalAmount())
                .currency(order.getCurrency())
                .payUrl(payUrl)
                .build();
    }

    private String toJson(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            log.warn("Unable to serialize payment payload", ex);
            return null;
        }
    }

    private Integer parseInt(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return Integer.valueOf(value);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private String safe(Object value) {
        return value == null ? "" : value.toString();
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private Map<String, String> redactedParams(Map<String, String> params) {
        Map<String, String> redacted = new TreeMap<>();
        params.forEach((key, value) -> redacted.put(key,
                key != null && key.toLowerCase(Locale.ROOT).contains("securehash") ? "[present]" : value));
        return redacted;
    }

    public Map<String, String> signVnPayParamsForTest(Map<String, String> unsignedParams) {
        Map<String, String> signed = new LinkedHashMap<>(unsignedParams);
        signed.put("vnp_SecureHash", PaymentSignatureUtils.hmacSha512(
                vnPayProperties.hashSecret(), toQueryString(new TreeMap<>(unsignedParams))));
        return signed;
    }

    public String signMomoIpnForTest(MomoIpnRequest request) {
        return PaymentSignatureUtils.hmacSha256(momoProperties.secretKey(), momoIpnSignature(request));
    }

    private record PaymentCallbackResult(
            String rspCode,
            String message,
            Long orderId,
            String status
    ) {

        static PaymentCallbackResult success(Long orderId, String status) {
            return new PaymentCallbackResult("00", "success", orderId, status);
        }

        static PaymentCallbackResult invalid(String code, String message, Long orderId) {
            return new PaymentCallbackResult(code, message, orderId, "INVALID");
        }
    }
}
