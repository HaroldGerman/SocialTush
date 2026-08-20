# Lifonk Conversations E2EE audit

Status: **not enabled**. The product must not display an E2EE claim yet.

The official Signal `libsignal` implementation exposes native-backed Java, Swift and Node/TypeScript bridges. Its TypeScript package targets Node and its mobile bridges require native Android/iOS libraries. Lifonk mobile currently targets Expo Go, which cannot load third-party custom native modules. Consequently there is no single supported, audited implementation that can currently cover Next.js browsers, Expo Go, Android/iOS, and multi-device sessions without changing the mobile runtime and key architecture.

Required transition before enabling E2EE:

1. Move mobile production testing from Expo Go to an Expo development build capable of embedding audited native libsignal bindings.
2. Select and pin maintained browser and mobile protocol implementations with an interoperability test suite.
3. Add per-device identity keys, signed prekeys, one-time prekeys, device enrollment, rotation, verification, and encrypted key backup. Private keys must never reach the backend unencrypted.
4. Introduce a versioned ciphertext envelope and an explicit activation boundary. Historical plaintext remains historical and must not be described as encrypted retroactively.
5. Encrypt attachments on the client before R2 upload; transmit the file key and authenticated metadata only inside the encrypted message envelope.
6. Replace server-side plaintext search with a local per-device index after the E2EE boundary.
7. Keep Web Push payloads content-free. The existing generic “@usuario te escribió” payload is compatible with this requirement.

Until all items are implemented and independently tested, the backend continues to store plaintext and the UI must not show “Cifrado de extremo a extremo”.
