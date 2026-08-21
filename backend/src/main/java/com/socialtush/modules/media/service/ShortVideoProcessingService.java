package com.socialtush.modules.media.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
public class ShortVideoProcessingService {

    public static final double MAX_PULSE_SECONDS = 60.0;
    private static final long PROCESS_TIMEOUT_SECONDS = 150;

    public ProcessedShortVideo process(MultipartFile source, Double trimStart, Double trimEnd, Double coverTime) {
        if (source == null || source.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Selecciona un video para Pulso");
        }
        if (source.getContentType() == null || !source.getContentType().toLowerCase(Locale.ROOT).startsWith("video/")) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Pulso solo acepta archivos de video");
        }

        double start = trimStart == null ? 0d : Math.max(0d, trimStart);
        double end = trimEnd == null ? start + MAX_PULSE_SECONDS : trimEnd;
        if (end <= start) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El recorte de Pulso no es válido");
        if (end - start > MAX_PULSE_SECONDS + 0.25d) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Un Pulso puede durar como máximo 60 segundos");
        }
        double duration = Math.min(MAX_PULSE_SECONDS, end - start);
        double thumbnailSecond = coverTime == null ? Math.min(duration / 2d, 2d) : Math.max(0d, Math.min(duration - 0.05d, coverTime));

        Path input = null;
        Path output = null;
        Path thumbnail = null;
        try {
            input = Files.createTempFile("lifonk-pulse-input-", extensionFor(source));
            output = Files.createTempFile("lifonk-pulse-output-", ".mp4");
            thumbnail = Files.createTempFile("lifonk-pulse-cover-", ".jpg");
            source.transferTo(input);

            List<String> transcode = new ArrayList<>(List.of(
                    "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-ss", decimal(start), "-i", input.toString(), "-t", decimal(duration),
                    "-map", "0:v:0", "-map", "0:a?",
                    "-vf", "scale='if(gt(iw,ih),min(720,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2",
                    "-c:v", "libx264", "-preset", "ultrafast", "-crf", "24", "-pix_fmt", "yuv420p",
                    "-threads", "1", "-c:a", "aac", "-b:a", "128k", "-af", "aresample=async=1:first_pts=0",
                    "-movflags", "+faststart", "-avoid_negative_ts", "make_zero", output.toString()
            ));
            run(transcode, "convertir el video para Pulso");

            List<String> cover = List.of(
                    "ffmpeg", "-hide_banner", "-loglevel", "error", "-y",
                    "-ss", decimal(thumbnailSecond), "-i", output.toString(),
                    "-vf", "scale='if(gt(iw,ih),min(720,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))':force_original_aspect_ratio=decrease",
                    "-frames:v", "1", "-update", "1", "-q:v", "3", thumbnail.toString()
            );
            run(cover, "generar la portada de Pulso");

            byte[] videoBytes = Files.readAllBytes(output);
            byte[] coverBytes = Files.readAllBytes(thumbnail);
            if (videoBytes.length == 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "El clip generado quedó vacío");
            if (coverBytes.length == 0) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La portada generada quedó vacía");
            return new ProcessedShortVideo(videoBytes, coverBytes, duration);
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            log.error("Pulso video processing failed", ex);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No pudimos preparar este video para Pulso");
        } finally {
            deleteQuietly(input);
            deleteQuietly(output);
            deleteQuietly(thumbnail);
        }
    }

    private void run(List<String> command, String action) throws IOException, InterruptedException {
        Process process = new ProcessBuilder(command).redirectErrorStream(true).start();
        boolean finished = process.waitFor(PROCESS_TIMEOUT_SECONDS, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new ResponseStatusException(HttpStatus.REQUEST_TIMEOUT, "Se agotó el tiempo al " + action);
        }
        String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        if (process.exitValue() != 0) {
            log.warn("FFmpeg failed while {}: {}", action, output);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    output.isBlank() ? "FFmpeg no pudo " + action : "FFmpeg no pudo " + action + ": " + shorten(output));
        }
    }

    private String extensionFor(MultipartFile file) {
        String name = file.getOriginalFilename();
        if (name != null) {
            int index = name.lastIndexOf('.');
            if (index >= 0 && index < name.length() - 1) {
                String ext = name.substring(index).toLowerCase(Locale.ROOT);
                if (ext.matches("\\.(mp4|mov|m4v|webm|3gp|mkv)")) return ext;
            }
        }
        return ".video";
    }

    private String decimal(double value) {
        return String.format(Locale.ROOT, "%.3f", value);
    }

    private String shorten(String text) {
        String compact = text.replaceAll("\\s+", " ").trim();
        return compact.length() <= 280 ? compact : compact.substring(0, 280);
    }

    private void deleteQuietly(Path path) {
        if (path == null) return;
        try { Files.deleteIfExists(path); } catch (IOException ignored) { }
    }

    public record ProcessedShortVideo(byte[] videoBytes, byte[] coverBytes, double durationSeconds) { }
}
