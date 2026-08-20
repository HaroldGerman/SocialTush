package com.socialtush.shared.config;

import com.socialtush.modules.circles.repository.CircleRepository;
import com.socialtush.modules.circles.service.CircleService;
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
    private final CircleRepository circleRepository;
    private final CircleService circleService;
    private final PasswordEncoder passwordEncoder;

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void run(String... args) {
        User adminUser = null;
        if (userRepository.count() == 0) {
            log.info("Sembrando usuarios por defecto en la base de datos vacía...");

            // 1. Create usuario_A
            createUserWithProfile("usuario_A", "usuario_a@socialtush.com", "password123", "Usuario A", "USER");

            // 2. Create alex_futurist
            createUserWithProfile("alex_futurist", "alex@socialtush.com", "password123", "Alex Futurist", "USER");

            // 3. Create sophia
            createUserWithProfile("sophia", "sophia@socialtush.com", "password123", "Sophia Loren", "USER");

            // 4. Create admin
            adminUser = createUserWithProfile("admin", "admin@socialtush.com", "admin123", "Administrador", "ADMIN");

            log.info("Usuarios por defecto sembrados exitosamente.");
        } else {
            adminUser = userRepository.findByUsername("admin").orElse(null);
        }

        if (circleRepository.count() == 0 && adminUser != null) {
            log.info("Sembrando círculos iniciales en la base de datos...");
            circleService.createCircle("Exploradores Urbanos", "Amantes de las caminatas, arquitectura y rincones escondidos de la ciudad.", "PUBLIC", "LOCAL", "Lima", "Perú", adminUser);
            circleService.createCircle("Sostenibles & Eco", "Comunidad orientada al reciclaje, energía limpia y hábitos sostenibles.", "PUBLIC", "GENERAL", null, null, adminUser);
            circleService.createCircle("Café & Ideas", "Espacio para compartir lecturas, debates de café y proyectos colaborativos.", "PUBLIC", "GENERAL", null, null, adminUser);
            circleService.createCircle("Developers Perú", "Comunidad de desarrollo de software, arquitectura limpia e inteligencia artificial.", "PUBLIC", "TECH", "Lima", "Perú", adminUser);
            log.info("Círculos iniciales sembrados exitosamente.");
        }
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
