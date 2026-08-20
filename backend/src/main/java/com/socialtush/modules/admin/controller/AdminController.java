package com.socialtush.modules.admin.controller;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.socialtush.modules.admin.entity.AdminAuditLog;
import com.socialtush.modules.admin.repository.AdminAuditLogRepository;
import com.socialtush.modules.auth.entity.RefreshToken;
import com.socialtush.modules.auth.repository.RefreshTokenRepository;
import com.socialtush.modules.circles.repository.CircleRepository;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.social.repository.FollowRepository;
import com.socialtush.modules.stories.repository.StoryRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api/v1/admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminController {
    private static final Set<String> FILTERS = Set.of("ALL", "ACTIVE", "BLOCKED", "VERIFIED", "UNVERIFIED", "ADMINS");
    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final PostRepository postRepository;
    private final StoryRepository storyRepository;
    private final CircleRepository circleRepository;
    private final FollowRepository followRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AdminAuditLogRepository auditLogRepository;

    @GetMapping("/stats")
    public ResponseEntity<?> getStats() {
        Instant now = Instant.now();
        return ResponseEntity.ok(Map.of(
                "totalUsers", userRepository.count(), "activeUsers", userRepository.countByIsActiveTrue(),
                "blockedUsers", userRepository.countByIsActiveFalse(), "verifiedUsers", userRepository.countByIsVerifiedTrue(),
                "totalPosts", postRepository.count(), "activeStories", storyRepository.countByExpiresAtAfter(now),
                "totalCircles", circleRepository.count(), "newUsersToday", userRepository.countByCreatedAtAfter(now.truncatedTo(ChronoUnit.DAYS)),
                "newUsersLast7Days", userRepository.countByCreatedAtAfter(now.minus(7, ChronoUnit.DAYS))));
    }

    @GetMapping("/users")
    public ResponseEntity<?> getUsers(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size,
                                      @RequestParam(defaultValue = "") String query, @RequestParam(defaultValue = "ALL") String filter) {
        int safePage = Math.max(0, page), safeSize = Math.min(100, Math.max(1, size));
        String safeFilter = filter.trim().toUpperCase();
        if (!FILTERS.contains(safeFilter)) return ResponseEntity.badRequest().body(Map.of("message", "Filtro no válido"));
        Page<UserRepository.AdminUserView> result = userRepository.searchAdminUsers(query.trim(), safeFilter, Instant.now(),
                PageRequest.of(safePage, safeSize, Sort.by("createdAt").descending()));
        return ResponseEntity.ok(Map.of("users", result.getContent().stream().map(this::toDto).toList(),
                "currentPage", result.getNumber(), "totalItems", result.getTotalElements(),
                "totalPages", result.getTotalPages(), "pageSize", result.getSize()));
    }

    @GetMapping("/users/{userId}")
    public ResponseEntity<?> getUser(@PathVariable UUID userId) {
        User target = userRepository.findById(userId).orElse(null);
        return target == null ? notFound() : ResponseEntity.ok(toDto(target));
    }

    @GetMapping("/audit")
    public ResponseEntity<?> getAudit(@RequestParam(defaultValue = "0") int page,
                                      @RequestParam(defaultValue = "30") int size) {
        Page<AdminAuditLog> result = auditLogRepository.findAll(PageRequest.of(
                Math.max(0, page), Math.min(100, Math.max(1, size)), Sort.by("createdAt").descending()));
        return ResponseEntity.ok(Map.of(
                "logs", result.getContent(), "currentPage", result.getNumber(),
                "totalItems", result.getTotalElements(), "totalPages", result.getTotalPages()));
    }

    @PatchMapping("/users/{userId}")
    @Transactional
    public ResponseEntity<?> updateUser(@PathVariable UUID userId, @Valid @RequestBody AdminUpdateUserRequest request,
                                        @AuthenticationPrincipal User admin) {
        User target = userRepository.findById(userId).orElse(null);
        if (target == null) return notFound();
        if (request.username != null) {
            String value = request.username.trim();
            User duplicate = userRepository.findByUsernameIgnoreCase(value).orElse(null);
            if (duplicate != null && !duplicate.getId().equals(userId)) return conflict("El nombre de usuario ya está registrado");
            target.setUsername(value);
        }
        if (request.email != null) {
            String value = request.email.trim().toLowerCase();
            User duplicate = userRepository.findByEmailIgnoreCase(value).orElse(null);
            if (duplicate != null && !duplicate.getId().equals(userId)) return conflict("El correo electrónico ya está registrado");
            target.setEmail(value);
        }
        Profile profile = profileRepository.findById(userId).orElseGet(() -> Profile.builder().user(target).displayName(target.getUsername()).bio("").build());
        if (request.displayName != null) profile.setDisplayName(request.displayName.trim());
        if (request.bio != null) profile.setBio(request.bio.trim());
        if (request.isPrivate != null) profile.setPrivate(request.isPrivate);
        userRepository.save(target); profileRepository.save(profile); audit(admin, target, "ADMIN_UPDATE_USER");
        return ResponseEntity.ok(toDto(target));
    }

    @PostMapping("/users/{userId}/toggle-block")
    @Transactional
    public ResponseEntity<?> toggleBlockUser(@PathVariable UUID userId, @AuthenticationPrincipal User admin) {
        User target = userRepository.findById(userId).orElse(null);
        if (target == null) return notFound();
        if (admin.getId().equals(target.getId())) return ResponseEntity.badRequest().body(Map.of("message", "No puedes bloquear tu propia cuenta administrativa"));
        if (target.isActive() && "ADMIN".equals(target.getRole()) && userRepository.countByRoleAndIsActiveTrue("ADMIN") <= 1)
            return conflict("No se puede bloquear al último administrador activo");
        target.setActive(!target.isActive()); userRepository.save(target);
        if (!target.isActive()) {
            List<RefreshToken> tokens = refreshTokenRepository.findByUserAndIsRevokedFalse(target);
            tokens.forEach(token -> token.setRevoked(true)); refreshTokenRepository.saveAll(tokens);
        }
        audit(admin, target, target.isActive() ? "ADMIN_UNBLOCK_USER" : "ADMIN_BLOCK_USER");
        return ResponseEntity.ok(Map.of("userId", target.getId(), "isActive", target.isActive(),
                "message", target.isActive() ? "Usuario desbloqueado" : "Usuario bloqueado con éxito"));
    }

    @DeleteMapping("/posts/{postId}")
    public ResponseEntity<?> deletePost(@PathVariable UUID postId) {
        if (!postRepository.existsById(postId)) return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", "Publicación no encontrada"));
        postRepository.deleteById(postId); return ResponseEntity.ok(Map.of("message", "Publicación eliminada por moderador"));
    }

    private AdminUserDto toDto(UserRepository.AdminUserView v) {
        AdminUserDto d = new AdminUserDto();
        d.userId=v.getUserId(); d.username=v.getUsername(); d.email=v.getEmail(); d.role=v.getRole(); d.isActive=v.getActive(); d.isVerified=v.getVerified(); d.createdAt=v.getCreatedAt();
        d.displayName=v.getDisplayName(); d.bio=v.getBio(); d.avatarUrl=v.getAvatarUrl(); d.isPrivate=v.getPrivateAccount(); d.postCount=v.getPostCount(); d.followerCount=v.getFollowerCount(); d.followingCount=v.getFollowingCount(); d.activeStoryCount=v.getActiveStoryCount(); return d;
    }
    private AdminUserDto toDto(User u) {
        Profile p=profileRepository.findById(u.getId()).orElse(null); AdminUserDto d=new AdminUserDto();
        d.userId=u.getId(); d.username=u.getUsername(); d.email=u.getEmail(); d.role=u.getRole(); d.isActive=u.isActive(); d.isVerified=u.isVerified(); d.createdAt=u.getCreatedAt();
        d.displayName=p!=null?p.getDisplayName():u.getUsername(); d.bio=p!=null?p.getBio():""; d.avatarUrl=p!=null?p.getAvatarUrl():null; d.isPrivate=p!=null&&p.isPrivate();
        d.postCount=postRepository.countByUser(u); d.followerCount=followRepository.countByFollowing(u); d.followingCount=followRepository.countByFollower(u); d.activeStoryCount=storyRepository.countByUserAndExpiresAtAfter(u,Instant.now()); return d;
    }
    private void audit(User a,User t,String action){auditLogRepository.save(AdminAuditLog.builder().adminUserId(a.getId()).targetUserId(t.getId()).action(action).build());}
    private ResponseEntity<?> notFound(){return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message","Usuario no encontrado"));}
    private ResponseEntity<?> conflict(String m){return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message",m));}

    @Data public static class AdminUserDto {
        private UUID userId; private String username,email,role,displayName,bio,avatarUrl;
        @JsonProperty("isActive") private boolean isActive;
        @JsonProperty("isVerified") private boolean isVerified;
        @JsonProperty("isPrivate") private boolean isPrivate;
        private Instant createdAt; private long postCount,followerCount,followingCount,activeStoryCount;
    }
    @Data public static class AdminUpdateUserRequest {
        @Size(min=3,max=50) @Pattern(regexp="^[A-Za-z0-9._]+$",message="Username no válido") private String username;
        @Email @Size(max=255) private String email;
        @Size(min=1,max=100) private String displayName;
        @Size(max=1000) private String bio;
        private Boolean isPrivate;
    }
}
