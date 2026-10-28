package com.example.skillora_platform.user.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.skillora_platform.common.ApiResponse;
import com.example.skillora_platform.common.Constants;
import com.example.skillora_platform.user.dto.AuthResponse;
import com.example.skillora_platform.user.dto.ForgotPasswordRequest;
import com.example.skillora_platform.user.dto.LoginRequest;
import com.example.skillora_platform.user.dto.OAuthExchangeRequest;
import com.example.skillora_platform.user.dto.LogoutRequest;
import com.example.skillora_platform.user.dto.PasswordResetTokenResponse;
import com.example.skillora_platform.user.dto.RegisterRequest;
import com.example.skillora_platform.user.dto.ResetPasswordRequest;
import com.example.skillora_platform.user.dto.TokenRefreshRequest;
import com.example.skillora_platform.user.dto.UserResponse;
import com.example.skillora_platform.user.service.AuthService;
import com.example.skillora_platform.user.service.OAuthLoginCodeService;
import com.example.skillora_platform.user.service.PasswordResetService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping(Constants.AUTH_API_PREFIX)
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final PasswordResetService passwordResetService;
    private final OAuthLoginCodeService loginCodeService;

    @PostMapping("/oauth2/exchange")
    public ApiResponse<AuthResponse> exchangeOAuthCode(
            @Valid @RequestBody OAuthExchangeRequest request,
            HttpServletRequest httpRequest
    ) {
        return ApiResponse.success("Login successful",
                loginCodeService.exchange(request.getCode(), request.getVerifier(), httpRequest));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(
            @Valid @RequestBody RegisterRequest request,
            HttpServletRequest httpRequest
    ) {
        AuthResponse response = authService.register(request, httpRequest);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("User registered successfully", response));
    }

    @PostMapping("/login")
    public ApiResponse<AuthResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        return ApiResponse.success("Login successful", authService.login(request, httpRequest));
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(
            @Valid @RequestBody TokenRefreshRequest request,
            HttpServletRequest httpRequest
    ) {
        return ApiResponse.success("Token refreshed successfully",
                authService.refresh(request.getRefreshToken(), httpRequest));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(
            @Valid @RequestBody LogoutRequest request,
            HttpServletRequest httpRequest
    ) {
        authService.logout(request.getRefreshToken(), httpRequest);
        return ApiResponse.success("Logout successful");
    }

    @PostMapping("/forgot-password")
    public ApiResponse<PasswordResetTokenResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request) {
        PasswordResetTokenResponse response = passwordResetService.requestReset(request.getEmail());
        return ApiResponse.success("If the email exists, a password reset link has been issued", response);
    }

    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        passwordResetService.resetPassword(request.getToken(), request.getPassword());
        return ApiResponse.success("Password reset successfully");
    }

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<UserResponse> me(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponse.success(authService.getCurrentUser(jwt.getSubject()));
    }
}
