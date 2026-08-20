package com.socialtush.modules.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialtush.modules.users.repository.UserRepository;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
public class AuthControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private ProfileRepository profileRepository;
    @Autowired private ObjectMapper objectMapper;

    @Test
    void register_createsUnverifiedUserAndRequestsEmailVerification() throws Exception {
        Map<String, String> request = Map.of(
                "email", "nuevo_int@socialtush.com",
                "username", "nuevo_int_user",
                "displayName", "Nuevo Usuario",
                "password", "password123"
        );

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("nuevo_int@socialtush.com"))
                .andExpect(jsonPath("$.message").exists());

        var user = userRepository.findByUsernameIgnoreCase("nuevo_int_user").orElseThrow();
        org.assertj.core.api.Assertions.assertThat(user.isVerified()).isFalse();
    }

    @Test
    void duplicateEmail_returnsBadRequest() throws Exception {
        register("dupi@socialtush.com", "dupi_user1", "password123");

        Map<String, String> duplicateRequest = Map.of(
                "email", "dupi@socialtush.com",
                "username", "dupi_user2",
                "displayName", "Usuario 2",
                "password", "password123"
        );

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicateRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void duplicateUsername_returnsBadRequest() throws Exception {
        register("unique1@socialtush.com", "unique_name", "password123");

        Map<String, String> duplicateRequest = Map.of(
                "email", "unique2@socialtush.com",
                "username", "unique_name",
                "displayName", "Usuario 2",
                "password", "password123"
        );

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(duplicateRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void unverifiedUserCannotLogin() throws Exception {
        register("verify_me@socialtush.com", "verify_me", "password123");

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "usernameOrEmail", "verify_me",
                                "password", "password123"))))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("Verifica tu correo antes de iniciar sesión."));
    }

    @Test
    void verifiedUserCanLoginAndRefresh() throws Exception {
        register("login_test@socialtush.com", "login_test_user", "password123");
        var user = userRepository.findByUsernameIgnoreCase("login_test_user").orElseThrow();
        user.setVerified(true);
        userRepository.saveAndFlush(user);
        var profile = profileRepository.findById(user.getId()).orElseThrow();
        profile.setAvatarUrl("https://cdn.example/avatar-login.webp");
        profileRepository.saveAndFlush(profile);

        var loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "usernameOrEmail", "login_test_user",
                                "password", "password123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(jsonPath("$.avatarUrl").value("https://cdn.example/avatar-login.webp"))
                .andReturn();

        Map<String, Object> loginBody = objectMapper.readValue(loginResult.getResponse().getContentAsString(), Map.class);
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", loginBody.get("refreshToken")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value("https://cdn.example/avatar-login.webp"));
    }

    @Test
    void forgotPasswordDoesNotRevealWhetherEmailExists() throws Exception {
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "nobody@socialtush.com"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }

    @Test
    void wrongPassword_returnsUnauthorized() throws Exception {
        register("wrong_pass@socialtush.com", "wrong_pass_user", "correct_pass");
        var user = userRepository.findByUsernameIgnoreCase("wrong_pass_user").orElseThrow();
        user.setVerified(true);
        userRepository.saveAndFlush(user);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "usernameOrEmail", "wrong_pass_user",
                                "password", "incorrect_pass"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logout_revokesRefreshTokenInBody() throws Exception {
        register("logout_test@socialtush.com", "logout_user", "password123");
        var user = userRepository.findByUsernameIgnoreCase("logout_user").orElseThrow();
        user.setVerified(true);
        userRepository.saveAndFlush(user);

        var loginResult = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "usernameOrEmail", "logout_user",
                                "password", "password123"))))
                .andReturn();
        Map<String, Object> loginBody = objectMapper.readValue(loginResult.getResponse().getContentAsString(), Map.class);

        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("refreshToken", loginBody.get("refreshToken")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Sesión cerrada correctamente"));
    }

    private void register(String email, String username, String password) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", email,
                                "username", username,
                                "displayName", username,
                                "password", password))))
                .andExpect(status().isOk());
    }
}
