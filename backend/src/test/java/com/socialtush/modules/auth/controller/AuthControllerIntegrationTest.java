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

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private ProfileRepository profileRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void register_createsUserSuccessfully() throws Exception {
        Map<String, String> request = Map.of(
                "email", "nuevo_int@socialtush.com",
                "username", "nuevo_int_user",
                "displayName", "Nuevo Usuario",
                "password", "password123"
        );

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().is2xxSuccessful())
                .andExpect(jsonPath("$.username").value("nuevo_int_user"))
                .andExpect(jsonPath("$.avatarUrl").isEmpty())
                .andExpect(jsonPath("$.accessToken").exists());
    }

    @Test
    void duplicateEmail_returnsBadRequest() throws Exception {
        Map<String, String> request = Map.of(
                "email", "dupi@socialtush.com",
                "username", "dupi_user1",
                "displayName", "Usuario 1",
                "password", "password123"
        );

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().is2xxSuccessful());

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
        Map<String, String> request = Map.of(
                "email", "unique1@socialtush.com",
                "username", "unique_name",
                "displayName", "Usuario 1",
                "password", "password123"
        );

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().is2xxSuccessful());

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
    void login_returnsJwtToken() throws Exception {
        Map<String, String> regRequest = Map.of(
                "email", "login_test@socialtush.com",
                "username", "login_test_user",
                "displayName", "Login User",
                "password", "password123"
        );

        var registration = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(regRequest)))
                .andReturn();

        var user = userRepository.findByUsernameIgnoreCase("login_test_user").orElseThrow();
        var profile = profileRepository.findById(user.getId()).orElseThrow();
        profile.setAvatarUrl("https://cdn.example/avatar-login.webp");
        profileRepository.saveAndFlush(profile);

        Map<String, String> loginRequest = Map.of(
                "usernameOrEmail", "login_test_user",
                "password", "password123"
        );

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").exists())
                .andExpect(jsonPath("$.username").value("login_test_user"))
                .andExpect(jsonPath("$.avatarUrl").value("https://cdn.example/avatar-login.webp"));

        Map<String, Object> registrationBody = objectMapper.readValue(
                registration.getResponse().getContentAsString(), Map.class);
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "refreshToken", registrationBody.get("refreshToken")))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.avatarUrl").value("https://cdn.example/avatar-login.webp"));
    }

    @Test
    void wrongPassword_returnsUnauthorized() throws Exception {
        Map<String, String> regRequest = Map.of(
                "email", "wrong_pass@socialtush.com",
                "username", "wrong_pass_user",
                "displayName", "Wrong User",
                "password", "correct_pass"
        );

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(regRequest)));

        Map<String, String> loginRequest = Map.of(
                "usernameOrEmail", "wrong_pass_user",
                "password", "incorrect_pass"
        );

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logout_revokesRefreshTokenInBody() throws Exception {
        Map<String, String> regRequest = Map.of(
                "email", "logout_test@socialtush.com",
                "username", "logout_user",
                "displayName", "Logout User",
                "password", "password123"
        );

        var regResponse = mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(regRequest)))
                .andReturn();

        String responseBody = regResponse.getResponse().getContentAsString();
        Map<String, Object> map = objectMapper.readValue(responseBody, Map.class);
        String refreshToken = (String) map.get("refreshToken");

        Map<String, String> logoutRequest = Map.of("refreshToken", refreshToken);

        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(logoutRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Sesión cerrada correctamente"));
    }
}
