package com.socialtush.modules.admin.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.socialtush.modules.auth.entity.RefreshToken;
import com.socialtush.modules.auth.repository.RefreshTokenRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminControllerIntegrationTest {
    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;
    @Autowired ProfileRepository profileRepository;
    @Autowired RefreshTokenRepository refreshTokenRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired ObjectMapper objectMapper;
    @Autowired EntityManager entityManager;
    User admin;
    User member;

    @BeforeEach void setup() {
        admin = saveUser("secure_admin", "secure-admin@example.com", "ADMIN", true);
        member = saveUser("searchable_member", "searchable@example.com", "USER", true);
        profileRepository.save(Profile.builder().user(admin).displayName("Admin Seguro").bio("").build());
        profileRepository.save(Profile.builder().user(member).displayName("Persona Buscable").bio("Bio inicial").build());
    }

    @Test void userCannotReadOrMutateAdminEndpointsAndAnonymousIsUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/admin/users").with(auth(member))).andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/v1/admin/users/" + admin.getId()).with(auth(member)).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(delete("/api/v1/admin/users/" + admin.getId()).with(auth(member))).andExpect(status().isForbidden());
    }

    @Test void adminSearchAndPaginationReturnRealUsers() throws Exception {
        mockMvc.perform(get("/api/v1/admin/users").param("query", "Persona Buscable").param("page", "0").param("size", "1").with(auth(admin)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.users.length()").value(1))
                .andExpect(jsonPath("$.users[0].username").value("searchable_member"))
                .andExpect(jsonPath("$.currentPage").value(0)).andExpect(jsonPath("$.pageSize").value(1))
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    @Test void auditEndpointIsAdminOnlyAndReturnsPersistedActions() throws Exception {
        mockMvc.perform(get("/api/v1/admin/audit")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/admin/audit").with(auth(member))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/admin/users/" + member.getId() + "/toggle-block").with(auth(admin)))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/audit").with(auth(admin)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.logs[0].action").value("ADMIN_BLOCK_USER"));
    }

    @Test void adminEditPersistsAllowedFieldsAndRejectsDuplicates() throws Exception {
        mockMvc.perform(patch("/api/v1/admin/users/" + member.getId()).with(auth(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("username","member_updated","email","member-updated@example.com","displayName","Nombre Actualizado","bio","Bio actualizada","isPrivate",true))))
                .andExpect(status().isOk()).andExpect(jsonPath("$.username").value("member_updated"));
        entityManager.flush(); entityManager.clear();
        User persisted = userRepository.findById(member.getId()).orElseThrow();
        Profile profile = profileRepository.findById(member.getId()).orElseThrow();
        assertEquals("member_updated", persisted.getUsername()); assertEquals("member-updated@example.com", persisted.getEmail());
        assertEquals("Nombre Actualizado", profile.getDisplayName()); assertEquals("Bio actualizada", profile.getBio()); assertTrue(profile.isPrivate());

        mockMvc.perform(patch("/api/v1/admin/users/" + member.getId()).with(auth(admin)).contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", admin.getEmail())))).andExpect(status().isConflict());
    }

    @Test void blockPersistsRevokesRefreshAndPreventsLoginAndRefresh() throws Exception {
        RefreshToken token = refreshTokenRepository.save(RefreshToken.builder().user(member).token("existing-refresh-token").expiresAt(Instant.now().plusSeconds(3600)).build());
        mockMvc.perform(post("/api/v1/admin/users/" + member.getId() + "/toggle-block").with(auth(admin))).andExpect(status().isOk()).andExpect(jsonPath("$.isActive").value(false));
        entityManager.flush(); entityManager.clear();
        assertFalse(userRepository.findById(member.getId()).orElseThrow().isActive());
        assertTrue(refreshTokenRepository.findById(token.getId()).orElseThrow().isRevoked());
        mockMvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("usernameOrEmail",member.getUsername(),"password","password123")))).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("refreshToken","existing-refresh-token")))).andExpect(status().isUnauthorized());
    }

    @Test void adminCannotBlockSelf() throws Exception {
        mockMvc.perform(post("/api/v1/admin/users/" + admin.getId() + "/toggle-block").with(auth(admin)))
                .andExpect(status().isBadRequest());
        assertTrue(userRepository.findById(admin.getId()).orElseThrow().isActive());
    }

    private User saveUser(String username,String email,String role,boolean active){return userRepository.save(User.builder().username(username).email(email).passwordHash(passwordEncoder.encode("password123")).role(role).isActive(active).build());}
    private org.springframework.test.web.servlet.request.RequestPostProcessor auth(User value){return authentication(new UsernamePasswordAuthenticationToken(value,null,List.of(new SimpleGrantedAuthority("ROLE_"+value.getRole()))));}
}
