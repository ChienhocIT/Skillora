package com.example.skillora_platform.user.service;

import java.io.IOException;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.web.authentication.AuthenticationSuccessHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;

import com.example.skillora_platform.config.AppOAuth2Properties;
import com.example.skillora_platform.user.entity.User;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class OAuth2AuthenticationSuccessHandler implements AuthenticationSuccessHandler {

    private final SocialAuthService socialAuthService;
    private final AppOAuth2Properties appOAuth2Properties;
    private final OAuthLoginCodeService loginCodeService;
    private final SecureTokenService secureTokenService;

    @Override
    public void onAuthenticationSuccess(
            HttpServletRequest request,
            HttpServletResponse response,
            Authentication authentication
    ) throws IOException, ServletException {
        OAuth2User principal = (OAuth2User) authentication.getPrincipal();
        User user = socialAuthService.authenticateGoogle(principal);
        String verifier = secureTokenService.generateToken();
        String code = loginCodeService.issue(user, verifier);
        Cookie cookie = new Cookie("skillora_oauth_verifier", verifier);
        cookie.setHttpOnly(true);
        cookie.setSecure(request.isSecure());
        cookie.setPath("/");
        cookie.setMaxAge(120);
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
        String redirectUrl = UriComponentsBuilder.fromUriString(appOAuth2Properties.authorizedRedirectUri())
                .queryParam("code", code)
                .build()
                .encode()
                .toUriString();
        response.sendRedirect(redirectUrl);
    }
}
