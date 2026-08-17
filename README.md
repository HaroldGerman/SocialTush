# SocialTush

SocialTush es una plataforma social premium moderna que integra mensajería en tiempo real y publicaciones visuales en un diseño minimalista y futurista.

---

## Estructura del Monorepo

```
SocialTush/
├── backend/            # Spring Boot 3 + Java 21 Application
├── web/                # Next.js 14 + Tailwind CSS Web Client
├── mobile/             # React Native App
├── docs/               # Documentación (ARCHITECTURE.md, ROADMAP.md)
├── docker-compose.yml  # Orquestación de DB (Postgres), Redis y MinIO
├── .env.example        # Plantilla de variables de entorno
└── README.md           # Guía general de uso
```

---

## Requisitos de Entorno

Asegúrate de tener instalados los siguientes componentes en tu máquina de desarrollo:
- **Java 21 (LTS)** o superior.
- **Node.js v18** o superior.
- **Docker** y **Docker Compose**.
- **Maven 3.8+** (opcional, incluido wrapper).

---

## Configuración y Arranque Rápido

### 1. Levantar la Infraestructura Local (Docker Compose)
Para iniciar las bases de datos y el almacenamiento de archivos (PostgreSQL, Redis, MinIO):
```bash
docker-compose up -d
```
Esto creará automáticamente el bucket `socialtush-media` en MinIO y lo configurará como público.

### 2. Configurar Variables de Entorno
Copia el archivo `.env.example` como `.env` (o crea variables locales en el sistema):
```bash
cp .env.example .env
```

### 3. Ejecutar el Backend (Spring Boot)
Ingresa al directorio de backend y ejecuta el servidor de desarrollo:
```bash
cd backend
mvn spring-boot:run
```
El backend estará disponible en `http://localhost:8080` y el endpoint de estado de salud se puede consultar en `http://localhost:8080/api/v1/health`.

### 4. Ejecutar el Frontend Web (Next.js)
Ingresa al directorio web, instala dependencias e inicia el servidor de desarrollo:
```bash
cd web
npm install
npm run dev
```
El cliente web estará disponible en `http://localhost:3000`.

### 5. Ejecutar la Aplicación Móvil (React Native)
Ingresa al directorio mobile, instala dependencias e inicia el bundler de React Native:
```bash
cd mobile
npm install
npm start
```

---

## Pruebas de Integración y Tests

* **Backend Unit/Integration Tests:**
  ```bash
  cd backend
  mvn test
  ```
* **Frontend Web Tests:**
  ```bash
  cd web
  npm test
  ```
