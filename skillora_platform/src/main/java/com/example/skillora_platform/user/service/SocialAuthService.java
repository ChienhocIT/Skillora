package com.example.skillora_platform.user.service;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.skillora_platform.exception.BusinessException;
import com.example.skillora_platform.exception.ResourceNotFoundException;
import com.example.skillora_platform.user.entity.Role;
import com.example.skillora_platform.user.entity.RoleName;
import com.example.skillora_platform.user.entity.User;
import com.example.skillora_platform.user.entity.UserProfile;
import com.example.skillora_platform.user.entity.UserStatus;
import com.example.skillora_platform.user.repository.RoleRepository;
import com.example.skillora_platform.user.repository.UserProfileRepository;
import com.example.skillora_platform.user.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SocialAuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserProfileRepository userProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthService authService;

    @Transactional
    public User authenticateGoogle(OAuth2User oAuth2User) {
        String email = normalizeEmail(oAuth2User.getAttribute("email"));
        if (email == null) {
            throw new BusinessException("Google account email is required", HttpStatus.BAD_REQUEST);
        }
        if (!Boolean.TRUE.equals(oAuth2User.getAttribute("email_verified"))) {
            throw new BusinessException("Google account email must be verified", HttpStatus.UNAUTHORIZED);
        }

        User user = userRepository.findByEmailIgnoreCase(email)
                .map(existingUser -> updateExistingGoogleUser(existingUser, oAuth2User))
                .orElseGet(() -> createGoogleUser(email, oAuth2User));
        authService.requireActiveAccount(user);
        user.setLastLoginAt(LocalDateTime.now());
        return userRepository.save(user);
    }

    private User updateExistingGoogleUser(User user, OAuth2User oAuth2User) {
        Boolean emailVerified = oAuth2User.getAttribute("email_verified");
        if (Boolean.TRUE.equals(emailVerified)) {
            user.setEmailVerified(true);
        }
        String picture = trimToNull(oAuth2User.getAttribute("picture"));
        if (user.getAvatarUrl() == null && picture != null) {
            user.setAvatarUrl(picture);
        }
        return user;
    }

    private User createGoogleUser(String email, OAuth2User oAuth2User) {
        Role studentRole = roleRepository.findByName(RoleName.STUDENT)
                .orElseThrow(() -> new ResourceNotFoundException("Role not found: STUDENT"));
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(UUID.randomUUID().toString()))
                .fullName(resolveFullName(oAuth2User))
                .avatarUrl(trimToNull(oAuth2User.getAttribute("picture")))
                .status(UserStatus.ACTIVE)
                .emailVerified(Boolean.TRUE.equals(oAuth2User.getAttribute("email_verified")))
                .roles(new HashSet<>(Set.of(studentRole)))
                .build();
        User savedUser = userRepository.save(user);
        userProfileRepository.save(UserProfile.builder()
                .user(savedUser)
                .build());
        return savedUser;
    }

    private String resolveFullName(OAuth2User oAuth2User) {
        String fullName = trimToNull(oAuth2User.getAttribute("name"));
        if (fullName != null) {
            return fullName;
        }
        return "Google User";
    }

    private String normalizeEmail(String email) {
        return email == null || email.isBlank() ? null : email.trim().toLowerCase();
    }

    private String trimToNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
