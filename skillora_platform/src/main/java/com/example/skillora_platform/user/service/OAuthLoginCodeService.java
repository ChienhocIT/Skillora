package com.example.skillora_platform.user.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.LocalDateTime;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.user.dto.AuthResponse;
import com.example.skillora_platform.user.entity.OAuthLoginCode;
import com.example.skillora_platform.user.entity.User;
import com.example.skillora_platform.user.repository.OAuthLoginCodeRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class OAuthLoginCodeService {

    private final OAuthLoginCodeRepository repository;
    private final SecureTokenService secureTokenService;
    private final AuthService authService;

    @Transactional
    public String issue(User user, String verifier) {
        LocalDateTime now = LocalDateTime.now();
        repository.deleteByExpiresAtBefore(now);
        String rawCode = secureTokenService.generateToken();
        OAuthLoginCode code = new OAuthLoginCode();
        code.setUser(user);
        code.setCodeHash(secureTokenService.hashToken(rawCode));
        code.setVerifierHash(secureTokenService.hashToken(verifier));
        code.setExpiresAt(now.plusMinutes(2));
        repository.save(code);
        return rawCode;
    }

    @Transactional
    public AuthResponse exchange(String rawCode, String verifier, HttpServletRequest request) {
        OAuthLoginCode code = repository.findByCodeHash(secureTokenService.hashToken(rawCode))
                .orElseThrow(this::invalidCode);
        boolean verifierMatches = MessageDigest.isEqual(
                code.getVerifierHash().getBytes(StandardCharsets.UTF_8),
                secureTokenService.hashToken(verifier).getBytes(StandardCharsets.UTF_8));
        if (!verifierMatches || code.getUsedAt() != null || !code.getExpiresAt().isAfter(LocalDateTime.now())) {
            throw invalidCode();
        }
        authService.requireActiveAccount(code.getUser());
        code.setUsedAt(LocalDateTime.now());
        return authService.issueTokens(code.getUser(), request);
    }

    private BusinessException invalidCode() {
        return new BusinessException("Invalid or expired login code", HttpStatus.UNAUTHORIZED);
    }
}
