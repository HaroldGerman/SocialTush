package com.socialtush.modules.auth.service;

import com.socialtush.modules.auth.dto.AuthRequest;
import com.socialtush.modules.auth.dto.AuthResponse;
import com.socialtush.modules.auth.entity.RefreshToken;
import com.socialtush.modules.auth.repository.AccountActionTokenRepository;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AccountActionTokenRepository accountActionTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AccountAccessService accountAccessService;
    private final AccountSessionService accountSessionService;
    private final AccountMediaCleanupService accountMediaCleanupService;

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
                .authVersion(0)
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
        if (!user.isActive()) throw new DisabledException("Tu cuenta se encuentra suspendida o inactiva");
        if (!user.isVerified()) throw new DisabledException("Verifica tu correo antes de iniciar sesión.");

        return loginUser(user, httpRequest, httpResponse, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public AuthResponse refresh(HttpServletRequest httpRequest, HttpServletResponse httpResponse, AuthRequest.Refresh body) {
        String tokenStr = refreshTokenFrom(body, httpRequest);
        if (tokenStr == null) throw new BadCredentialsException("Refresh token no proporcionado");

        RefreshToken refreshToken = refreshTokenRepository.findByToken(tokenStr).orElse(null);
        if (refreshToken == null || refreshToken.isRevoked() || refreshToken.isExpired()) {
            throw new BadCredentialsException("Refresh token inválido, expirado o revocado");
        }

        refreshToken.setRevoked(true);
        refreshToken.setLastUsedAt(Instant.now());
        refreshTokenRepository.save(refreshToken);

        User user = refreshToken.getUser();
        if (!user.isActive()) throw new DisabledException("Tu cuenta se encuentra suspendida o inactiva");
        if (!user.isVerified()) throw new DisabledException("Verifica tu correo antes de continuar.");

        return loginUser(user, httpRequest, httpResponse, refreshToken);
    }

    @Transactional(rollbackFor = Exception.class)
    public void logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse, AuthRequest.Refresh body) {
        String tokenStr = refreshTokenFrom(body, httpRequest);
        if (tokenStr != null) {
            refreshTokenRepository.findByToken(tokenStr).ifPresent(refreshToken -> {
                refreshToken.setRevoked(true);
                refreshToken.setLastUsedAt(Instant.now());
                refreshTokenRepository.save(refreshToken);
            });
        }
        clearRefreshTokenCookie(httpRequest, httpResponse);
    }

    @Transactional(rollbackFor = Exception.class)
    public Map<String, Object> securityStatus(User user, HttpServletRequest request) {
        User current = requireAuthenticatedUser(user);
        String currentRefreshToken = refreshTokenFrom(null, request);
        accountSessionService.adoptCurrentSession(current, request, currentRefreshToken);
        List<AccountSessionService.SessionInfo> sessions = accountSessionService.sessions(current, currentRefreshToken);

        Map<String, Object> status = new HashMap<>();
        status.put("email", current.getEmail());
        status.put("verified", current.isVerified());
        status.put("activeSessions", sessions.size());
        status.put("sessions", sessions);
        status.put("createdAt", current.getCreatedAt());
        return status;
    }

    @Transactional(rollbackFor = Exception.class)
    public void changePassword(User user, String currentPassword, String newPassword,
                               HttpServletRequest request, HttpServletResponse response) {
        User current = requireAuthenticatedUser(user);
        requireCurrentPassword(current, currentPassword);
        if (newPassword == null || newPassword.length() < 8 || newPassword.length() > 128) {
            throw new IllegalArgumentException("La nueva contraseña debe tener entre 8 y 128 caracteres.");
        }
        if (passwordEncoder.matches(newPassword, current.getPasswordHash())) {
            throw new IllegalArgumentException("La nueva contraseña debe ser diferente a la actual.");
        }

        current.setPasswordHash(passwordEncoder.encode(newPassword));
        accountSessionService.invalidateAll(current);
        userRepository.save(current);
        clearRefreshTokenCookie(request, response);
    }

    @Transactional(rollbackFor = Exception.class)
    public void logoutAll(User user, String currentPassword,
                          HttpServletRequest request, HttpServletResponse response) {
        User current = requireAuthenticatedUser(user);
        requireCurrentPassword(current, currentPassword);
        accountSessionService.invalidateAll(current);
        userRepository.save(current);
        clearRefreshTokenCookie(request, response);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteAccount(User user, String currentPassword, String confirmation,
                              HttpServletRequest request, HttpServletResponse response) {
        User current = requireAuthenticatedUser(user);
        requireCurrentPassword(current, currentPassword);
        if (!"ELIMINAR".equals(confirmation == null ? "" : confirmation.trim().toUpperCase())) {
            throw new IllegalArgumentException("Escribe ELIMINAR para confirmar la eliminación de la cuenta.");
        }

        List<String> mediaKeys = accountMediaCleanupService.collectOwnedObjectKeys(current.getId());

        accountSessionService.deleteSessionArtifacts(current);
        accountActionTokenRepository.deleteByUser(current);
        profileRepository.deleteById(current.getId());
        profileRepository.flush();
        userRepository.delete(current);
        userRepository.flush();

        clearRefreshTokenCookie(request, response);
        accountMediaCleanupService.purgeAfterCommit(mediaKeys);
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
        return loginUser(user, httpRequest, httpResponse, null);
    }

    private AuthResponse loginUser(User user, HttpServletRequest httpRequest,
                                   HttpServletResponse httpResponse, RefreshToken previousSession) {
        AccountSessionService.DeviceMetadata device = accountSessionService.resolveDevice(httpRequest, previousSession);
        UUID sessionKey = accountSessionService.resolveSessionKey(previousSession);
        accountSessionService.revokeActiveDeviceTokens(user, device.deviceId());

        Map<String, Object> claims = new HashMap<>();
        claims.put("role", user.getRole());
        claims.put("email", user.getEmail());
        claims.put("authVersion", user.getAuthVersion());
        claims.put("sessionKey", sessionKey.toString());
        String accessToken = jwtService.generateToken(user.getUsername(), claims);

        String tokenStr = UUID.randomUUID() + "-" + UUID.randomUUID();
        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(tokenStr)
                .expiresAt(Instant.now().plusMillis(refreshExpirationMs))
                .isRevoked(false)
                .sessionKey(sessionKey)
                .deviceId(device.deviceId())
                .deviceLabel(device.label())
                .deviceType(device.type())
                .userAgent(device.userAgent())
                .lastUsedAt(Instant.now())
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

    private User requireAuthenticatedUser(User user) {
        if (user == null) throw new BadCredentialsException("Sesión no válida");
        return userRepository.findById(user.getId())
                .filter(User::isActive)
                .orElseThrow(() -> new BadCredentialsException("Sesión no válida"));
    }

    private void requireCurrentPassword(User user, String password) {
        if (password == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new BadCredentialsException("La contraseña actual es incorrecta");
        }
    }

    private String refreshTokenFrom(AuthRequest.Refresh body, HttpServletRequest request) {
        if (body != null && body.getRefreshToken() != null && !body.getRefreshToken().isBlank()) {
            return body.getRefreshToken();
        }
        if (request.getCookies() != null) {
            for (Cookie cookie : request.getCookies()) {
                if ("refreshToken".equals(cookie.getName())) return cookie.getValue();
            }
        }
        return null;
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
