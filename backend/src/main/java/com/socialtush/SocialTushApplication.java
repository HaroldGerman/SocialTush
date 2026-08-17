package com.socialtush;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class SocialTushApplication {

    public static void main(String[] args) {
        SpringApplication.run(SocialTushApplication.class, args);
    }
}
