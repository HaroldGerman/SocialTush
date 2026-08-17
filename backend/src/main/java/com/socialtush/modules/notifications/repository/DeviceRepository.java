package com.socialtush.modules.notifications.repository;

import com.socialtush.modules.notifications.entity.Device;
import com.socialtush.modules.users.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DeviceRepository extends JpaRepository<Device, UUID> {
    Optional<Device> findByToken(String token);
    List<Device> findByUser(User user);
}
