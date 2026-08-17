# ARCHITECTURE.md - SocialTush Architecture Specification

SocialTush es una plataforma social premium que integra la mensajería instantánea en tiempo real (estilo WhatsApp) con una red de publicaciones y contenido visual (estilo Instagram). Está diseñada bajo un enfoque de **Monolito Modular** y **Clean Architecture** para garantizar escalabilidad, separación de responsabilidades y facilidad de mantenimiento.

---

## 1. Stack Tecnológico

### Backend
* **Lenguaje:** Java 21 (LTS)
* **Framework:** Spring Boot 3.3+ (Spring Security, Spring Web, Spring WebFlux/WebSockets, Spring Data JPA)
* **Persistencia:** Hibernate 6.x + PostgreSQL 16+
* **Caché y Presencia:** Redis (sesiones, presencia online/offline, rate limiting)
* **Autenticación:** JWT (JSON Web Tokens) con Access Token de corta duración y Refresh Token seguro HTTP-only.
* **Almacenamiento de archivos:** Abstracción compatible con MinIO (en desarrollo) y AWS S3 / Cloudflare R2 (producción).
* **Gestor de dependencias:** Maven

### Frontend Web
* **Framework:** Next.js (App Router, React 18+, TypeScript)
* **Estilado:** Tailwind CSS + CSS Vanilla (para microinteracciones y diseño premium de alta fidelidad)
* **Estado y Tiempo Real:** Context API / Zustand + WebSocket Client
* **Diseño:** Soporte nativo de Dark Mode / Light Mode.

### Aplicación Móvil
* **Framework:** React Native + TypeScript
* **Navegación:** React Navigation
* **Persistencia Local:** MMKV / AsyncStorage para caché local y estado offline.
* **Tiempo Real:** Socket.io-client o WebSocket nativo.

### Infraestructura (Desarrollo y Orquestación)
* Docker y Docker Compose para levantar PostgreSQL, Redis, MinIO, Backend y Frontend de forma unificada.

---

## 2. Diagrama de Módulos (Modular Monolith)

El backend está estructurado como un único proyecto Java (monolito) pero segmentado en **módulos lógicos independientes** (packages independientes con acoplamiento mínimo). Cada módulo expone una interfaz clara (API interna o eventos) para interactuar con otros módulos.

```
socialtush-backend
│
├── src/main/java/com/socialtush
│   ├── SocialTushApplication.java
│   │
│   ├── modules/
│   │   ├── auth/           # Registro, Login, MFA, JWT, Refresh Tokens, Password Recovery
│   │   ├── users/          # Gestión de cuentas de usuario, estado (activo/suspendido), roles
│   │   ├── profiles/       # Perfil del usuario, biografía, foto de perfil, privacidad de cuenta
│   │   ├── social/         # Seguidores, seguidos, solicitudes de seguimiento (FollowRequest), bloqueos
│   │   ├── posts/          # Publicaciones (texto, carruseles, fotos, videos)
│   │   ├── comments/       # Comentarios en publicaciones y respuestas a comentarios
│   │   ├── likes/          # Reacciones/Likes a publicaciones y comentarios
│   │   ├── stories/        # Historias (24 horas), StoryViews, StoryReactions
│   │   ├── media/          # Procesamiento y almacenamiento multimedia (MinIO/S3), variantes (Thumb, Med, Org)
│   │   ├── chat/           # Conversaciones (1to1, grupal), Mensajes, Reacciones, Estado de lectura (Read receipts)
│   │   ├── notifications/  # Notificaciones in-app y Push (arquitectura FCM/APNs)
│   │   ├── calls/          # Control de llamadas y señalización WebRTC (preparado para LiveKit/SFU)
│   │   ├── search/         # Buscador global (usuarios, publicaciones, hashtags)
│   │   └── moderation/     # Reportes de usuarios, posts, comentarios, mensajes. Dashboard del admin.
│   │
│   └── shared/             # Excepciones globales, DTOs compartidos, configuración de seguridad, utilidades
```

---

## 3. Modelo de Datos (PostgreSQL Entity Schema)

A continuación se detalla la estructura física de la base de datos PostgreSQL, incluyendo llaves primarias (PK), foráneas (FK), restricciones únicas e índices recomendados para optimización. Todas las tablas utilizarán UUID como llave primaria para evitar exposición de IDs secuenciales y simplificar la integración móvil/offline.

### Tabla: `users`
Guarda las credenciales y datos esenciales de la cuenta.
* `id`: UUID (PK)
* `email`: VARCHAR(255) (UNIQUE, NOT NULL)
* `password_hash`: VARCHAR(255) (NOT NULL) - Hasheado con BCrypt
* `username`: VARCHAR(50) (UNIQUE, NOT NULL)
* `role`: VARCHAR(20) (NOT NULL) - 'USER', 'ADMIN', 'MODERATOR'
* `is_verified`: BOOLEAN (DEFAULT FALSE)
* `is_active`: BOOLEAN (DEFAULT TRUE)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* `updated_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Índices:* `idx_users_email`, `idx_users_username`

### Tabla: `profiles`
Detalles públicos y de personalización de cada usuario.
* `user_id`: UUID (PK, FK -> `users.id` ON DELETE CASCADE)
* `display_name`: VARCHAR(100) (NOT NULL)
* `bio`: TEXT
* `avatar_url`: VARCHAR(512)
* `is_private`: BOOLEAN (DEFAULT FALSE)
* `show_last_seen`: BOOLEAN (DEFAULT TRUE)
* `show_online_status`: BOOLEAN (DEFAULT TRUE)
* `who_can_message`: VARCHAR(20) (DEFAULT 'EVERYONE') - 'EVERYONE', 'FOLLOWERS', 'NOBODY'
* `who_can_comment`: VARCHAR(20) (DEFAULT 'EVERYONE') - 'EVERYONE', 'FOLLOWERS'
* `who_can_mention`: VARCHAR(20) (DEFAULT 'EVERYONE')
* `who_can_see_stories`: VARCHAR(20) (DEFAULT 'EVERYONE')
* `read_receipts_enabled`: BOOLEAN (DEFAULT TRUE)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* `updated_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)

### Tabla: `follows`
Relaciones de seguimiento de usuarios.
* `id`: UUID (PK)
* `follower_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `following_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Restricciones:* UNIQUE(`follower_id`, `following_id`)
* *Índices:* `idx_follows_follower`, `idx_follows_following`

### Tabla: `follow_requests`
Solicitudes de seguimiento para cuentas privadas.
* `id`: UUID (PK)
* `sender_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `receiver_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `status`: VARCHAR(20) (NOT NULL) - 'PENDING', 'ACCEPTED', 'REJECTED'
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Restricciones:* UNIQUE(`sender_id`, `receiver_id`)
* *Índices:* `idx_follow_req_receiver`

### Tabla: `posts`
Publicaciones compartidas en el feed.
* `id`: UUID (PK)
* `user_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `caption`: TEXT
* `music_url`: VARCHAR(512)
* `music_title`: VARCHAR(255)
* `location`: VARCHAR(255)
* `is_short_video`: BOOLEAN (DEFAULT FALSE) - Si es TRUE, actúa como Reel/Short Video.
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* `updated_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Índices:* `idx_posts_user_id`, `idx_posts_created_at`

### Tabla: `post_media`
Archivos multimedia asociados a un post (carrusel / una imagen o video).
* `id`: UUID (PK)
* `post_id`: UUID (FK -> `posts.id` ON DELETE CASCADE)
* `media_type`: VARCHAR(20) (NOT NULL) - 'IMAGE', 'VIDEO'
* `original_url`: VARCHAR(512) (NOT NULL)
* `medium_url`: VARCHAR(512)
* `thumbnail_url`: VARCHAR(512)
* `duration_seconds`: INTEGER - Para videos
* `display_order`: INTEGER (NOT NULL) - Orden dentro del carrusel
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Índices:* `idx_post_media_post_id`

### Tabla: `comments`
Comentarios en las publicaciones, incluyendo respuestas en hilo.
* `id`: UUID (PK)
* `post_id`: UUID (FK -> `posts.id` ON DELETE CASCADE)
* `user_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `parent_id`: UUID (FK -> `comments.id` ON DELETE CASCADE, NULLABLE) - Para respuestas
* `content`: TEXT (NOT NULL)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* `updated_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Índices:* `idx_comments_post_id`, `idx_comments_parent_id`

### Tabla: `likes`
Reacciones de "me gusta" a posts o comentarios.
* `id`: UUID (PK)
* `user_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `target_id`: UUID (NOT NULL) - Puede referenciar `post_id` o `comment_id`
* `target_type`: VARCHAR(20) (NOT NULL) - 'POST', 'COMMENT'
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Restricciones:* UNIQUE(`user_id`, `target_id`, `target_type`)
* *Índices:* `idx_likes_target`

### Tabla: `saved_posts`
Publicaciones guardadas por un usuario de forma privada.
* `id`: UUID (PK)
* `user_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `post_id`: UUID (FK -> `posts.id` ON DELETE CASCADE)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Restricciones:* UNIQUE(`user_id`, `post_id`)
* *Índices:* `idx_saved_posts_user`

### Tabla: `stories`
Historias temporales de 24 horas.
* `id`: UUID (PK)
* `user_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `media_type`: VARCHAR(20) (NOT NULL) - 'IMAGE', 'VIDEO', 'TEXT'
* `media_url`: VARCHAR(512)
* `text_content`: TEXT
* `background_color`: VARCHAR(7) - Hex para historias de texto
* `music_url`: VARCHAR(512)
* `music_title`: VARCHAR(255)
* `is_best_friends`: BOOLEAN (DEFAULT FALSE)
* `expires_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Índices:* `idx_stories_user_expires`, `idx_stories_expires_at`

### Tabla: `story_views`
Registro de quién ha visto cada historia.
* `id`: UUID (PK)
* `story_id`: UUID (FK -> `stories.id` ON DELETE CASCADE)
* `user_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Restricciones:* UNIQUE(`story_id`, `user_id`)

### Tabla: `story_reactions`
Reacciones de emojis o likes a historias.
* `id`: UUID (PK)
* `story_id`: UUID (FK -> `stories.id` ON DELETE CASCADE)
* `user_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `reaction_type`: VARCHAR(50) (NOT NULL) - 'LIKE', 'EMOJI_CLAP', etc.
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)

### Tabla: `conversations`
Entidad de chat grupal o privado.
* `id`: UUID (PK)
* `name`: VARCHAR(100) - NULL para chats privados (1to1)
* `avatar_url`: VARCHAR(512)
* `is_group`: BOOLEAN (DEFAULT FALSE)
* `created_by`: UUID (FK -> `users.id` ON DELETE SET NULL)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* `updated_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)

### Tabla: `conversation_participants`
Mapeo de usuarios dentro de un chat.
* `id`: UUID (PK)
* `conversation_id`: UUID (FK -> `conversations.id` ON DELETE CASCADE)
* `user_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `role`: VARCHAR(20) (DEFAULT 'MEMBER') - 'MEMBER', 'ADMIN'
* `joined_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* `last_read_message_id`: UUID - Para verificar estados de lectura
* *Restricciones:* UNIQUE(`conversation_id`, `user_id`)
* *Índices:* `idx_conv_part_user`, `idx_conv_part_conv`

### Tabla: `messages`
Mensajes dentro de las conversaciones.
* `id`: UUID (PK)
* `conversation_id`: UUID (FK -> `conversations.id` ON DELETE CASCADE)
* `sender_id`: UUID (FK -> `users.id` ON DELETE SET NULL)
* `parent_id`: UUID (FK -> `messages.id` ON DELETE SET NULL, NULLABLE) - Para respuestas directas
* `content`: TEXT
* `message_type`: VARCHAR(20) (NOT NULL) - 'TEXT', 'MEDIA', 'STORY_REPLY', 'POST_SHARE', 'CALL_LOG'
* `is_edited`: BOOLEAN (DEFAULT FALSE)
* `is_deleted`: BOOLEAN (DEFAULT FALSE)
* `story_preview_id`: UUID (FK -> `stories.id` ON DELETE SET NULL, NULLABLE)
* `post_share_id`: UUID (FK -> `posts.id` ON DELETE SET NULL, NULLABLE)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* `updated_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Índices:* `idx_messages_conversation`, `idx_messages_created_at`

### Tabla: `message_attachments`
Archivos adjuntos en un mensaje (fotos, audios, videos, documentos, stickers).
* `id`: UUID (PK)
* `message_id`: UUID (FK -> `messages.id` ON DELETE CASCADE)
* `file_url`: VARCHAR(512) (NOT NULL)
* `file_type`: VARCHAR(50) (NOT NULL) - 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER', 'GIF'
* `file_name`: VARCHAR(255)
* `file_size`: BIGINT
* `duration_seconds`: INTEGER - Para notas de voz/videos
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)

### Tabla: `message_reactions`
Reacciones de emojis a mensajes específicos.
* `id`: UUID (PK)
* `message_id`: UUID (FK -> `messages.id` ON DELETE CASCADE)
* `user_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `emoji`: VARCHAR(10) (NOT NULL)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Restricciones:* UNIQUE(`message_id`, `user_id`)

### Tabla: `notifications`
Notificaciones del sistema para actividades sociales.
* `id`: UUID (PK)
* `receiver_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `sender_id`: UUID (FK -> `users.id` ON DELETE SET NULL)
* `notification_type`: VARCHAR(50) (NOT NULL) - 'FOLLOW', 'COMMENT', 'LIKE_POST', 'LIKE_COMMENT', 'STORY_REPLY', 'FOLLOW_REQUEST'
* `target_id`: UUID - ID de la entidad relacionada (post, story, comment, etc.)
* `is_read`: BOOLEAN (DEFAULT FALSE)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Índices:* `idx_notifications_receiver`, `idx_notifications_is_read`

### Tabla: `devices`
Dispositivos registrados para notificaciones push (tokens FCM o APNs).
* `id`: UUID (PK)
* `user_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `token`: VARCHAR(512) (UNIQUE, NOT NULL)
* `platform`: VARCHAR(10) (NOT NULL) - 'ANDROID', 'IOS', 'WEB'
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* `updated_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)

### Tabla: `refresh_tokens`
Gestión segura de rotación de tokens de actualización.
* `id`: UUID (PK)
* `user_id`: UUID (FK -> `users.id` ON DELETE CASCADE)
* `token`: VARCHAR(512) (UNIQUE, NOT NULL)
* `expires_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* `is_revoked`: BOOLEAN (DEFAULT FALSE)
* `created_at`: TIMESTAMP (WITH TIME ZONE, NOT NULL)
* *Índices:* `idx_refresh_tokens_token`

### Tablas complementarias de Moderación: `blocks` y `reports`
* **`blocks`**: `id` (UUID), `blocker_id` (FK -> user), `blocked_id` (FK -> user), `created_at` (TIMESTAMP). UNIQUE(`blocker_id`, `blocked_id`).
* **`reports`**: `id` (UUID), `reporter_id` (FK -> user), `target_id` (UUID), `target_type` (VARCHAR - 'USER','POST','COMMENT','MESSAGE'), `reason` (VARCHAR), `status` (VARCHAR - 'PENDING','RESOLVED','DISMISSED'), `created_at` (TIMESTAMP).

---

## 4. Flujo de Autenticación y Sesión

1. **Registro:** El usuario envía email, username, contraseña y display name. La contraseña se hashea con BCrypt. Se crea un usuario inactivo y se genera un token de verificación de correo.
2. **Login:** El usuario envía credenciales. Si son correctas, el backend responde con un **JWT Access Token** (tiempo de vida corto, ej. 15 minutos) en el body de la respuesta y almacena un **Refresh Token** (tiempo de vida largo, ej. 7 días) en una cookie de tipo HTTP-Only, Secure, y SameSite=Strict. El Refresh Token se registra en la base de datos para habilitar rotación de tokens y revocación inmediata.
3. **Mantenimiento de sesión:** Cuando el Access Token expira, el cliente web o móvil realiza un POST a `/api/v1/auth/refresh`. El backend valida el Refresh Token de la cookie/storage, invalida el token viejo, emite un nuevo Refresh Token y un nuevo Access Token.

---

## 5. Arquitectura del Chat en Tiempo Real y WebSockets

### Conexión y Autenticación
* El cliente abre una conexión WebSocket con la URL `ws://api.socialtush.com/ws/chat`.
* La autenticación inicial se realiza pasando el JWT Access Token en un query parameter o en un header en el handshake HTTP.
* Si el token es inválido o expira durante el handshake, el backend cierra la conexión con el código 4001 (Unauthorized).

### Gestión de Estados con Redis
* **Presencia Online/Offline:** Al conectar el WebSocket, se registra en Redis una clave temporal `user:online:{userId}` con un TTL corto. El backend publica a través de Redis Pub/Sub que el usuario está online a todos sus seguidores con chats activos.
* **Latido (Heartbeat / Ping-Pong):** El frontend envía periódicamente un mensaje de `ping` cada 30 segundos. El backend responde con `pong` y renueva el TTL de la presencia en Redis. Si no recibe un ping tras 60 segundos, asume desconexión y limpia el estado de presencia.
* **Indicadores en Tiempo Real:** 
  * *"Escribiendo / Grabando audio":* Mensajes rápidos a través del WebSocket directos al destinatario, no persistidos en PostgreSQL, solo propagados al vuelo.
  * *"Read Receipts" (Confirmación de lectura):* Al abrir un chat, el cliente envía un evento `READ_MESSAGES` con el `conversationId` y el ID del último mensaje visto. El backend actualiza `conversation_participants.last_read_message_id` en PostgreSQL y emite un evento WebSocket al remitente original.

---

## 6. Gestión de Archivos Multimedia (Media Abstraction)

Para evitar acoplamiento con un proveedor de almacenamiento de archivos en particular, se crea una interfaz genérica `StorageService` en el módulo de media:

```java
public interface StorageService {
    String uploadFile(String bucketName, String path, byte[] content, String contentType);
    void deleteFile(String bucketName, String path);
    String getPresignedUrl(String bucketName, String path, int expirationMinutes);
}
```

### Implementaciones:
* **MinioStorageService:** Utiliza el SDK de MinIO. Se comunica localmente en el docker-compose.
* **S3StorageService / R2StorageService:** Configurable mediante propiedades para producción apuntando a AWS S3 o Cloudflare R2 sin cambiar una sola línea de código en los controladores o servicios de negocio.

### Variante de imágenes:
Al subir una imagen de perfil, publicación o historia, el backend (o un worker interno en el módulo `media` usando librerías como Thumbnailator) genera tres versiones:
1. `original`: Resolución subida, optimizada en tamaño.
2. `medium`: Escalado a ~1080px de ancho.
3. `thumbnail`: Escalado a ~200px de ancho (ideal para avatares y miniaturas del feed).

Para videos cortos, se extrae el primer frame como thumbnail y se leen los metadatos de duración y dimensiones usando librerías de Java que no requieren FFmpeg nativo, dejando la puerta abierta para integrar FFmpeg vía comando o subproceso para transcodificación adaptativa en el futuro.

---

## 7. Mecanismos de Seguridad y Privacidad

1. **Autorización estricta de acceso a datos:**
   * Al consultar publicaciones, historias o detalles de un perfil, el backend valida el estado de la cuenta del creador.
   * Si la cuenta es privada (`profile.is_private = true`), el backend verifica si el usuario solicitante es un seguidor activo en la tabla `follows`. De lo contrario, retorna un error `403 Forbidden`.
   * Para acceder a un chat o sus mensajes, el backend valida que el `userId` autenticado esté presente como registro activo en `conversation_participants`.
2. **Rate Limiting:**
   * Protecciones en endpoints sensibles (ej: `/api/v1/auth/login`, `/api/v1/posts`) implementadas mediante interceptores de Spring acoplados a un contador en Redis (algoritmo Token Bucket) para bloquear ataques de fuerza bruta y denegación de servicio.
3. **UUIDs de seguridad:**
   * Todos los recursos multimedia expuestos al público se renombran con un UUID generado aleatoriamente en el backend antes de ser guardados en MinIO/S3 para evitar ataques de enumeración de ID y robo de archivos.
