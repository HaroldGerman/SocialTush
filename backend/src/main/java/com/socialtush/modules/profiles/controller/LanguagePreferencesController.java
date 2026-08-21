package com.socialtush.modules.profiles.controller;

import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/profiles/me/language")
@RequiredArgsConstructor
public class LanguagePreferencesController {

    private final ProfileRepository profileRepository;

    @GetMapping
    public ResponseEntity<?> getLanguage(@AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        Profile profile = profileRepository.findById(currentUser.getId()).orElse(null);
        if (profile == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Perfil no encontrado"));
        return ResponseEntity.ok(Map.of("preferredLanguage", normalize(profile.getPreferredLanguage())));
    }

    @PutMapping
    public ResponseEntity<?> updateLanguage(@RequestBody LanguageRequest request,
                                            @AuthenticationPrincipal User currentUser) {
        if (currentUser == null) return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", "No autenticado"));
        Profile profile = profileRepository.findById(currentUser.getId()).orElse(null);
        if (profile == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Perfil no encontrado"));
        if (request.getPreferredLanguage() == null || !(request.getPreferredLanguage().equals("es") || request.getPreferredLanguage().equals("en"))) {
            return ResponseEntity.badRequest().body(Map.of("message", "Idioma no soportado"));
        }
        profile.setPreferredLanguage(request.getPreferredLanguage());
        profileRepository.save(profile);
        return ResponseEntity.ok(Map.of("preferredLanguage", profile.getPreferredLanguage()));
    }

    private String normalize(String value) {
        return "en".equals(value) ? "en" : "es";
    }

    @Data
    public static class LanguageRequest {
        private String preferredLanguage;
    }
}
