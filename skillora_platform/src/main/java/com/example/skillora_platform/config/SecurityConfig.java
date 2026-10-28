package com.example.skillora_platform.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.authentication.JwtGrantedAuthoritiesConverter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.example.skillora_platform.common.ApiResponse;
import com.example.skillora_platform.common.Constants;
import com.example.skillora_platform.user.service.OAuth2AuthenticationSuccessHandler;

import lombok.RequiredArgsConstructor;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private static final String[] PUBLIC_ENDPOINTS = {
            "/actuator/health",
            "/actuator/health/**",
            "/oauth2/**",
            "/login/oauth2/**",
            "/v3/api-docs/**",
            "/swagger-ui/**",
            "/swagger-ui.html"
    };

    private final CorsProperties corsProperties;
    private final JwtProperties jwtProperties;
    private final ObjectMapper objectMapper;
    private final ObjectProvider<ClientRegistrationRepository> clientRegistrationRepositoryProvider;
    private final ObjectProvider<OAuth2AuthenticationSuccessHandler> oAuth2SuccessHandlerProvider;

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers(PUBLIC_ENDPOINTS).permitAll()
                        .requestMatchers(HttpMethod.POST, Constants.AUTH_API_PREFIX + "/register").permitAll()
                        .requestMatchers(HttpMethod.POST, Constants.AUTH_API_PREFIX + "/login").permitAll()
                        .requestMatchers(HttpMethod.POST, Constants.AUTH_API_PREFIX + "/refresh").permitAll()
                        .requestMatchers(HttpMethod.POST, Constants.AUTH_API_PREFIX + "/oauth2/exchange").permitAll()
                        .requestMatchers(HttpMethod.POST, Constants.AUTH_API_PREFIX + "/logout").permitAll()
                        .requestMatchers(HttpMethod.POST, Constants.AUTH_API_PREFIX + "/forgot-password").permitAll()
                        .requestMatchers(HttpMethod.POST, Constants.AUTH_API_PREFIX + "/reset-password").permitAll()
                        .requestMatchers(HttpMethod.GET, Constants.INSTRUCTOR_API_PREFIX + "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, Constants.CATEGORY_API_PREFIX).permitAll()
                        .requestMatchers(HttpMethod.GET, Constants.COURSE_API_PREFIX).permitAll()
                        .requestMatchers(HttpMethod.GET, Constants.COURSE_API_PREFIX + "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, Constants.LESSON_API_PREFIX + "/**").permitAll()
                        .requestMatchers(HttpMethod.GET, Constants.REVIEW_API_PREFIX).permitAll()
                        .requestMatchers(HttpMethod.GET, Constants.PAYMENT_API_PREFIX + "/vnpay/return").permitAll()
                        .requestMatchers(HttpMethod.GET, Constants.PAYMENT_API_PREFIX + "/vnpay/ipn").permitAll()
                        .requestMatchers(HttpMethod.GET, Constants.PAYMENT_API_PREFIX + "/momo/return").permitAll()
                        .requestMatchers(HttpMethod.POST, Constants.PAYMENT_API_PREFIX + "/vnpay/ipn").permitAll()
                        .requestMatchers(HttpMethod.POST, Constants.PAYMENT_API_PREFIX + "/momo/ipn").permitAll()
                        .requestMatchers(HttpMethod.POST, Constants.API_V1_PREFIX + "/videos/bunny/webhook").permitAll()
                        .anyRequest().authenticated()
                )
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint((request, response, ex) ->
                                writeSecurityError(response, HttpStatus.UNAUTHORIZED, "Authentication required"))
                        .accessDeniedHandler((request, response, ex) ->
                                writeSecurityError(response, HttpStatus.FORBIDDEN, "Access denied"))
                )
                .oauth2ResourceServer(oauth2 -> oauth2.jwt(jwt -> jwt
                        .jwtAuthenticationConverter(jwtAuthenticationConverter())
                ));

        if (clientRegistrationRepositoryProvider.getIfAvailable() != null) {
            http.oauth2Login(oauth2 -> oauth2
                    .successHandler(oAuth2SuccessHandlerProvider.getObject()));
        }

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(corsProperties.allowedOrigins());
        configuration.setAllowedMethods(corsProperties.allowedMethods());
        configuration.setAllowedHeaders(corsProperties.allowedHeaders());
        configuration.setExposedHeaders(corsProperties.exposedHeaders());
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(corsProperties.maxAge());

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public JwtDecoder jwtDecoder() {
        return NimbusJwtDecoder.withSecretKey(jwtSecretKey())
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
    }

    @Bean
    public JwtEncoder jwtEncoder() {
        return new NimbusJwtEncoder(new ImmutableSecret<>(jwtSecretKey()));
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(10);
    }

    private JwtAuthenticationConverter jwtAuthenticationConverter() {
        JwtGrantedAuthoritiesConverter authoritiesConverter = new JwtGrantedAuthoritiesConverter();
        authoritiesConverter.setAuthoritiesClaimName("roles");
        authoritiesConverter.setAuthorityPrefix("ROLE_");

        JwtAuthenticationConverter authenticationConverter = new JwtAuthenticationConverter();
        authenticationConverter.setJwtGrantedAuthoritiesConverter(authoritiesConverter);
        return authenticationConverter;
    }

    private SecretKey jwtSecretKey() {
        byte[] secretBytes = jwtProperties.secret().getBytes(StandardCharsets.UTF_8);
        return new SecretKeySpec(secretBytes, "HmacSHA256");
    }

    private void writeSecurityError(
            HttpServletResponse response,
            HttpStatus status,
            String message
    ) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), ApiResponse.error(message));
    }
}
