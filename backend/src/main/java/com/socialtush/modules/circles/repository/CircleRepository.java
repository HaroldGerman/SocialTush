package com.socialtush.modules.circles.repository;

import com.socialtush.modules.circles.entity.Circle;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface CircleRepository extends JpaRepository<Circle, UUID> {
    Optional<Circle> findBySlug(String slug);
    Optional<Circle> findByNameIgnoreCase(String name);
    boolean existsByNameIgnoreCase(String name);
    boolean existsBySlug(String slug);
    List<Circle> findByVisibilityOrderByMembersCountDesc(String visibility);
    List<Circle> findByOwnerId(UUID ownerId);
}
