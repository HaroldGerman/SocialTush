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

    // Dos contribuciones por cada uno de los 12 temas oficiales de Descubrir.
    private static final List<DiscoveryContribution> CONTRIBUTIONS = List.of(
            new DiscoveryContribution("tecnologia", 0, "Tecnología", "La IA ya vive en cosas cotidianas", "Desde el teclado predictivo hasta la cámara del celular, muchos sistemas usan modelos que aprenden patrones para ayudarnos sin que siempre lo notemos.", "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("tecnologia", 1, "Tecnología", "La nube también está hecha de máquinas reales", "Cada foto, mensaje o archivo que guardamos en la nube termina viviendo en centros de datos con servidores, redes, energía y sistemas de respaldo físicos.", "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=82"),

            new DiscoveryContribution("gaming", 0, "Gaming", "Un buen juego te enseña sin darte una clase", "Los mejores tutoriales suelen esconderse en el diseño: una puerta, una luz o un sonido pueden enseñarte qué hacer antes de que aparezca una sola palabra.", "https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("gaming", 1, "Gaming", "Los eSports también se ganan fuera de la partida", "Preparación mental, análisis de rivales, comunicación y descanso influyen tanto como la mecánica cuando una partida se decide por segundos.", "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=82"),

            new DiscoveryContribution("musica", 0, "Música", "Tu canción favorita también es matemática", "Ritmo, repetición, frecuencia y proporción aparecen en casi toda la música. La emoción y la estructura pueden convivir en el mismo compás.", "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("musica", 1, "Música", "Una pausa también puede ser parte de la melodía", "El silencio crea tensión, descanso y expectativa. A veces lo que una canción no toca es exactamente lo que hace que el siguiente sonido importe más.", "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1200&q=82"),

            new DiscoveryContribution("anime", 0, "Anime & Manga", "Una escena puede contar más con el fondo que con el diálogo", "Color, encuadre, clima y arquitectura ayudan a contar emociones incluso cuando los personajes no dicen nada. Ahí también vive parte de la narrativa.", "https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("anime", 1, "Anime & Manga", "El manga controla el tiempo con viñetas", "Una página puede acelerar una pelea o detener un instante usando tamaño, espacio y distribución de paneles. Leer también es recorrer ritmo visual.", "https://images.unsplash.com/photo-1614583225154-5fcdda07019e?auto=format&fit=crop&w=1200&q=82"),

            new DiscoveryContribution("fotografia", 0, "Fotografía", "La mejor cámara también depende de dónde te colocas", "Moverte unos pasos cambia perspectiva, luz y fondo. Muchas veces una foto mejora más al cambiar de posición que al cambiar de equipo.", "https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("fotografia", 1, "Fotografía", "La luz suave puede convertir una foto simple en una gran foto", "Ventanas, nubes y sombras abiertas crean transiciones suaves que suelen favorecer retratos y escenas cotidianas sin necesidad de un estudio.", "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82"),

            new DiscoveryContribution("ciencia", 0, "Ciencia", "Mirar una estrella es mirar hacia atrás", "La luz necesita tiempo para viajar. Eso significa que cada estrella que vemos nos muestra cómo era en un momento anterior de la historia del universo.", "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("ciencia", 1, "Ciencia", "Tu cuerpo también es un ecosistema", "Millones de microorganismos viven con nosotros y participan en procesos relacionados con digestión, defensa y equilibrio interno.", "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&q=82"),

            new DiscoveryContribution("viajes", 0, "Viajes", "A veces el mejor recuerdo no estaba en el itinerario", "Perderse unas calles, probar algo local o conversar con alguien del lugar puede terminar siendo más memorable que la atracción que habías planeado visitar.", "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("viajes", 1, "Viajes", "Viajar ligero cambia la forma de moverte", "Menos equipaje significa más libertad para caminar, cambiar de ruta y usar transporte local. Elegir qué no llevar también forma parte del viaje.", "https://images.unsplash.com/photo-1503220317375-aaad61436b1b?auto=format&fit=crop&w=1200&q=82"),

            new DiscoveryContribution("fitness", 0, "Fitness & Bienestar", "La constancia suele ganar a la rutina perfecta", "Un plan sencillo que puedes repetir durante meses suele aportar más que una rutina extrema que abandonas en una semana.", "https://images.unsplash.com/photo-1538805060514-97d9cc17730c?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("fitness", 1, "Fitness & Bienestar", "Descansar también forma parte del entrenamiento", "El cuerpo necesita recuperar energía y reparar tejidos. Dormir y programar descansos no es hacer menos: es parte del proceso.", "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=82"),

            new DiscoveryContribution("arte", 0, "Arte & Diseño", "El espacio vacío también diseña", "En una interfaz, una portada o una ilustración, el espacio alrededor de los elementos ayuda a crear jerarquía, claridad y respiración visual.", "https://images.unsplash.com/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("arte", 1, "Arte & Diseño", "El color cambia según lo que tiene al lado", "Una misma tonalidad puede sentirse más cálida, fría, brillante o apagada dependiendo de los colores que la rodean.", "https://images.unsplash.com/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=1200&q=82"),

            new DiscoveryContribution("programacion", 0, "Programación", "Los sistemas grandes empiezan con piezas pequeñas", "Funciones, clases y servicios simples se combinan hasta formar aplicaciones enormes. La complejidad suele crecer capa por capa.", "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("programacion", 1, "Programación", "Leer código es una habilidad distinta a escribirlo", "Entender proyectos ajenos, seguir el flujo de datos y encontrar responsabilidades es una de las prácticas que más acelera el crecimiento como desarrollador.", "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1200&q=82"),

            new DiscoveryContribution("cine", 0, "Cine & Series", "La cámara también puede actuar", "Un plano cerrado puede hacerte sentir atrapado; uno abierto puede mostrar soledad o libertad. El encuadre cuenta parte de la historia sin hablar.", "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("cine", 1, "Cine & Series", "El sonido puede cambiar por completo una escena", "La misma imagen puede sentirse divertida, tensa o triste solo cambiando música, ambiente y silencios. El audio también dirige la emoción.", "https://images.unsplash.com/photo-1485846234645-a62644f84728?auto=format&fit=crop&w=1200&q=82"),

            new DiscoveryContribution("naturaleza", 0, "Naturaleza", "Un bosque también funciona como una red", "Raíces, hongos, agua y nutrientes forman relaciones complejas bajo el suelo. Lo que vemos en la superficie es solo una parte del sistema.", "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=82"),
            new DiscoveryContribution("naturaleza", 1, "Naturaleza", "Un paisaje nunca está completamente quieto", "Viento, agua, temperatura y vida cambian poco a poco montañas, costas, bosques y desiertos aunque nuestros ojos no alcancen a verlo en un instante.", "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1200&q=82")
    );

    private final UserRepository userRepository;
    private final PostRepository postRepository;

    // 10:15 y 19:15 (hora de Lima): 12 publicaciones por tanda, una por cada tema.
    @Scheduled(cron = "0 15 10,19 * * *", zone = "America/Lima")
    @Transactional
    public void publishDailyContributions() {
        User official = userRepository.findByUsernameIgnoreCase(USERNAME).orElse(null);
        if (official == null) {
            log.warn("Lifonk Descubre todavía no existe; se omitieron las contribuciones programadas.");
            return;
        }

        LocalDate today = LocalDate.now(LIMA);
        Instant dayStart = today.atStartOfDay(LIMA).toInstant();
        Instant dayEnd = today.plusDays(1).atStartOfDay(LIMA).toInstant();
        List<Post> publishedToday = postRepository.findByUserAndCreatedAtBetweenOrderByCreatedAtAsc(official, dayStart, dayEnd);

        int slot = java.time.ZonedDateTime.now(LIMA).getHour() >= 19 ? 1 : 0;
        int published = 0;

        for (DiscoveryContribution contribution : CONTRIBUTIONS) {
            if (contribution.slot() != slot) continue;
            String marker = marker(contribution, slot);
            boolean alreadyPublished = publishedToday.stream()
                    .map(Post::getCaption)
                    .filter(java.util.Objects::nonNull)
                    .anyMatch(caption -> caption.contains(marker));
            if (alreadyPublished) continue;

            Post post = Post.builder()
                    .user(official)
                    .caption(contribution.title() + "\n\n" + contribution.caption() + "\n\n" + marker)
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
            published++;
        }

        log.info("Lifonk Descubre publicó {} contribuciones de la tanda {} para {}.", published, slot + 1, today);
    }

    private String marker(DiscoveryContribution contribution, int slot) {
        return "#Descubre" + contribution.slug().substring(0, 1).toUpperCase() + contribution.slug().substring(1)
                + (slot == 0 ? " #LifonkAM" : " #LifonkPM");
    }

    private record DiscoveryContribution(String slug, int slot, String topic, String title, String caption, String imageUrl) {}
}
