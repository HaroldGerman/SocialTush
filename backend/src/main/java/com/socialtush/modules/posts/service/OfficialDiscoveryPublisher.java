package com.socialtush.modules.posts.service;

import com.socialtush.modules.posts.entity.Post;
import com.socialtush.modules.posts.entity.PostMedia;
import com.socialtush.modules.posts.repository.PostRepository;
import com.socialtush.modules.users.entity.User;
import com.socialtush.modules.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class OfficialDiscoveryPublisher {

    private static final String USERNAME = "lifonk-descubre";
    private static final ZoneId LIMA = ZoneId.of("America/Lima");

    private static final List<DiscoveryContribution> CONTRIBUTIONS = List.of(
            new DiscoveryContribution("Hay lugares que parecen inventados", "Montañas, niebla y silencio. A veces descubrir también es detenerse un momento y mirar.", "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("El desierto también guarda ritmo", "Las dunas cambian lentamente con el viento: un paisaje puede estar vivo aunque parezca inmóvil.", "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Un minuto de bosque", "Los ecosistemas forestales conectan raíces, hongos, agua y nutrientes en redes mucho más complejas de lo que vemos.", "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("La naturaleza también construye redes", "Un bosque no es una colección de árboles aislados. Bajo el suelo existen relaciones que intercambian nutrientes y señales.", "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Cambiar de perspectiva cambia el lugar", "El mismo paisaje puede sentirse completamente distinto con otra luz, otra estación o simplemente unos minutos de distancia.", "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("El viento escribe sobre la tierra", "En zonas áridas, el viento puede desplazar granos durante kilómetros y redibujar dunas enteras con el tiempo.", "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=82")
    );

    private final UserRepository userRepository;
    private final PostRepository postRepository;

    @Scheduled(cron = "0 15 10,19 * * *", zone = "America/Lima")
    @Transactional
    public void publishDailyContribution() {
        User official = userRepository.findByUsernameIgnoreCase(USERNAME).orElse(null);
        if (official == null) {
            log.warn("Lifonk Descubre todavía no existe; se omitió la contribución programada.");
            return;
        }

        LocalDate today = LocalDate.now(LIMA);
        Instant dayStart = today.atStartOfDay(LIMA).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(LIMA).toInstant();
        long publishedToday = postRepository.countByUserAndCreatedAtBetween(official, dayStart, dayEnd);
        if (publishedToday >= 2) return;

        int index = Math.floorMod((int) (today.toEpochDay() * 2 + publishedToday), CONTRIBUTIONS.size());
        DiscoveryContribution contribution = CONTRIBUTIONS.get(index);

        Post post = Post.builder()
                .user(official)
                .caption(contribution.title() + "\n\n" + contribution.caption())
                .isShortVideo(false)
                .build();
        PostMedia media = PostMedia.builder()
                .post(post)
                .mediaType("IMAGE")
                .originalUrl(contribution.imageUrl())
                .mediumUrl(contribution.imageUrl())
                .thumbnailUrl(contribution.imageUrl())
                .displayOrder(0)
                .build();
        post.getMediaList().add(media);
        postRepository.save(post);
        log.info("Lifonk Descubre publicó la contribución {} del día {}.", publishedToday + 1, today);
    }

    private record DiscoveryContribution(String title, String caption, String imageUrl) {}
}
