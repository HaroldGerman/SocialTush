package com.socialtush.modules.circles.service;

import com.socialtush.modules.circles.entity.Circle;
import com.socialtush.modules.circles.entity.CircleMember;
import com.socialtush.modules.circles.repository.CircleJoinRequestRepository;
import com.socialtush.modules.circles.repository.CircleMemberRepository;
import com.socialtush.modules.circles.repository.CircleRepository;
import com.socialtush.modules.users.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CircleService {

    private final CircleRepository circleRepository;
    private final CircleMemberRepository circleMemberRepository;
    private final CircleJoinRequestRepository circleJoinRequestRepository;

    public List<Circle> getAllPublicCircles() {
        return circleRepository.findByVisibilityOrderByMembersCountDesc("PUBLIC");
    }

    public Circle getCircleBySlug(String slug) {
        return circleRepository.findBySlug(slug).orElse(null);
    }

    public Circle getVisibleCircle(String slug, User viewer) {
        Circle circle = circleRepository.findBySlug(slug.toLowerCase().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Círculo no encontrado"));
        requireCanView(circle, viewer);
        return circle;
    }

    public void requireCanView(Circle circle, User viewer) {
        if ("PUBLIC".equalsIgnoreCase(circle.getVisibility())) return;
        if (viewer == null || !circleMemberRepository.existsByCircleIdAndUserId(circle.getId(), viewer.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este círculo es privado");
        }
    }

    public List<CircleMember> getUserCircles(User user) {
        return circleMemberRepository.findByUserId(user.getId());
    }

    public List<CircleMember> getVisibleUserCircles(User target, User viewer) {
        List<CircleMember> memberships = circleMemberRepository.findByUserId(target.getId());
        if (viewer != null && viewer.getId().equals(target.getId())) return memberships;
        return memberships.stream()
                .filter(member -> "PUBLIC".equalsIgnoreCase(member.getCircle().getVisibility()))
                .toList();
    }

    @Transactional
    public Circle createCircle(String name, String description, String visibility, String type, String city, String country, User owner) {
        String slug = name.toLowerCase().trim().replaceAll("[^a-z0-9]", "-").replaceAll("-+", "-");
        if (circleRepository.existsBySlug(slug)) {
            slug = slug + "-" + UUID.randomUUID().toString().substring(0, 4);
        }

        String normalizedVisibility = visibility == null ? "PUBLIC" : visibility.toUpperCase().trim();
        if (!List.of("PUBLIC", "PRIVATE").contains(normalizedVisibility)) {
            throw new IllegalArgumentException("Privacidad de círculo inválida");
        }
        Circle circle = Circle.builder()
                .name(name.trim())
                .slug(slug)
                .description(description)
                .visibility(normalizedVisibility)
                .type(type != null ? type.toUpperCase() : "GENERAL")
                .city(city)
                .country(country)
                .owner(owner)
                .membersCount(1)
                .build();
        circle = circleRepository.save(circle);

        // Add owner as OWNER member
        CircleMember member = CircleMember.builder()
                .circle(circle)
                .user(owner)
                .role("OWNER")
                .build();
        circleMemberRepository.save(member);

        return circle;
    }

    @Transactional
    public boolean joinCircle(UUID circleId, User user) {
        Circle circle = circleRepository.findById(circleId).orElse(null);
        if (circle == null) return false;

        if (circleMemberRepository.existsByCircleIdAndUserId(circleId, user.getId())) {
            return true; // Already member
        }
        if (!"PUBLIC".equalsIgnoreCase(circle.getVisibility())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Este círculo requiere autorización para unirse");
        }

        CircleMember member = CircleMember.builder()
                .circle(circle)
                .user(user)
                .role("MEMBER")
                .build();
        circleMemberRepository.save(member);

        long count = circleMemberRepository.countByCircleId(circleId);
        circle.setMembersCount((int) count);
        circleRepository.save(circle);

        return true;
    }

    @Transactional
    public boolean leaveCircle(UUID circleId, User user) {
        Circle circle = circleRepository.findById(circleId).orElse(null);
        if (circle == null) return false;

        CircleMember member = circleMemberRepository.findByCircleIdAndUserId(circleId, user.getId()).orElse(null);
        if (member == null) return false;
        if ("OWNER".equalsIgnoreCase(member.getRole())) return false;

        circleMemberRepository.delete(member);

        long count = circleMemberRepository.countByCircleId(circleId);
        circle.setMembersCount((int) count);
        circleRepository.save(circle);

        return true;
    }

    public boolean isMember(UUID circleId, User user) {
        if (user == null) return false;
        return circleMemberRepository.existsByCircleIdAndUserId(circleId, user.getId());
    }
}
