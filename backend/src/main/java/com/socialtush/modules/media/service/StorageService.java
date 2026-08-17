package com.socialtush.modules.media.service;

public interface StorageService {
    String uploadFile(String filename, byte[] content, String contentType);
    void deleteFile(String filename);
}
