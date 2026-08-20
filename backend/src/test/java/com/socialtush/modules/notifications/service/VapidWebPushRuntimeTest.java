package com.socialtush.modules.notifications.service;

import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.security.KeyPairGenerator;
import java.security.Provider;
import java.security.Security;
import java.security.spec.ECGenParameterSpec;

import static org.assertj.core.api.Assertions.assertThat;

class VapidWebPushRuntimeTest {

    private Provider originalProvider;

    @AfterEach
    void restoreProviderRegistry() {
        Security.removeProvider(BouncyCastleProvider.PROVIDER_NAME);
        if (originalProvider != null) Security.addProvider(originalProvider);
    }

    @Test
    void realSenderRegistersBouncyCastleBeforePushServiceUsesIt() throws Exception {
        assertThat(Class.forName("org.bouncycastle.jce.spec.ECParameterSpec")).isNotNull();
        originalProvider = Security.getProvider(BouncyCastleProvider.PROVIDER_NAME);
        Security.removeProvider(BouncyCastleProvider.PROVIDER_NAME);

        VapidWebPushSender sender = new VapidWebPushSender("test-public", "test-private", "mailto:test@lifonk.invalid");
        KeyPairGenerator generator = KeyPairGenerator.getInstance("EC", BouncyCastleProvider.PROVIDER_NAME);
        generator.initialize(new ECGenParameterSpec("secp256r1"));
        PushService pushService = new PushService(generator.generateKeyPair(), "mailto:test@lifonk.invalid");

        assertThat(sender).isNotNull();
        assertThat(pushService).isNotNull();
        assertThat(Security.getProvider(BouncyCastleProvider.PROVIDER_NAME)).isNotNull();
    }
}
