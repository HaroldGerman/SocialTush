package com.socialtush.modules.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponse {
    private String accessToken;
    private String refreshToken; // Para la app móvil
    private UUID userId;
    private String username;
    private String email;
    private String displayName;
    private String avatarUrl;
    private String role;
}
