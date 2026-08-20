package com.socialtush.modules.auth.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AccountSecurityIntegrationTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired ProfileRepository profileRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @Test
    void changePasswordInvalidatesOldAccessAndOldPassword() throws Exception {
        createVerifiedUser("security-change@lifonk.test", "security_change", "password123");
        Map<String, Object> login = login("security_change", "password123");
        String accessToken = (String) login.get("accessToken");

        mockMvc.perform(post("/api/v1/auth/change-password")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", "password123",
                                "newPassword", "new-password-456"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/auth/security")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "usernameOrEmail", "security_change",
                                "password", "password123"))))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "usernameOrEmail", "security_change",
                                "password", "new-password-456"))))
                .andExpect(status().isOk());
    }

    @Test
    void logoutAllImmediatelyInvalidatesAccessToken() throws Exception {
        createVerifiedUser("security-logout@lifonk.test", "security_logout", "password123");
        Map<String, Object> login = login("security_logout", "password123");
        String accessToken = (String) login.get("accessToken");

        mockMvc.perform(post("/api/v1/auth/logout-all")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("currentPassword", "password123"))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/auth/security")
                        .header("Authorization", "Bearer " + accessToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deleteAccountRequiresExplicitConfirmationAndRemovesUser() throws Exception {
        createVerifiedUser("security-delete@lifonk.test", "security_delete", "password123");
        Map<String, Object> login = login("security_delete", "password123");
        String accessToken = (String) login.get("accessToken");

        mockMvc.perform(delete("/api/v1/auth/account")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", "password123",
                                "confirmation", "NO"))))
                .andExpect(status().isBadRequest());

        mockMvc.perform(delete("/api/v1/auth/account")
                        .header("Authorization", "Bearer " + accessToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "currentPassword", "password123",
                                "confirmation", "ELIMINAR"))))
                .andExpect(status().isOk());

        assertThat(userRepository.findByUsernameIgnoreCase("security_delete")).isEmpty();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> login(String username, String password) throws Exception {
        var result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "usernameOrEmail", username,
                                "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readValue(result.getResponse().getContentAsString(), Map.class);
    }

    private void createVerifiedUser(String email, String username, String password) {
        User user = userRepository.saveAndFlush(User.builder()
                .email(email)
                .username(username)
                .passwordHash(passwordEncoder.encode(password))
                .role("USER")
                .isVerified(true)
                .isActive(true)
                .authVersion(0)
                .build());
        profileRepository.saveAndFlush(Profile.builder()
                .user(user)
                .displayName(username)
                .bio("")
                .isPrivate(false)
                .build());
    }
}
