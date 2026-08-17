package com.socialtush.modules.auth.controller;

import com.socialtush.modules.auth.dto.AuthRequest;
import com.socialtush.modules.auth.dto.AuthResponse;
import com.socialtush.modules.auth.entity.RefreshToken;
import com.socialtush.modules.auth.repository.RefreshTokenRepository;
import com.socialtush.modules.auth.security.JwtService;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Value("${app.jwt.refresh-expiration-ms}")
    private long refreshExpirationMs;

    @PostMapping("/register")
    public ResponseEntity<?> register(@Valid @RequestBody AuthRequest.Register request, HttpServletResponse response) {
        String normalizedUsername = request.getUsername().toLowerCase().trim();
        String normalizedEmail = request.getEmail().toLowerCase().trim();

        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            return ResponseEntity.badRequest().body(Map.of("message", "El nombre de usuario ya está en uso"));
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            return ResponseEntity.badRequest().body(Map.of("message", "El email ya está registrado"));
        }

        // 1. Create and Save User
        User user = User.builder()
                .username(request.getUsername().trim())
                .email(request.getEmail().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role("USER")
                .isVerified(false)
                .isActive(true)
                .build();
        user = userRepository.save(user);

        // 2. Create and Save Profile
        Profile profile = Profile.builder()
                .user(user)
                .displayName(request.getDisplayName().trim())
                .bio("")
                .isPrivate(false)
                .build();
        profileRepository.save(profile);

        // 3. Generate credentials and login immediately
        return loginUser(user, response);
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@Valid @RequestBody AuthRequest.Login request, HttpServletResponse response) {
        String input = request.getUsernameOrEmail().trim();
        User user = userRepository.findByUsernameIgnoreCase(input)
                .or(() -> userRepository.findByEmailIgnoreCase(input))
                .orElse(null);

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("message", "Credenciales incorrectas"));
        }

        if (!user.isActive()) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("message", "Tu cuenta se encuentra suspendida o inactiva"));
        }

        return loginUser(user, response);
    }

    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(HttpServletRequest request, HttpServletResponse response, @RequestBody(required = false) AuthRequest.Refresh body) {
        String tokenStr = null;

        // Try getting token from Body first (useful for Mobile)
        if (body != null && body.getRefreshToken() != null && !body.getRefreshToken().isBlank()) {
            tokenStr = body.getRefreshToken();
        }

        // Try getting token from Cookies if not found in body
        if (tokenStr == null && request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("refreshToken".equals(cookie.getName())) {
                    tokenStr = cookie.getValue();
                    break;
                }
            }
        }

        if (tokenStr == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Refresh token no proporcionado"));
        }

        RefreshToken refreshToken = refreshTokenRepository.findByToken(tokenStr).orElse(null);
        if (refreshToken == null || refreshToken.isRevoked() || refreshToken.isExpired()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "Refresh token inválido, expirado o revocado"));
        }

        // Rotate Refresh Token: Revoke current
        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);

        User user = refreshToken.getUser();

        // Create new session
        return loginUser(user, response);
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletRequest request, HttpServletResponse response, @RequestBody(required = false) AuthRequest.Refresh body) {
        String tokenStr = null;

        // Try getting token from Body first (useful for Mobile)
        if (body != null && body.getRefreshToken() != null && !body.getRefreshToken().isBlank()) {
            tokenStr = body.getRefreshToken();
        }

        // Try getting token from Cookies if not in body
        if (tokenStr == null && request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("refreshToken".equals(cookie.getName())) {
                    tokenStr = cookie.getValue();
                    break;
                }
            }
        }

        if (tokenStr != null) {
            refreshTokenRepository.findByToken(tokenStr).ifPresent(refreshToken -> {
                refreshToken.setRevoked(true);
                refreshTokenRepository.save(refreshToken);
            });
        }

        // Clear HttpOnly Cookie
        ResponseCookie cookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(false)
                .path("/api/v1/auth")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());

        return ResponseEntity.ok(Map.of("message", "Sesión cerrada correctamente"));
    }

    private ResponseEntity<AuthResponse> loginUser(User user, HttpServletResponse response) {
        // 1. Generate JWT Access Token
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", user.getRole());
        claims.put("email", user.getEmail());
        String accessToken = jwtService.generateToken(user.getUsername(), claims);

        // 2. Generate and persist secure Refresh Token
        String tokenStr = UUID.randomUUID().toString() + "-" + UUID.randomUUID().toString();
        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(tokenStr)
                .expiresAt(Instant.now().plusMillis(refreshExpirationMs))
                .isRevoked(false)
                .build();
        refreshTokenRepository.save(refreshToken);

        // 3. Set Refresh Token as Secure Cookie for Web Clients
        Cookie cookie = new Cookie("refreshToken", tokenStr);
        cookie.setHttpOnly(true);
        cookie.setSecure(false); // Set to true in prod (Requires HTTPS)
        cookie.setPath("/");
        cookie.setMaxAge((int) (refreshExpirationMs / 1000));
        response.addCookie(cookie);

        // Self-healing: Create profile if missing (repone registros huérfanos)
        Profile profile = profileRepository.findById(user.getId()).orElse(null);
        if (profile == null) {
            profile = Profile.builder()
                    .user(user)
                    .displayName(user.getUsername())
                    .bio("")
                    .isPrivate(false)
                    .build();
            profile = profileRepository.save(profile);
        }
        String displayName = profile.getDisplayName();

        AuthResponse authResponse = AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(tokenStr)
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .displayName(displayName)
                .role(user.getRole())
                .build();

        return ResponseEntity.ok(authResponse);
    }
}
