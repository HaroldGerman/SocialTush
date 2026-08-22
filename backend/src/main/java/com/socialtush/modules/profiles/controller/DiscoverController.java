package com.socialtush.modules.profiles.controller;

import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.text.Normalizer;
import java.util.*;

@RestController
@RequestMapping("/api/v1/discover")
@RequiredArgsConstructor
public class DiscoverController {
    private final ProfileRepository profileRepository;

    private static final LinkedHashMap<String, List<String>> ALIASES = new LinkedHashMap<>();
    private static final LinkedHashMap<String, String> LABELS = new LinkedHashMap<>();
    static {
        register("tecnologia", "Tecnología", "tech", "tecnologia", "tecnología");
        register("gaming", "Gaming", "gaming", "videojuegos", "esports");
        register("musica", "Música", "music", "musica", "música");
        register("anime", "Anime & Manga", "anime", "manga", "anime & manga");
        register("fotografia", "Fotografía", "photo", "fotografia", "fotografía");
        register("ciencia", "Ciencia", "science", "ciencia");
        register("viajes", "Viajes", "travel", "viajes", "viaje");
        register("fitness", "Fitness & Bienestar", "fitness", "fitness & salud", "salud", "bienestar");
        register("arte", "Arte & Diseño", "art", "arte", "diseño", "arte & diseño");
        register("programacion", "Programación", "code", "programacion", "programación", "java", "desarrollo");
        register("cine", "Cine & Series", "cinema", "cine", "series", "cine & series");
        register("naturaleza", "Naturaleza", "nature", "naturaleza", "ecologia", "ecología");
    }

    private static void register(String slug, String label, String... aliases) {
        LABELS.put(slug, label);
        ALIASES.put(slug, Arrays.stream(aliases).map(DiscoverController::normalize).toList());
    }

    @GetMapping("/summary")
    public ResponseEntity<?> summary(@AuthenticationPrincipal User currentUser) {
        List<Profile> profiles = profileRepository.findAll();
        Set<String> mine = new LinkedHashSet<>();
        if (currentUser != null) {
            profileRepository.findById(currentUser.getId()).ifPresent(profile -> mine.addAll(resolveCategories(profile.getInterests())));
        }

        List<Map<String, Object>> categories = new ArrayList<>();
        for (String slug : LABELS.keySet()) {
            long count = 0;
            List<Map<String, Object>> people = new ArrayList<>();
            for (Profile profile : profiles) {
                if (!profile.isOnboardingCompleted() || !resolveCategories(profile.getInterests()).contains(slug)) continue;
                count++;
                if (!profile.isPrivate() && people.size() < 8 && profile.getUser() != null) {
                    Map<String, Object> person = new LinkedHashMap<>();
                    person.put("username", profile.getUser().getUsername());
                    person.put("displayName", profile.getDisplayName());
                    person.put("avatarUrl", profile.getAvatarUrl() == null ? "" : profile.getAvatarUrl());
                    person.put("bio", profile.getBio() == null ? "" : profile.getBio());
                    people.add(person);
                }
            }
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("slug", slug);
            item.put("label", LABELS.get(slug));
            item.put("members", count);
            item.put("personalized", mine.contains(slug));
            item.put("people", people);
            categories.add(item);
        }
        categories.sort(Comparator.comparing((Map<String, Object> item) -> !(Boolean) item.get("personalized"))
                .thenComparing(item -> -(Long) item.get("members")));

        return ResponseEntity.ok(Map.of(
                "myInterests", mine,
                "categories", categories,
                "source", "onboarding"
        ));
    }

    private static Set<String> resolveCategories(String interests) {
        Set<String> result = new LinkedHashSet<>();
        if (interests == null || interests.isBlank()) return result;
        for (String raw : interests.split(",")) {
            String value = normalize(raw);
            for (Map.Entry<String, List<String>> entry : ALIASES.entrySet()) {
                if (entry.getValue().stream().anyMatch(alias -> value.equals(alias) || value.contains(alias))) result.add(entry.getKey());
            }
        }
        return result;
    }

    private static String normalize(String value) {
        if (value == null) return "";
        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .trim();
    }
}
