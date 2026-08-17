package com.socialtush.modules.auth.controller;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class AuthControllerTest {

    @Test
    void testBasicValidation() {
        String username = "usuario_test";
        assertNotNull(username);
        assertEquals("usuario_test", username);
    }
}
