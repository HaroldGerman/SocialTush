package com.socialtush.modules.profiles.repository;

import com.socialtush.modules.profiles.entity.Profile;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ProfileRepository extends JpaRepository<Profile, UUID> {
    List<Profile> findByDisplayNameContainingIgnoreCaseOrUserUsernameContainingIgnoreCase(String displayName, String username);
}
