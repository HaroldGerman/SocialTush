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
            new DiscoveryContribution("Naturaleza", "Hay lugares que parecen inventados", "Montañas, niebla y silencio. A veces descubrir también es detenerse un momento y mirar.", "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Astronomía", "Mirar al cielo también es mirar al pasado", "La luz de muchas estrellas tarda años en llegar hasta nosotros. Cuando observamos el cielo nocturno, vemos distintos momentos de la historia del universo.", "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Tecnología", "Internet también tiene una geografía", "Gran parte del tráfico mundial viaja por cables submarinos que conectan continentes bajo los océanos. La nube también depende de infraestructura física.", "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Historia", "Las bibliotecas son máquinas del tiempo", "Un libro puede conservar ideas durante siglos. Las bibliotecas no solo almacenan páginas: también guardan versiones de cómo una sociedad entendía su mundo.", "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Ciencia", "Lo invisible también construye el mundo", "Átomos, microorganismos y campos magnéticos no se ven a simple vista, pero participan constantemente en lo que ocurre a nuestro alrededor.", "https://images.unsplash.com/photo-1507413245164-6160d8298b31?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Geografía", "El desierto también guarda ritmo", "Las dunas cambian lentamente con el viento: un paisaje puede estar vivo aunque parezca inmóvil.", "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Programación", "Un pequeño programa puede mover sistemas enormes", "Las aplicaciones que usamos cada día nacen de instrucciones simples organizadas en muchas capas. La complejidad suele construirse paso a paso.", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Psicología", "La memoria no funciona como una grabación", "Recordar es reconstruir. Nuestro cerebro combina detalles, contexto y emociones cada vez que recuperamos una experiencia.", "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Naturaleza", "Un minuto de bosque", "Los ecosistemas forestales conectan raíces, hongos, agua y nutrientes en redes mucho más complejas de lo que vemos.", "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Idiomas", "Cada idioma organiza el mundo de otra manera", "Aprender otra lengua no es solo memorizar palabras: también es descubrir nuevas formas de ordenar ideas, tiempo, relaciones y experiencias.", "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Arte", "El color nunca está completamente solo", "La percepción de un color cambia según lo que lo rodea. Por eso una misma tonalidad puede sentirse más cálida, fría, intensa o apagada dependiendo del contexto.", "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Arquitectura", "Las ciudades cuentan historias sin hablar", "Calles, plazas y edificios revelan decisiones de distintas épocas. Una ciudad puede leerse como un archivo construido capa por capa.", "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Océanos", "La mayor parte del océano sigue siendo desconocida", "Aunque cubre la mayor parte del planeta, enormes zonas del fondo marino todavía no han sido observadas directamente con gran detalle.", "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Música", "El ritmo puede cambiar cómo sentimos el tiempo", "Una canción rápida puede hacer que unos minutos parezcan pasar distinto. El cerebro usa patrones y expectativas para anticipar lo que viene.", "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Historia", "Los mapas también reflejan poder", "Un mapa no solo representa territorio: también decide qué mostrar, qué nombrar y desde qué perspectiva mirar el mundo.", "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Biología", "Tu cuerpo es también un ecosistema", "Millones de microorganismos viven en distintas partes del cuerpo humano y participan en procesos relacionados con digestión, defensa y equilibrio interno.", "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Espacio", "En el espacio no hay un arriba universal", "Arriba y abajo dependen del punto de referencia y de la gravedad cercana. Fuera de la Tierra, esas direcciones dejan de ser absolutas.", "https://images.unsplash.com/photo-1454789548928-9efd52dc4031?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Economía", "El valor también depende de la confianza", "Dinero, mercados y contratos funcionan porque muchas personas aceptan reglas y expectativas compartidas. La confianza es parte de la infraestructura económica.", "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Ingeniería", "Los puentes trabajan incluso cuando parecen quietos", "Una estructura distribuye fuerzas continuamente. El diseño busca que peso, movimiento, viento y materiales encuentren un equilibrio seguro.", "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("Naturaleza", "La naturaleza también construye redes", "Un bosque no es una colección de árboles aislados. Bajo el suelo existen relaciones que intercambian nutrientes y señales.", "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=82")
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
        log.info("Lifonk Descubre publicó {}: {} ({} del día {}).", contribution.topic(), contribution.title(), publishedToday + 1, today);
    }

    private record DiscoveryContribution(String topic, String title, String caption, String imageUrl) {}
}
