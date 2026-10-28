package com.example.skillora_platform.user.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;

import com.example.skillora_platform.user.entity.OAuthLoginCode;

public interface OAuthLoginCodeRepository extends JpaRepository<OAuthLoginCode, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<OAuthLoginCode> findByCodeHash(String codeHash);

    void deleteByExpiresAtBefore(LocalDateTime time);
}
