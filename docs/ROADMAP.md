# ROADMAP.md - Plan de Desarrollo de SocialTush

Este documento detalla las fases progresivas de desarrollo de la plataforma SocialTush. Cada fase debe culminar con un estado completamente funcional y testeable (end-to-end), asegurando que los cambios no rompan la estabilidad general de la aplicación.

---

## FASE 1: Infraestructura y Estructura Inicial
* **Objetivo:** Definir el monorepo y la infraestructura de desarrollo base.
* **Backend:**
  * Crear la estructura de directorios Maven para Spring Boot 3.x con Java 21.
  * Configurar dependencias principales (Security, Web, JPA, Postgres, Redis, WebSockets, Lombok).
  * Crear controlador de estado de salud (health check).
* **Frontend Web:**
  * Crear la aplicación Next.js (TypeScript, Tailwind CSS).
  * Configurar enrutado de páginas básico.
* **Aplicación Móvil:**
  * Inicializar estructura de React Native con TypeScript.
* **DevOps:**
  * Escribir `docker-compose.yml` base para levantar PostgreSQL, Redis, MinIO y configurar la red de comunicación.
  * Crear archivo `.env.example` con las variables de entorno recomendadas.
* **Definición de Terminado (DoD):** El docker-compose levanta todas las bases de datos correctamente, el backend y el frontend inician y se comunican a nivel de red básica.

## FASE 2: Usuarios y Autenticación
* **Objetivo:** Registrar usuarios, autenticar de forma segura (JWT) e implementar sesión persistente.
* **Backend:**
  * Crear entidad `User`, repositorio, DTOs y validadores.
  * Configurar Spring Security y BCrypt para contraseñas.
  * Implementar endpoints: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout`.
  * Configurar tabla de `refresh_tokens` para rotación y revocación segura de tokens.
* **Frontend/Mobile:**
  * Crear pantallas de Registro y Login con diseño premium (Light/Dark mode).
  * Configurar interceptor HTTP en Axios/Fetch para adjuntar JWT y refrescar sesión automáticamente.
* **Definición de Terminado (DoD):** Registro y login funcionando end-to-end con token JWT guardado de forma segura en cookies HTTP-only (web) y secure storage (móvil).

## FASE 3: Perfiles y Seguidores
* **Objetivo:** Permitir a los usuarios editar su biografía, avatares, cambiar la privacidad de su cuenta y seguir a otros usuarios.
* **Backend:**
  * Entidades `Profile`, `Follow`, y `FollowRequest`.
  * Lógica para seguir/dejar de seguir y bloquear a un usuario.
  * Lógica de solicitudes de seguimiento para cuentas privadas (aceptar/rechazar).
* **Frontend/Mobile:**
  * Pantalla de perfil con pestañas, número de seguidores/seguidos.
  * Pantalla de editar perfil (nombre, username, bio, privacidad, avatar).
* **Definición de Terminado (DoD):** Perfiles públicos y privados configurables. Solicitudes de seguimiento funcionando con notificaciones internas y validaciones de seguridad estrictas.

## FASE 4: Publicaciones (Posts), Comentarios y Likes
* **Objetivo:** Crear publicaciones individuales o con carrusel de imágenes, dar likes y comentar.
* **Backend:**
  * Entidades `Post`, `PostMedia`, `Comment`, `Like` y `SavedPost`.
  * Integrar almacenamiento multimedia con MinIO (variantes thumbnail/medium).
  * Implementar feed principal con scroll infinito (paginación ordenada por relevancia inicial: personas que sigues + contenido reciente).
* **Frontend/Mobile:**
  * Creación de posts (subida de imágenes al MinIO local).
  * Pantalla del feed principal premium y responsive con interacción visual al dar doble tap (like) y modal de comentarios en tiempo real.
* **Definición de Terminado (DoD):** Subida de posts y visualización en el feed. Likes y comentarios en tiempo real funcionales con base de datos PostgreSQL sincronizada.

## FASE 5: Historias (Stories)
* **Objetivo:** Publicar imágenes, videos o textos que expiran automáticamente a las 24 horas.
* **Backend:**
  * Entidad `Story`, `StoryView` y `StoryReaction`.
  * Lógica para filtrar historias no expiradas y exclusión de cuentas silenciadas o mejores amigos.
  * Tarea programada (Spring Scheduled) para limpiar/marcar expiración de historias.
* **Frontend/Mobile:**
  * Visor de historias fullscreen con indicador de progreso superior y controles táctiles (pulsar para pausar, tocar lados para avanzar/retroceder, deslizar hacia abajo para salir).
* **Definición de Terminado (DoD):** Historias cargadas, ordenadas y renderizadas correctamente. Las visualizaciones se registran y las historias expiran tras 24 horas.

## FASE 6: Chat Privado
* **Objetivo:** Mensajería uno a uno rápida en tiempo real utilizando WebSockets.
* **Backend:**
  * Entidades `Conversation`, `ConversationParticipant`, `Message`, `MessageAttachment` y `MessageReaction`.
  * Configuración del broker de WebSockets y suscripción de canales de usuario privados.
  * Integración de Redis para estado online/offline y escritura ("typing...").
* **Frontend/Mobile:**
  * Vista de listado de chats abiertos.
  * Pantalla de chat privada interactiva, scroll inverso virtualizado, subida de archivos (fotos, notas de voz).
  * Manejo del estado offline (cola de reintento local y visualización de mensajes enviados pendientes).
* **Definición de Terminado (DoD):** Mensajes instantáneos en tiempo real que se persisten y se actualizan al instante en el receptor y emisor.

## FASE 7: Chat Grupal
* **Objetivo:** Conversaciones de grupo con múltiples participantes y roles de administrador.
* **Backend:**
  * Extensiones a `Conversation` y `Message` para gestionar grupos.
  * API para crear grupo, añadir participantes, cambiar avatar de grupo y asignar administradores.
* **Frontend/Mobile:**
  * Pantalla de creación de grupos y gestión de miembros.
  * Modificaciones en el chat para mostrar el nombre del remitente sobre cada burbuja de mensaje.
* **Definición de Terminado (DoD):** Creación y conversación en grupos funcionando perfectamente en tiempo real.

## FASE 8: Notificaciones
* **Objetivo:** Informar a los usuarios de actividades relevantes (Likes, comentarios, nuevos seguidores, mensajes).
* **Backend:**
  * Entidades `Notification` y `Device`.
  * Conector WebSocket para notificaciones en vivo dentro de la aplicación.
  * Configuración base de Firebase Cloud Messaging (FCM) y APNs para Push Notifications en segundo plano.
* **Frontend/Mobile:**
  * Centro de notificaciones interactivo.
  * Integración con notificaciones del sistema en móvil (Push) y web (Service Worker).
* **Definición de Terminado (DoD):** Toda interacción social genera una notificación instantánea in-app. Las notificaciones push se activan correctamente en emuladores/dispositivos móviles.

## FASE 9: Videos Cortos (Reels)
* **Objetivo:** Sección de videos verticales fullscreen con navegación por deslizamiento vertical.
* **Backend:**
  * Lógica de feed optimizada para videos de corta duración.
  * Endpoint de carga rápida y extracción de miniaturas de video.
* **Frontend/Mobile:**
  * Pantalla de videos verticales con gestos de deslizamiento superior/inferior.
  * Optimización de rendimiento mediante reproducción perezosa (lazy playing) y precarga inteligente del siguiente video en cola.
* **Definición de Terminado (DoD):** Swipe de videos verticales fluido y sin pausas de carga, con funciones de likes y comentarios directamente accesibles desde el reproductor.

## FASE 10: Llamadas y Videollamadas
* **Objetivo:** Llamadas de voz y video en tiempo real.
* **Backend:**
  * Señalización WebRTC a través de WebSockets.
  * Integración de tokens para servidor de comunicación (ej. LiveKit o arquitectura WebRTC Peer-to-Peer básica).
* **Frontend/Mobile:**
  * UI de llamada entrante/saliente, pantalla completa de videollamada con cambio de cámara, muteado de micrófono y opción de compartir pantalla en la web.
* **Definición de Terminado (DoD):** Dos usuarios pueden establecer una videollamada interactiva con audio y video fluidos en red local o externa.

## FASE 11: Panel Administrativo y Moderación
* **Objetivo:** Monitorear, gestionar y suspender contenido o cuentas reportadas.
* **Backend:**
  * Endpoints protegidos para administradores en `/api/v1/admin`.
  * Estadísticas de uso agregadas (PostgreSQL queries rápidas).
* **Frontend Web:**
  * Dashboard administrativo accesible mediante rol `ADMIN`.
  * Gestión de usuarios (suspensión y reactivación) y visualización de reportes (eliminar posts o desestimar reportes).
* **Definición de Terminado (DoD):** Dashboard completamente funcional que permite moderar y consultar métricas globales de la plataforma.

## FASE 12: Optimización, Testing y Seguridad
* **Objetivo:** Pruebas integrales de estrés, seguridad, rate limiting y optimizaciones finales.
* **Backend:**
  * Rate limiting por IP/Usuario usando Redis en endpoints críticos.
  * Limpieza y saneamiento de inputs (anti-XSS).
  * Cobertura de tests unitarios e integración en backend superior al 80%.
* **Frontend/Mobile:**
  * Virtualización de listas de posts y mensajes para optimizar uso de memoria.
  * Auditoría Lighthouse y carga de imágenes optimizada con Next.js Image.
* **Definición de Terminado (DoD):** Pruebas de integración aprobadas, vulnerabilidades resueltas y el proyecto listo para producción con pipelines listos.
