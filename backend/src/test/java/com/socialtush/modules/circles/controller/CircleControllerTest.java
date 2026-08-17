package com.socialtush.modules.circles.controller;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class CircleControllerTest {

    @Test
    void testSlugGeneration() {
        String name = "Exploradores Urbanos!";
        String slug = name.toLowerCase().trim().replaceAll("[^a-z0-9]", "-").replaceAll("-+", "-");
        assertEquals("exploradores-urbanos-", slug);
    }
}
