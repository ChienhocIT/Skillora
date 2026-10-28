package com.example.skillora_platform.config;

import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.stereotype.Component;

import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class EnvironmentValidator implements ApplicationRunner {

    private static final List<String> WEAK_JWT_SECRETS = List.of(
            "skillora-local-development-secret-32-bytes",
            "change-me-at-least-32-bytes-long"
    );

    private final Environment environment;

    @Override
    public void run(ApplicationArguments args) {
        if (!isProductionLike()) {
            return;
        }

        List<String> errors = new ArrayList<>();
        String jwtSecret = environment.getProperty("skillora.security.jwt.secret", "");
        if (jwtSecret.length() < 32) {
            errors.add("JWT_SECRET must be at least 32 characters");
        }
        if (WEAK_JWT_SECRETS.contains(jwtSecret)) {
            errors.add("JWT_SECRET must not use the local/example default value");
        }

        requireNonBlank(errors, "DB_HOST", environment.getProperty("DB_HOST"));
        requireNonBlank(errors, "DB_PASSWORD", environment.getProperty("DB_PASSWORD"));

        String frontendUrl = environment.getProperty("FRONTEND_URL");
        requireNonBlank(errors, "FRONTEND_URL", frontendUrl);
        if (frontendUrl != null && isLocalUrl(frontendUrl)) {
            errors.add("FRONTEND_URL must not point to localhost in prod/staging");
        }

        requireNonBlank(errors, "MAIL_HOST", environment.getProperty("spring.mail.host"));

        if (environment.getProperty("skillora.payment.enabled", Boolean.class, true)) {
            requireNonBlank(errors, "VNPAY_TMN_CODE", environment.getProperty("skillora.payment.vnpay.tmn-code"));
            requireNonBlank(errors, "VNPAY_HASH_SECRET", environment.getProperty("skillora.payment.vnpay.hash-secret"));
            requireNonBlank(errors, "MOMO_PARTNER_CODE", environment.getProperty("skillora.payment.momo.partner-code"));
            requireNonBlank(errors, "MOMO_ACCESS_KEY", environment.getProperty("skillora.payment.momo.access-key"));
            requireNonBlank(errors, "MOMO_SECRET_KEY", environment.getProperty("skillora.payment.momo.secret-key"));
            if (environment.getProperty("skillora.payment.ipn.whitelist-enabled", Boolean.class, false)) {
                requireNonBlank(errors, "VNPAY_IPN_ALLOWED_IPS", environment.getProperty("skillora.payment.ipn.vnpay-allowed-ips"));
                requireNonBlank(errors, "MOMO_IPN_ALLOWED_IPS", environment.getProperty("skillora.payment.ipn.momo-allowed-ips"));
            }
        }

        if (!errors.isEmpty()) {
            throw new IllegalStateException("Invalid production-like environment:\n- "
                    + String.join("\n- ", errors));
        }
    }

    private boolean isProductionLike() {
        return environment.acceptsProfiles(Profiles.of("prod", "staging"));
    }

    private void requireNonBlank(List<String> errors, String name, String value) {
        if (value == null || value.isBlank()) {
            errors.add(name + " is required");
        }
    }

    private boolean isLocalUrl(String value) {
        String lower = value.toLowerCase();
        return lower.contains("localhost")
                || lower.contains("127.0.0.1")
                || lower.contains("0.0.0.0")
                || lower.contains("[::1]");
    }
}
