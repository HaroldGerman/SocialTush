package com.socialtush.modules.media.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import jakarta.annotation.PostConstruct;
import java.net.URI;

@Slf4j
@Service
public class MinioStorageService implements StorageService {

    @Value("${app.storage.endpoint}")
    private String endpoint;

    @Value("${app.storage.access-key}")
    private String accessKey;

    @Value("${app.storage.secret-key}")
    private String secretKey;

    @Value("${app.storage.bucket-name}")
    private String bucketName;

    @Value("${app.storage.public-url}")
    private String publicUrl;

    private S3Client s3Client;

    @PostConstruct
    public void init() {
        try {
            if (endpoint != null && !endpoint.isBlank()) {
                S3Configuration serviceConfiguration = S3Configuration.builder()
                        .pathStyleAccessEnabled(true)
                        .chunkedEncodingEnabled(false)
                        .build();

                this.s3Client = S3Client.builder()
                        .endpointOverride(URI.create(endpoint))
                        .credentialsProvider(StaticCredentialsProvider.create(
                                AwsBasicCredentials.create(accessKey, secretKey)
                        ))
                        .region(Region.of("auto"))
                        .serviceConfiguration(serviceConfiguration)
                        .build();

                log.info("Storage S3Client successfully initialized for R2/S3/MinIO with endpoint: {}", endpoint);
            }
        } catch (Exception e) {
            log.error("Failed to initialize S3Client with endpoint [{}]: {}", endpoint, e.getMessage());
        }
    }

    @Override
    public String uploadFile(String filename, byte[] content, String contentType) {
        if (s3Client == null) {
            log.error("Storage upload rejected: S3Client is not initialized. Endpoint: {}", endpoint);
            throw new IllegalStateException("El servicio de almacenamiento de imágenes no está disponible o no está configurado.");
        }

        try {
            PutObjectRequest putRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(filename)
                    .contentType(contentType)
                    .build();

            s3Client.putObject(putRequest, RequestBody.fromBytes(content));

            String cleanPublicUrl = publicUrl != null ? publicUrl.replaceAll("/+$", "") : "";
            String finalUrl = cleanPublicUrl + "/" + filename;
            log.info("File uploaded successfully to S3/R2/MinIO: {}", finalUrl);
            return finalUrl;
        } catch (Exception e) {
            log.error("Storage upload error for file [{}] in bucket [{}]: {}", filename, bucketName, e.getMessage(), e);
            throw new RuntimeException("Error al subir el archivo al almacenamiento de producción: " + e.getMessage(), e);
        }
    }

    @Override
    public void deleteFile(String filename) {
        if (s3Client == null) {
            log.error("Storage delete rejected: S3Client is not initialized.");
            throw new IllegalStateException("El servicio de almacenamiento no está disponible.");
        }
        try {
            if (filename != null && !filename.isBlank()) {
                DeleteObjectRequest deleteRequest = DeleteObjectRequest.builder()
                        .bucket(bucketName)
                        .key(filename)
                        .build();
                s3Client.deleteObject(deleteRequest);
                log.info("File deleted successfully from S3/R2/MinIO: {}", filename);
            }
        } catch (Exception e) {
            log.error("Error deleting file [{}] from bucket [{}]: {}", filename, bucketName, e.getMessage(), e);
            throw new RuntimeException("Error al eliminar el archivo del almacenamiento: " + e.getMessage(), e);
        }
    }
}
