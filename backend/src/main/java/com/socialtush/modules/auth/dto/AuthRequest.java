package com.socialtush.modules.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

public class AuthRequest {

    @Data
    public static class Register {
        @NotBlank(message = "El email es obligatorio")
        @Email(message = "El formato de email no es válido")
        private String email;

        @NotBlank(message = "La contraseña es obligatoria")
        @Size(min = 6, message = "La contraseña debe tener al menos 6 caracteres")
        private String password;

        @NotBlank(message = "El nombre de usuario es obligatorio")
        @Size(min = 3, max = 30, message = "El nombre de usuario debe tener entre 3 y 30 caracteres")
        @Pattern(regexp = "^[a-zA-Z0-9_.]+$", message = "El nombre de usuario sólo puede contener letras, números, puntos y guiones bajos")
        private String username;

        @NotBlank(message = "El nombre público es obligatorio")
        @Size(max = 100, message = "El nombre de pantalla no puede superar los 100 caracteres")
        private String displayName;
    }

    @Data
    public static class Login {
        @NotBlank(message = "El nombre de usuario o email es obligatorio")
        private String usernameOrEmail;

        @NotBlank(message = "La contraseña es obligatoria")
        private String password;
    }

    @Data
    public static class Refresh {
        @NotBlank(message = "El refresh token es obligatorio")
        private String refreshToken;
    }
}
