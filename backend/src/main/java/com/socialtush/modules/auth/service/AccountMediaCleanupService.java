package com.socialtush.modules.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccountMediaCleanupService {

    private final JdbcTemplate jdbcTemplate;
    private final AccountMediaPurgeService purgeService;

    @Value("${app.storage.public-url:}")
    private String publicUrl;

    public List<String> collectOwnedObjectKeys(UUID userId) {
        Set<String> urls = new LinkedHashSet<>();

        queryUrls(urls, "SELECT avatar_url FROM profiles WHERE user_id = ?", userId);
        queryUrls(urls, "SELECT pm.original_url FROM post_media pm JOIN posts p ON p.id = pm.post_id WHERE p.user_id = ?", userId);
        queryUrls(urls, "SELECT pm.medium_url FROM post_media pm JOIN posts p ON p.id = pm.post_id WHERE p.user_id = ?", userId);
        queryUrls(urls, "SELECT pm.thumbnail_url FROM post_media pm JOIN posts p ON p.id = pm.post_id WHERE p.user_id = ?", userId);
        queryUrls(urls, "SELECT media_url FROM stories WHERE user_id = ?", userId);
        queryUrls(urls, "SELECT media_url FROM messages WHERE sender_id = ?", userId);
        queryUrls(urls, "SELECT ma.file_url FROM message_attachments ma JOIN messages m ON m.id = ma.message_id WHERE m.sender_id = ?", userId);
        queryUrls(urls, "SELECT avatar_url FROM circles WHERE owner_id = ?", userId);
        queryUrls(urls, "SELECT cover_url FROM circles WHERE owner_id = ?", userId);

        List<String> keys = new ArrayList<>();
        for (String url : urls) {
            String key = objectKey(url);
            if (key != null && !key.isBlank()) keys.add(key);
        }
        return keys.stream().distinct().toList();
    }

    public void purgeAfterCommit(List<String> keys) {
        if (keys == null || keys.isEmpty()) return;

        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    purgeService.purge(keys);
                }
            });
        } else {
            purgeService.purge(keys);
        }
    }

    private void queryUrls(Set<String> target, String sql, UUID userId) {
        try {
            jdbcTemplate.query(sql, ps -> ps.setObject(1, userId), rs -> {
                String value = rs.getString(1);
                if (value != null && !value.isBlank()) target.add(value.trim());
            });
        } catch (DataAccessException exception) {
            // Account deletion must not be blocked by an optional/legacy media column.
            log.debug("No se pudo recolectar una ruta de media para limpieza: {}", exception.getMessage());
        }
    }

    private String objectKey(String url) {
        if (url == null || url.isBlank() || publicUrl == null || publicUrl.isBlank()) return null;
        String base = publicUrl.trim().replaceAll("/+$", "");
        String prefix = base + "/";
        return url.startsWith(prefix) ? url.substring(prefix.length()) : null;
    }
}
