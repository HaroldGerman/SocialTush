package com.socialtush.modules.auth.service;

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
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AccountAccessService accountAccessService;

    @Value("${app.jwt.refresh-expiration-ms}")
    private long refreshExpirationMs;

    @Transactional(rollbackFor = Exception.class)
    public void register(AuthRequest.Register request) {
        String normalizedUsername = request.getUsername().toLowerCase().trim();
        String normalizedEmail = request.getEmail().toLowerCase().trim();

        if (userRepository.existsByUsernameIgnoreCase(normalizedUsername)) {
            throw new IllegalArgumentException("El nombre de usuario ya está registrado");
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("El correo electrónico ya está registrado");
        }

        User user = User.builder()
                .username(request.getUsername().trim())
                .email(request.getEmail().trim())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role("USER")
                .isVerified(false)
                .isActive(true)
                .build();
        user = userRepository.save(user);

        Profile profile = Profile.builder()
                .user(user)
                .displayName(request.getDisplayName().trim())
                .bio("")
                .isPrivate(false)
                .build();
        profileRepository.save(profile);

        accountAccessService.sendVerificationForUser(user);
    }

    @Transactional(rollbackFor = Exception.class)
    public AuthResponse login(AuthRequest.Login request, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String input = request.getUsernameOrEmail().trim();
        User user = userRepository.findByUsernameIgnoreCase(input)
                .or(() -> userRepository.findByEmailIgnoreCase(input))
                .orElse(null);

        if (user == null || !passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new BadCredentialsException("Credenciales incorrectas");
        }

        if (!user.isActive()) {
            throw new DisabledException("Tu cuenta se encuentra suspendida o inactiva");
        }
        if (!user.isVerified()) {
            throw new DisabledException("Verifica tu correo antes de iniciar sesión.");
        }

        return loginUser(user, httpRequest, httpResponse);
    }

    @Transactional(rollbackFor = Exception.class)
    public AuthResponse refresh(HttpServletRequest httpRequest, HttpServletResponse httpResponse, AuthRequest.Refresh body) {
        String tokenStr = null;

        if (body != null && body.getRefreshToken() != null && !body.getRefreshToken().isBlank()) {
            tokenStr = body.getRefreshToken();
        }

        if (tokenStr == null && httpRequest.getCookies() != null) {
            for (Cookie cookie : httpRequest.getCookies()) {
                if ("refreshToken".equals(cookie.getName())) {
                    tokenStr = cookie.getValue();
                    break;
                }
            }
        }

        if (tokenStr == null) {
            throw new BadCredentialsException("Refresh token no proporcionado");
        }

        RefreshToken refreshToken = refreshTokenRepository.findByToken(tokenStr).orElse(null);
        if (refreshToken == null || refreshToken.isRevoked() || refreshToken.isExpired()) {
            throw new BadCredentialsException("Refresh token inválido, expirado o revocado");
        }

        refreshToken.setRevoked(true);
        refreshTokenRepository.save(refreshToken);

        User user = refreshToken.getUser();
        if (!user.isActive()) {
            throw new DisabledException("Tu cuenta se encuentra suspendida o inactiva");
        }
        if (!user.isVerified()) {
            throw new DisabledException("Verifica tu correo antes de continuar.");
        }

        return loginUser(user, httpRequest, httpResponse);
    }

    @Transactional(rollbackFor = Exception.class)
    public void logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse, AuthRequest.Refresh body) {
        String tokenStr = null;

        if (body != null && body.getRefreshToken() != null && !body.getRefreshToken().isBlank()) {
            tokenStr = body.getRefreshToken();
        }

        if (tokenStr == null && httpRequest.getCookies() != null) {
            for (Cookie cookie : httpRequest.getCookies()) {
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

        clearRefreshTokenCookie(httpRequest, httpResponse);
    }

    public void requestPasswordReset(String email) {
        accountAccessService.requestPasswordReset(email);
    }

    public void resetPassword(String token, String newPassword) {
        accountAccessService.resetPassword(token, newPassword);
    }

    public void verifyEmail(String token) {
        accountAccessService.verifyEmail(token);
    }

    public void requestVerification(String email) {
        accountAccessService.requestVerification(email);
    }

    @Transactional(rollbackFor = Exception.class)
    public AuthResponse loginUser(User user, HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("role", user.getRole());
        claims.put("email", user.getEmail());
        String accessToken = jwtService.generateToken(user.getUsername(), claims);

        String tokenStr = UUID.randomUUID().toString() + "-" + UUID.randomUUID();
        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(tokenStr)
                .expiresAt(Instant.now().plusMillis(refreshExpirationMs))
                .isRevoked(false)
                .build();
        refreshTokenRepository.save(refreshToken);

        setRefreshTokenCookie(httpRequest, httpResponse, tokenStr);

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

        return AuthResponse.builder()
                .accessToken(accessToken)
                .refreshToken(tokenStr)
                .userId(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .displayName(profile.getDisplayName())
                .avatarUrl(profile.getAvatarUrl())
                .role(user.getRole())
                .build();
    }

    private void setRefreshTokenCookie(HttpServletRequest request, HttpServletResponse response, String refreshToken) {
        boolean isHttps = isHttpsRequest(request);

        ResponseCookie cookie = ResponseCookie.from("refreshToken", refreshToken)
                .httpOnly(true)
                .secure(isHttps)
                .path("/")
                .maxAge(refreshExpirationMs / 1000)
                .sameSite(isHttps ? "None" : "Lax")
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void clearRefreshTokenCookie(HttpServletRequest request, HttpServletResponse response) {
        boolean isHttps = isHttpsRequest(request);

        ResponseCookie cookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(isHttps)
                .path("/")
                .maxAge(0)
                .sameSite(isHttps ? "None" : "Lax")
                .build();

        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private boolean isHttpsRequest(HttpServletRequest request) {
        String origin = request.getHeader("Origin");
        String forwardedProto = request.getHeader("X-Forwarded-Proto");
        return request.isSecure()
                || "https".equalsIgnoreCase(forwardedProto)
                || (origin != null && origin.toLowerCase().startsWith("https://"));
    }
}
