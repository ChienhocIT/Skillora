package com.example.skillora_platform.user;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.MediaType;
import org.springframework.web.util.UriComponentsBuilder;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.skillora_platform.user.repository.OAuthLoginCodeRepository;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken;
import org.springframework.security.oauth2.core.user.DefaultOAuth2User;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.test.context.ActiveProfiles;

import com.example.skillora_platform.admin.repository.AuditLogRepository;
import com.example.skillora_platform.notification.repository.NotificationRepository;
import com.example.skillora_platform.user.repository.InstructorProfileRepository;
import com.example.skillora_platform.user.repository.PasswordResetTokenRepository;
import com.example.skillora_platform.user.repository.RefreshTokenRepository;
import com.example.skillora_platform.user.repository.UserProfileRepository;
import com.example.skillora_platform.user.repository.UserRepository;
import com.example.skillora_platform.user.service.OAuth2AuthenticationSuccessHandler;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "skillora.oauth2.authorized-redirect-uri=http://localhost:3000/oauth2/redirect")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OAuth2AuthenticationSuccessHandlerTest {

    @Autowired
    private OAuth2AuthenticationSuccessHandler successHandler;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private UserProfileRepository userProfileRepository;

    @Autowired
    private InstructorProfileRepository instructorProfileRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private PasswordResetTokenRepository passwordResetTokenRepository;

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private AuditLogRepository auditLogRepository;

    @Autowired private OAuthLoginCodeRepository loginCodeRepository;
    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @BeforeEach
    @AfterEach
    void cleanDatabase() {
        loginCodeRepository.deleteAll();
        auditLogRepository.deleteAll();
        notificationRepository.deleteAll();
        passwordResetTokenRepository.deleteAll();
        refreshTokenRepository.deleteAll();
        instructorProfileRepository.deleteAll();
        userProfileRepository.deleteAll();
        userRepository.deleteAll();
    }

    @Test
    void shouldCreateGoogleUserAndExchangeBrowserBoundCodeOnce() throws Exception {
        OAuth2User principal = new DefaultOAuth2User(
                List.of(new SimpleGrantedAuthority("ROLE_STUDENT")),
                Map.of(
                        "email", "google@example.com",
                        "email_verified", true,
                        "name", "Google User",
                        "picture", "https://example.com/avatar.png"
                ),
                "email"
        );
        OAuth2AuthenticationToken authentication = new OAuth2AuthenticationToken(
                principal,
                principal.getAuthorities(),
                "google"
        );
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();

        successHandler.onAuthenticationSuccess(request, response, authentication);

        assertThat(response.getRedirectedUrl())
                .startsWith("http://localhost:3000/oauth2/redirect?code=")
                .doesNotContain("accessToken=", "refreshToken=");
        String code = UriComponentsBuilder.fromUriString(response.getRedirectedUrl())
                .build().getQueryParams().getFirst("code");
        String verifier = response.getCookie("skillora_oauth_verifier").getValue();
        assertThat(response.getCookie("skillora_oauth_verifier").isHttpOnly()).isTrue();
        assertThat(refreshTokenRepository.count()).isZero();
        String body = objectMapper.writeValueAsString(Map.of("code", code, "verifier", verifier));
        mockMvc.perform(post("/api/v1/auth/oauth2/exchange").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", code, "verifier", "wrong-browser"))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/oauth2/exchange").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.accessToken").isNotEmpty());
        mockMvc.perform(post("/api/v1/auth/oauth2/exchange").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isUnauthorized());
        assertThat(refreshTokenRepository.count()).isEqualTo(1);
        assertThat(userRepository.findByEmailIgnoreCase("google@example.com"))
                .hasValueSatisfying(user -> {
                    assertThat(user.getFullName()).isEqualTo("Google User");
                    assertThat(user.isEmailVerified()).isTrue();
                });
    }
    @Test
    void shouldRejectExpiredAndUnknownCodes() throws Exception {
        UserFixture fixture = issueCode();
        var code = loginCodeRepository.findAll().get(0);
        code.setExpiresAt(LocalDateTime.now().minusSeconds(1));
        loginCodeRepository.save(code);
        mockMvc.perform(post("/api/v1/auth/oauth2/exchange").contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("code", fixture.code(), "verifier", fixture.verifier()))))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/oauth2/exchange").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"unknown\",\"verifier\":\"unknown\"}"))
                .andExpect(status().isUnauthorized());
        assertThat(refreshTokenRepository.count()).isZero();
    }

    private UserFixture issueCode() throws Exception {
        OAuth2User principal = new DefaultOAuth2User(List.of(new SimpleGrantedAuthority("ROLE_STUDENT")),
                Map.of("email", "expired@example.com", "email_verified", true, "name", "Expired"), "email");
        var response = new MockHttpServletResponse();
        successHandler.onAuthenticationSuccess(new MockHttpServletRequest(), response,
                new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "google"));
        String code = UriComponentsBuilder.fromUriString(response.getRedirectedUrl())
                .build().getQueryParams().getFirst("code");
        return new UserFixture(code, response.getCookie("skillora_oauth_verifier").getValue());
    }

    @Test
    void shouldRejectUnverifiedGoogleIdentityBeforeCreatingSession() {
        OAuth2User principal = new DefaultOAuth2User(List.of(new SimpleGrantedAuthority("ROLE_STUDENT")),
                Map.of("email", "unverified@example.com", "email_verified", false), "email");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> successHandler.onAuthenticationSuccess(
                new MockHttpServletRequest(), new MockHttpServletResponse(),
                new OAuth2AuthenticationToken(principal, principal.getAuthorities(), "google")))
                .isInstanceOf(com.example.skillora_platform.exception.BusinessException.class);
        assertThat(loginCodeRepository.count()).isZero();
        assertThat(refreshTokenRepository.count()).isZero();
    }

    private record UserFixture(String code, String verifier) { }

}
