package com.socialtush.modules.auth.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
public class ResendEmailService {

    private final WebClient webClient = WebClient.builder()
            .baseUrl("https://api.resend.com")
            .build();

    @Value("${app.mail.resend-api-key:}")
    private String apiKey;

    @Value("${app.mail.from:Lifonk <onboarding@resend.dev>}")
    private String from;

    public boolean isConfigured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public void sendHtml(String to, String subject, String html) {
        if (to == null || to.isBlank()) return;
        if (!isConfigured()) {
            log.warn("Email transaccional omitido: RESEND_API_KEY no configurada");
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("from", from);
        payload.put("to", List.of(to));
        payload.put("subject", subject);
        payload.put("html", html);

        try {
            webClient.post()
                    .uri("/emails")
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey.trim())
                    .contentType(MediaType.APPLICATION_JSON)
                    .bodyValue(payload)
                    .retrieve()
                    .toBodilessEntity()
                    .block(Duration.ofSeconds(10));
        } catch (Exception exception) {
            // Never log tokens, reset links, API keys, or email HTML.
            log.warn("No se pudo enviar email transaccional a {}: {}", maskEmail(to), exception.getMessage());
        }
    }

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) return "***";
        return email.charAt(0) + "***" + email.substring(at);
    }
}
