package com.socialtush.modules.profiles.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
public class OfficialDiscoveryController {

    private static final String OFFICIAL_USER_ID = "00000000-0000-0000-0000-00000000d15c";

    @GetMapping("/profiles/lifonk-descubre")
    public ResponseEntity<?> getOfficialProfile() {
        return ResponseEntity.ok(Map.ofEntries(
                Map.entry("userId", OFFICIAL_USER_ID),
                Map.entry("username", "lifonk-descubre"),
                Map.entry("displayName", "Lifonk Descubre"),
                Map.entry("bio", "La cuenta oficial para descubrir lugares, ciencia, cultura y curiosidades dentro de Lifonk."),
                Map.entry("avatarUrl", ""),
                Map.entry("interests", "Cultura general,Viajes,Naturaleza,Ciencia,Historia,Tecnología"),
                Map.entry("isPrivate", false),
                Map.entry("isSelf", false),
                Map.entry("isFollowing", true),
                Map.entry("canViewContent", true),
                Map.entry("relationshipStatus", "FOLLOWING"),
                Map.entry("postCount", 3),
                Map.entry("followersCount", 1),
                Map.entry("followingCount", 0),
                Map.entry("whoCanMessage", "NONE"),
                Map.entry("whoCanComment", "EVERYONE"),
                Map.entry("readReceiptsEnabled", false)
        ));
    }

    @GetMapping("/posts/user/lifonk-descubre")
    public ResponseEntity<?> getOfficialPosts() {
        String now = Instant.now().toString();
        List<Map<String, Object>> posts = List.of(
                officialPost(
                        "00000000-0000-0000-0000-000000000d01",
                        "Hay lugares que parecen inventados",
                        "Montañas, niebla y silencio. A veces descubrir también es detenerse un momento y mirar.",
                        "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=82",
                        now
                ),
                officialPost(
                        "00000000-0000-0000-0000-000000000d02",
                        "El desierto también guarda ritmo",
                        "Las dunas cambian lentamente con el viento: un paisaje puede estar vivo aunque parezca inmóvil.",
                        "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=82",
                        now
                ),
                officialPost(
                        "00000000-0000-0000-0000-000000000d03",
                        "Un minuto de bosque",
                        "Los ecosistemas forestales conectan raíces, hongos, agua y nutrientes en redes mucho más complejas de lo que vemos.",
                        "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=82",
                        now
                )
        );
        return ResponseEntity.ok(Map.of("content", posts));
    }

    private Map<String, Object> officialPost(String postId, String title, String caption, String image, String createdAt) {
        return Map.ofEntries(
                Map.entry("postId", postId),
                Map.entry("userId", OFFICIAL_USER_ID),
                Map.entry("username", "lifonk-descubre"),
                Map.entry("displayName", "Lifonk Descubre"),
                Map.entry("avatarUrl", ""),
                Map.entry("caption", title + "\n\n" + caption),
                Map.entry("mediaUrls", List.of(image)),
                Map.entry("likesCount", 0),
                Map.entry("commentsCount", 0),
                Map.entry("hasLiked", false),
                Map.entry("isSaved", false),
                Map.entry("createdAt", createdAt)
        );
    }
}
