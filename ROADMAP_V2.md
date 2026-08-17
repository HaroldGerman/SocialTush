# 🗺️ SocialTush - Master Roadmap V2 (Estado Real del Repositorio)

**Estado General del Proyecto:**
- **Arquitectura:** Monolito Modular (Spring Boot 3.3.2 + Next.js 14 + React Native Expo SDK 54 + PostgreSQL 16 + Redis 7 + MinIO).
- **Control de Versiones & Git:** Limpieza de `target/`, `node_modules/`, `.next/`, `.expo/` e integración de `.gitignore` estricto.
- **Migraciones DB:** Flyway habilitado (`V1__init_schema.sql`, `V2__create_circles_schema.sql`, `V3__stories_expansion_schema.sql`).

---

## 📊 Matriz de Funcionalidades & Estado

| Módulo / Funcionalidad | Backend (`backend/`) | Web (`web/`) | Mobile (`mobile/`) | Estado | Comentarios |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Monorepo & Docker** | ✅ | ✅ | ✅ | 🟢 Hecho | PostgreSQL 5433, Redis 6379, MinIO 9000 |
| **Auth JWT & Refresco** | ✅ | ✅ | ✅ | 🟢 Hecho | Sesión persistente con `expo-secure-store` en móvil |
| **Onboarding (4 pasos)** | ✅ | ✅ | 🟡 | 🟢 Web Hecho | Redirección automática inicial |
| **Perfil & Ajustes** | ✅ | ✅ | ✅ | 🟢 Hecho | Rediseño soft-teal completado |
| **Seguidores & Solicitudes** | ✅ | ✅ | ✅ | 🟢 Hecho | `Follow` + `FollowRequest` |
| **Publicaciones Multimodales** | ✅ | ✅ | ✅ | 🟢 Hecho | Soporte para publicaciones sólo texto o adjuntos |
| **Feed Modular** | ✅ | ✅ | ✅ | 🟢 Hecho | Paginación y algoritmo inicial |
| **Likes & Comentarios** | ✅ | ✅ | ✅ | 🟢 Hecho | Interacciones base activas |
| **Guardados & Colecciones** | ✅ | ✅ | 🟡 | 🟢 Hecho | Guardados de publicaciones |
| **Historias (Stories)** | ✅ | ✅ | 🟡 | 🟢 Hecho | `StoryView`, `StoryReaction` y expiración |
| **Círculos & Nodos** | ✅ | ✅ | 🟡 | 🟢 Hecho | Rutas `/circles` y `/circles/[slug]` funcionales |
| **Chat 1:1 & Grupos (WS)** | ✅ | ✅ | ✅ | 🟢 Hecho | WebSocket STOMP + REST |
| **Señalización Videollamadas** | ✅ | ✅ | 🟡 | 🟡 Parcial | WebSockets activados |
| **Notificaciones** | ✅ | ✅ | ✅ | 🟢 Hecho | `NotificationBell` activo |
| **Consola de Admin** | ✅ | ✅ | N/A | 🟢 Hecho | Control de usuarios y moderación |
| **Tests Automatizados** | ✅ | ✅ | 🟡 | 🟢 Hecho | `mvn test` + `npm test` configurados |
| **CI/CD Workflows** | 🟡 | 🟡 | 🟡 | ⏳ Siguiente | GitHub Actions pipeline |

---

## 🎯 Plan del Sprint Actual (Cierre de MVP 1.0)

1. [x] **Limpieza de Repositorio:** Untrack de `target/`, `node_modules/` y `.next/`.
2. [x] **Flyway Migraciones:** Integración de `V1`, `V2` (Círculos) y `V3` (Stories).
3. [x] **Sesión Persistente Móvil:** `expo-secure-store` configurado en `AuthContext.tsx`.
4. [x] **Extensión de Historias:** Vistas (`StoryView`) y Reacciones (`StoryReaction`).
5. [x] **Módulo de Círculos Integrado:** Vistas web `/circles` y `/circles/[slug]` funcionando con backend.
6. [x] **Pruebas Automatizadas:** Activación de suite JUnit 5 (`mvn test`) y script `npm test`.
