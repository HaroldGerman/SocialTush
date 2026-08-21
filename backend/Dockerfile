# Stage 1: Build the JAR file
FROM maven:3.9.6-eclipse-temurin-21-alpine AS build
WORKDIR /app
COPY pom.xml .
# Download dependencies (cached layer)
RUN mvn dependency:go-offline -B
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Run the application
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN apk add --no-cache ffmpeg

# Lifonk story-video wrapper: keep transcoding memory/CPU predictable on Railway.
# StoryController calls `ffmpeg`; /usr/local/bin has precedence over /usr/bin.
RUN cat > /usr/local/bin/ffmpeg <<'EOF'
#!/bin/sh
set -eu
REAL_FFMPEG=/usr/bin/ffmpeg

input=""
start="0"
duration="30"
last=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-i" ]; then input="$arg"; fi
  if [ "$prev" = "-ss" ]; then start="$arg"; fi
  if [ "$prev" = "-t" ]; then duration="$arg"; fi
  prev="$arg"
  last="$arg"
done

# Only replace the StoryController transcode invocation. Fall back to normal ffmpeg otherwise.
if [ -n "$input" ] && [ -n "$last" ]; then
  "$REAL_FFMPEG" \
    -hide_banner -loglevel error -y \
    -ss "$start" -i "$input" \
    -t "$duration" \
    -map 0:v:0 -map '0:a:0?' -sn -dn \
    -vf "scale='min(720,iw)':-2,pad=ceil(iw/2)*2:ceil(ih/2)*2" \
    -c:v libx264 -preset ultrafast -crf 25 -pix_fmt yuv420p -threads 1 \
    -c:a aac -b:a 96k \
    -movflags +faststart \
    "$last"
  code=$?
  if [ "$code" -ne 0 ]; then
    echo "Lifonk FFmpeg falló con código $code" >&2
  fi
  exit "$code"
fi

exec "$REAL_FFMPEG" "$@"
EOF
RUN chmod +x /usr/local/bin/ffmpeg

COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=prod
ENTRYPOINT ["java", "-jar", "app.jar"]
