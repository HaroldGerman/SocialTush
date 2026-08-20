package com.socialtush.modules.notifications.service;

import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.junit.jupiter.api.Test;

import java.security.KeyPairGenerator;
import java.security.Security;
import java.security.spec.ECGenParameterSpec;

import static org.assertj.core.api.Assertions.assertThat;

class VapidWebPushRuntimeTest {

    @Test
    void runtimeContainsBouncyCastleAndInitializesRealPushService() throws Exception {
        assertThat(Class.forName("org.bouncycastle.jce.spec.ECParameterSpec")).isNotNull();
        if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
            Security.addProvider(new BouncyCastleProvider());
        }

        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC", BouncyCastleProvider.PROVIDER_NAME);
        generator.initialize(new ECGenParameterSpec("secp256r1"));

        PushService pushService = new PushService(generator.generateKeyPair(), "mailto:test@lifonk.invalid");

        assertThat(pushService).isNotNull();
        assertThat(Security.getProvider(BouncyCastleProvider.PROVIDER_NAME)).isNotNull();
    }
}
