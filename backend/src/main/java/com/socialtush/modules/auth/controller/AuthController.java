package com.socialtush.modules.auth.controller;

import com.socialtush.modules.auth.dto.AuthRequest;
import com.socialtush.modules.auth.dto.AuthResponse;
import com.socialtush.modules.auth.service.AuthService;
import com.socialtush.modules.users.entity.User;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<Map<String, String>> register(@Valid @RequestBody AuthRequest.Register request) {
        authService.register(request);
        return ResponseEntity.ok(Map.of(
                "message", "Cuenta creada. Revisa tu correo para verificarla.",
                "email", request.getEmail().trim()
        ));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(
            @Valid @RequestBody AuthRequest.Login request,
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse) {
        return ResponseEntity.ok(authService.login(request, httpRequest, httpResponse));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse,
            @RequestBody(required = false) AuthRequest.Refresh body) {
        return ResponseEntity.ok(authService.refresh(httpRequest, httpResponse, body));
    }

    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(
            HttpServletRequest httpRequest,
            HttpServletResponse httpResponse,
            @RequestBody(required = false) AuthRequest.Refresh body) {
        authService.logout(httpRequest, httpResponse, body);
        return ResponseEntity.ok(Map.of("message", "Sesión cerrada correctamente"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@Valid @RequestBody AuthRequest.ForgotPassword request) {
        authService.requestPasswordReset(request.getEmail());
        return ResponseEntity.ok(Map.of(
                "message", "Si existe una cuenta asociada a ese correo, recibirás un enlace para restablecer tu contraseña."
        ));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@Valid @RequestBody AuthRequest.ResetPassword request) {
        authService.resetPassword(request.getToken(), request.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "Contraseña actualizada. Inicia sesión nuevamente."));
    }

    @PostMapping("/verify-email")
    public ResponseEntity<Map<String, String>> verifyEmail(@Valid @RequestBody AuthRequest.VerifyEmail request) {
        authService.verifyEmail(request.getToken());
        return ResponseEntity.ok(Map.of("message", "Correo verificado correctamente."));
    }

    @PostMapping("/resend-verification")
    public ResponseEntity<Map<String, String>> resendVerification(@Valid @RequestBody AuthRequest.ResendVerification request) {
        authService.requestVerification(request.getEmail());
        return ResponseEntity.ok(Map.of(
                "message", "Si la cuenta existe y todavía necesita verificación, enviaremos un nuevo enlace."
        ));
    }

    @GetMapping("/security")
    public ResponseEntity<Map<String, Object>> security(
            @AuthenticationPrincipal User currentUser,
            HttpServletRequest request) {
        return ResponseEntity.ok(authService.securityStatus(currentUser, request));
    }

    @PostMapping("/change-password")
    public ResponseEntity<Map<String, String>> changePassword(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody AuthRequest.ChangePassword body,
            HttpServletRequest request,
            HttpServletResponse response) {
        authService.changePassword(currentUser, body.getCurrentPassword(), body.getNewPassword(), request, response);
        return ResponseEntity.ok(Map.of("message", "Contraseña actualizada. Todas las sesiones fueron cerradas."));
    }

    @PostMapping("/logout-all")
    public ResponseEntity<Map<String, String>> logoutAll(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody AuthRequest.ConfirmPassword body,
            HttpServletRequest request,
            HttpServletResponse response) {
        authService.logoutAll(currentUser, body.getCurrentPassword(), request, response);
        return ResponseEntity.ok(Map.of("message", "Sesiones cerradas en todos los dispositivos."));
    }

    @DeleteMapping("/account")
    public ResponseEntity<Map<String, String>> deleteAccount(
            @AuthenticationPrincipal User currentUser,
            @Valid @RequestBody AuthRequest.DeleteAccount body,
            HttpServletRequest request,
            HttpServletResponse response) {
        authService.deleteAccount(currentUser, body.getCurrentPassword(), body.getConfirmation(), request, response);
        return ResponseEntity.ok(Map.of("message", "Tu cuenta de Lifonk fue eliminada permanentemente."));
    }
}
