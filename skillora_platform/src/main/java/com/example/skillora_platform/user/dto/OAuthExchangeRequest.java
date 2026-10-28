package com.example.skillora_platform.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OAuthExchangeRequest {
    @NotBlank
    @Size(max = 128)
    private String code;

    @NotBlank
    @Size(max = 128)
    private String verifier;
}
