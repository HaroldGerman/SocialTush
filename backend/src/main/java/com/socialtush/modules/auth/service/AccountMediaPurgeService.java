package com.socialtush.modules.auth.service;

import com.socialtush.modules.media.service.StorageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccountMediaPurgeService {

    private final StorageService storageService;

    @Async
    public void purge(List<String> objectKeys) {
        for (String key : objectKeys) {
            try {
                storageService.deleteFile(key);
            } catch (Exception exception) {
                log.warn("No se pudo purgar un archivo de una cuenta eliminada: {}", key);
            }
        }
    }
}
