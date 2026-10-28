package com.example.skillora_platform.config;

import java.io.IOException;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.skillora_platform.common.ApiResponse;
import com.example.skillora_platform.common.Constants;

import lombok.RequiredArgsConstructor;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
@RequiredArgsConstructor
public class RateLimitFilter extends OncePerRequestFilter {

    private final RateLimitProperties properties;
    private final ObjectMapper objectMapper;
    private final Clock clock = Clock.systemUTC();
    private final Map<String, WindowCounter> counters = new ConcurrentHashMap<>();

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain
    ) throws ServletException, IOException {
        RateLimitRule rule = ruleFor(request);
        if (rule == null || allow(rule, request)) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(),
                ApiResponse.error("Too many requests. Please slow down and try again."));
    }

    private boolean allow(RateLimitRule rule, HttpServletRequest request) {
        long now = clock.millis();
        long windowMillis = properties.resolvedWindow().toMillis();
        String key = rule.name() + ":" + clientKey(request);
        WindowCounter counter = counters.computeIfAbsent(key, ignored -> new WindowCounter(now));
        synchronized (counter) {
            if (now - counter.windowStartedAt >= windowMillis) {
                counter.windowStartedAt = now;
                counter.count = 0;
            }
            counter.count++;
            return counter.count <= rule.limit();
        }
    }

    private RateLimitRule ruleFor(HttpServletRequest request) {
        if (!properties.enabled()) {
            return null;
        }
        String path = request.getRequestURI();
        String method = request.getMethod();
        if (HttpMethod.POST.matches(method) && isPasswordResetWrite(path)) {
            return new RateLimitRule("password-reset", properties.safeResetPasswordLimit());
        }
        if (HttpMethod.POST.matches(method) && isAuthWrite(path)) {
            return new RateLimitRule("auth", properties.safeAuthLimit());
        }
        if (HttpMethod.POST.matches(method) && path.equals(Constants.CHAT_API_PREFIX + "/ask")) {
            return new RateLimitRule("chat", properties.safeChatLimit());
        }
        if (HttpMethod.POST.matches(method) && path.startsWith(Constants.PAYMENT_API_PREFIX)) {
            return new RateLimitRule("payment", properties.safePaymentLimit());
        }
        return null;
    }

    private boolean isAuthWrite(String path) {
        return path.equals(Constants.AUTH_API_PREFIX + "/register")
                || path.equals(Constants.AUTH_API_PREFIX + "/oauth2/exchange")
                || path.equals(Constants.AUTH_API_PREFIX + "/login")
                || path.equals(Constants.AUTH_API_PREFIX + "/refresh")
                || path.equals(Constants.AUTH_API_PREFIX + "/forgot-password")
                || path.equals(Constants.AUTH_API_PREFIX + "/reset-password");
    }

    private boolean isPasswordResetWrite(String path) {
        return path.equals(Constants.AUTH_API_PREFIX + "/forgot-password")
                || path.equals(Constants.AUTH_API_PREFIX + "/reset-password");
    }

    private String clientKey(HttpServletRequest request) {
        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private record RateLimitRule(String name, int limit) {
    }

    private static final class WindowCounter {
        private long windowStartedAt;
        private int count;

        private WindowCounter(long windowStartedAt) {
            this.windowStartedAt = windowStartedAt;
        }
    }
}
