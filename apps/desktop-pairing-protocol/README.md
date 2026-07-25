# CyberTools Desktop Pairing Protocol

A dependency-free protocol foundation for securely pairing the CyberTools web application with a user-controlled desktop bridge.

## Security properties

- X25519 ephemeral key agreement.
- HKDF-SHA256 session key derivation bound to the complete pairing transcript.
- Eight-digit one-time pairing codes stored as scrypt verifiers, never plaintext server records.
- Explicit HTTPS origin binding.
- Short-lived pairing offers.
- Human confirmation fingerprint shown on both devices.
- Directional send and receive keys.
- HMAC-authenticated envelopes with timestamp, sequence, and nonce replay protection.
- Capability intersection that defaults to read-only filesystem operations.

## Deliberate exclusions

This package does not open ports, create WebSocket connections, persist secrets, access files, execute tools, or integrate with LibreChat. Those integrations require separate approval gates.

## Test

```bash
cd apps/desktop-pairing-protocol
npm test
npm run check
```
