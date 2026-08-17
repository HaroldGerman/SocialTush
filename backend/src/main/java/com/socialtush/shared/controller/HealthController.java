package com.socialtush.shared.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/health")
@RequiredArgsConstructor
public class HealthController {

    private final JdbcTemplate jdbcTemplate;
    private final StringRedisTemplate redisTemplate;

    @GetMapping
    public ResponseEntity<Map<String, Object>> checkHealth() {
        Map<String, Object> response = new HashMap<>();
        boolean dbHealthy = false;
        boolean redisHealthy = false;

        // Check PostgreSQL
        try {
            Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            dbHealthy = (result != null && result == 1);
        } catch (Exception e) {
            response.put("database_error", e.getMessage());
        }

        // Check Redis
        try {
            RedisConnection connection = redisTemplate.getConnectionFactory().getConnection();
            String pingResult = connection.ping();
            redisHealthy = "PONG".equalsIgnoreCase(pingResult);
            connection.close();
        } catch (Exception e) {
            response.put("redis_error", e.getMessage());
        }

        response.put("status", (dbHealthy && redisHealthy) ? "UP" : "DOWN");
        response.put("database", dbHealthy ? "UP" : "DOWN");
        response.put("redis", redisHealthy ? "UP" : "DOWN");
        response.put("timestamp", Instant.now().toString());

        if (dbHealthy && redisHealthy) {
            return ResponseEntity.ok(response);
        } else {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(response);
        }
    }
}
