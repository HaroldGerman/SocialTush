package com.socialtush.modules.auth.service;

import com.socialtush.modules.auth.entity.AccountActionToken;
import com.socialtush.modules.auth.entity.RefreshToken;
import com.socialtush.modules.auth.repository.AccountActionTokenRepository;
import com.socialtush.modules.auth.repository.RefreshTokenRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AccountAccessService {

    public static final String PURPOSE_VERIFY_EMAIL = "VERIFY_EMAIL";
    public static final String PURPOSE_RESET_PASSWORD = "RESET_PASSWORD";

    private final UserRepository userRepository;
    private final AccountActionTokenRepository tokenRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final ResendEmailService emailService;

    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${app.web-url:https://social-tush.vercel.app}")
    private String webUrl;

    @Value("${app.account.email-verification-expiration-minutes:1440}")
    private long verificationExpirationMinutes;

    @Value("${app.account.password-reset-expiration-minutes:20}")
    private long passwordResetExpirationMinutes;

    @Value("${app.account.action-cooldown-seconds:60}")
    private long actionCooldownSeconds;

    @Transactional
    public void sendVerificationForUser(User user) {
        if (user == null || user.isVerified() || !user.isActive()) return;
        if (isCoolingDown(user, PURPOSE_VERIFY_EMAIL)) return;

        String token = issueToken(user, PURPOSE_VERIFY_EMAIL, verificationExpirationMinutes);
        String link = normalizedWebUrl() + "/verify-email?token=" + token;
        emailService.sendHtml(
                user.getEmail(),
                "Verifica tu correo en Lifonk",
                verificationEmailHtml(user.getUsername(), link)
        );
    }

    @Transactional
    public void requestVerification(String email) {
        User user = findActiveUserByEmail(email);
        if (user == null || user.isVerified()) return;
        sendVerificationForUser(user);
    }

    @Transactional
    public void verifyEmail(String rawToken) {
        String message = "El enlace de verificación no es válido o ha expirado.";
        if (rawToken == null || rawToken.isBlank()) throw new IllegalArgumentException(message);

        AccountActionToken token = tokenRepository
                .findByTokenHashAndPurpose(hash(rawToken.trim()), PURPOSE_VERIFY_EMAIL)
                .orElseThrow(() -> new IllegalArgumentException(message));

        // Make the verification link idempotent. A browser retry must not turn a successful
        // verification into an error just because the token was consumed milliseconds earlier.
        if (token.isUsed() && token.getUser().isVerified()) return;
        if (token.isUsed() || token.isExpired() || !token.getUser().isActive()) {
            throw new IllegalArgumentException(message);
        }

        User user = token.getUser();
        user.setVerified(true);
        userRepository.save(user);
        consumeToken(token);
        invalidateOutstanding(user, PURPOSE_VERIFY_EMAIL, token.getId());
    }

    @Transactional
    public void requestPasswordReset(String email) {
        User user = findActiveUserByEmail(email);
        if (user == null || isCoolingDown(user, PURPOSE_RESET_PASSWORD)) return;

        String token = issueToken(user, PURPOSE_RESET_PASSWORD, passwordResetExpirationMinutes);
        String link = normalizedWebUrl() + "/reset-password?token=" + token;
        emailService.sendHtml(
                user.getEmail(),
                "Restablece tu contraseña de Lifonk",
                passwordResetEmailHtml(user.getUsername(), link)
        );
    }

    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        if (newPassword == null || newPassword.length() < 8 || newPassword.length() > 128) {
            throw new IllegalArgumentException("La nueva contraseña debe tener entre 8 y 128 caracteres.");
        }

        AccountActionToken token = requireUsableToken(rawToken, PURPOSE_RESET_PASSWORD,
                "El enlace para restablecer la contraseña no es válido o ha expirado.");
        User user = token.getUser();
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        user.setVerified(true);
        userRepository.save(user);

        consumeToken(token);
        invalidateOutstanding(user, PURPOSE_RESET_PASSWORD, token.getId());
        revokeAllRefreshTokens(user);
    }

    private User findActiveUserByEmail(String email) {
        if (email == null || email.isBlank()) return null;
        return userRepository.findByEmailIgnoreCase(email.trim())
                .filter(User::isActive)
                .orElse(null);
    }

    private boolean isCoolingDown(User user, String purpose) {
        if (actionCooldownSeconds <= 0) return false;
        return tokenRepository.findFirstByUserAndPurposeAndUsedAtIsNullOrderByCreatedAtDesc(user, purpose)
                .map(AccountActionToken::getCreatedAt)
                .filter(createdAt -> createdAt != null && createdAt.isAfter(Instant.now().minusSeconds(actionCooldownSeconds)))
                .isPresent();
    }

    private String issueToken(User user, String purpose, long expirationMinutes) {
        invalidateOutstanding(user, purpose, null);

        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        AccountActionToken token = AccountActionToken.builder()
                .user(user)
                .purpose(purpose)
                .tokenHash(hash(rawToken))
                .expiresAt(Instant.now().plus(Math.max(1, expirationMinutes), ChronoUnit.MINUTES))
                .build();
        tokenRepository.save(token);
        return rawToken;
    }

    private AccountActionToken requireUsableToken(String rawToken, String purpose, String message) {
        if (rawToken == null || rawToken.isBlank()) throw new IllegalArgumentException(message);
        AccountActionToken token = tokenRepository.findByTokenHashAndPurpose(hash(rawToken.trim()), purpose)
                .orElseThrow(() -> new IllegalArgumentException(message));
        if (token.isUsed() || token.isExpired() || !token.getUser().isActive()) {
            throw new IllegalArgumentException(message);
        }
        return token;
    }

    private void consumeToken(AccountActionToken token) {
        token.setUsedAt(Instant.now());
        tokenRepository.save(token);
    }

    private void invalidateOutstanding(User user, String purpose, java.util.UUID exceptId) {
        List<AccountActionToken> active = tokenRepository.findByUserAndPurposeAndUsedAtIsNull(user, purpose);
        Instant now = Instant.now();
        boolean changed = false;
        for (AccountActionToken candidate : active) {
            if (exceptId != null && exceptId.equals(candidate.getId())) continue;
            candidate.setUsedAt(now);
            changed = true;
        }
        if (changed) tokenRepository.saveAll(active);
    }

    private void revokeAllRefreshTokens(User user) {
        List<RefreshToken> activeTokens = refreshTokenRepository.findByUserAndIsRevokedFalse(user);
        if (activeTokens.isEmpty()) return;
        activeTokens.forEach(token -> token.setRevoked(true));
        refreshTokenRepository.saveAll(activeTokens);
    }

    private String hash(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 no disponible", impossible);
        }
    }

    private String normalizedWebUrl() {
        String value = webUrl == null || webUrl.isBlank() ? "https://social-tush.vercel.app" : webUrl.trim();
        return value.replaceAll("/+$", "");
    }

    private String verificationEmailHtml(String username, String link) {
        return emailLayout(
                "Verifica tu correo",
                "Hola @" + escapeHtml(username) + ", confirma que este correo te pertenece para proteger tu cuenta de Lifonk.",
                "Verificar correo",
                link,
                "Este enlace caduca en " + verificationExpirationMinutes + " minutos."
        );
    }

    private String passwordResetEmailHtml(String username, String link) {
        return emailLayout(
                "Restablece tu contraseña",
                "Hola @" + escapeHtml(username) + ", recibimos una solicitud para cambiar la contraseña de tu cuenta de Lifonk.",
                "Crear nueva contraseña",
                link,
                "Este enlace caduca en " + passwordResetExpirationMinutes + " minutos. Si no fuiste tú, ignora este correo."
        );
    }

    private String emailLayout(String title, String text, String button, String link, String footer) {
        return """
                <!doctype html>
                <html lang="es">
                <body style="margin:0;background:#07151d;font-family:Arial,sans-serif;color:#e2e8f0;padding:32px 16px">
                  <div style="max-width:560px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:20px;padding:32px">
                    <div style="font-size:28px;font-weight:800;color:#2dd4bf;margin-bottom:22px">Lifonk</div>
                    <h1 style="font-size:24px;color:#ffffff;margin:0 0 14px">%s</h1>
                    <p style="font-size:15px;line-height:1.7;color:#cbd5e1;margin:0 0 26px">%s</p>
                    <a href="%s" style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:12px">%s</a>
                    <p style="font-size:12px;line-height:1.6;color:#64748b;margin:28px 0 0">%s</p>
                  </div>
                </body>
                </html>
                """.formatted(title, text, link, button, footer);
    }

    private String escapeHtml(String value) {
        if (value == null) return "";
        return value.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
