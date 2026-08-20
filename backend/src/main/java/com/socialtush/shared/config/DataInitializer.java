package com.socialtush.shared.config;

import com.socialtush.modules.profiles.entity.Profile;
import com.socialtush.modules.profiles.repository.ProfileRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ProfileRepository profileRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void run(String... args) {
        String username = environment("INITIAL_ADMIN_USERNAME");
        String email = environment("INITIAL_ADMIN_EMAIL");
        String password = environment("INITIAL_ADMIN_PASSWORD");
        if (username == null || email == null || password == null) {
            log.info("Bootstrap de administrador omitido: INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_EMAIL e INITIAL_ADMIN_PASSWORD no están configuradas.");
            return;
        }
        if (userRepository.existsByUsernameIgnoreCase(username) || userRepository.existsByEmailIgnoreCase(email)) {
            log.info("Bootstrap de administrador omitido: la cuenta inicial ya existe.");
            return;
        }
        createUserWithProfile(username, email, password, "Administrador", "ADMIN");
        log.info("Cuenta administrativa inicial creada correctamente.");
    }

    private String environment(String name) {
        String value = System.getenv(name);
        return value == null || value.isBlank() ? null : value.trim();
    }

    private User createUserWithProfile(String username, String email, String password, String displayName, String role) {
        User user = User.builder()
                .username(username)
                .email(email)
                .passwordHash(passwordEncoder.encode(password))
                .role(role)
                .isVerified(true)
                .isActive(true)
                .build();
        user = userRepository.save(user);

        Profile profile = Profile.builder()
                .user(user)
                .displayName(displayName)
                .bio("¡Hola! Soy " + displayName + " en Lifonk 🚀")
                .isPrivate(false)
                .build();
        profileRepository.save(profile);
        return user;
    }
}
