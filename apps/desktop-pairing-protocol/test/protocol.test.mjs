import test from 'node:test';
import assert from 'node:assert/strict';
import {
  READ_ONLY_CAPABILITIES,
  ReplayGuard,
  createClientHello,
  createCodeVerifier,
  createPairingOffer,
  createSignedEnvelope,
  deriveClientSession,
  deriveDesktopSession,
  grantCapabilities,
  validateWebOrigin,
  verifyPairingCode,
} from '../src/index.mjs';

test('pairing code verifier accepts only the original code', () => {
  const record = createCodeVerifier('12345678', Buffer.alloc(16, 7));
  assert.equal(verifyPairingCode('12345678', record), true);
  assert.equal(verifyPairingCode('12345679', record), false);
  assert.equal(verifyPairingCode('bad-code', record), false);
});

test('desktop and client derive complementary session keys', () => {
  const now = 1_700_000_000_000;
  const offer = createPairingOffer({
    deviceName: 'Development PC',
    webOrigin: 'https://chat.example.com',
    now,
  });
  const client = createClientHello({
    pairingId: offer.registration.pairingId,
    webOrigin: 'https://chat.example.com',
    now: now + 1_000,
  });

  const desktop = deriveDesktopSession({
    privateState: offer.privateState,
    registration: offer.registration,
    clientHello: client.hello,
    now: now + 2_000,
  });
  const browser = deriveClientSession({
    clientPrivateState: client.privateState,
    registration: offer.registration,
    pairingSecret: offer.privateState.pairingSecret,
    now: now + 2_000,
  });

  assert.equal(desktop.sessionId, browser.sessionId);
  assert.equal(desktop.confirmationCode, browser.confirmationCode);
  assert.equal(desktop.sendKey, browser.receiveKey);
  assert.equal(desktop.receiveKey, browser.sendKey);
});

test('signed envelopes reject tampering and replay', () => {
  const guard = new ReplayGuard();
  const key = Buffer.alloc(32, 9).toString('base64url');
  const envelope = createSignedEnvelope({
    sessionId: 'session-1234567890',
    sequence: 1,
    body: { operation: 'filesystem.list', path: '.' },
    key,
    now: 50_000,
    nonce: 'nonce-12345678901234567890',
  });

  assert.deepEqual(guard.verify(envelope, key, { now: 50_100 }), envelope.body);
  assert.throws(() => guard.verify(envelope, key, { now: 50_100 }), /Replay detected/);

  const tampered = { ...envelope, sequence: 2, body: { operation: 'filesystem.delete' } };
  assert.throws(() => new ReplayGuard().verify(tampered, key, { now: 50_100 }), /authentication failed/);
});

test('stale envelopes are rejected', () => {
  const key = Buffer.alloc(32, 4).toString('base64url');
  const envelope = createSignedEnvelope({
    sessionId: 'session-1234567890',
    sequence: 1,
    body: {},
    key,
    now: 1_000,
  });
  assert.throws(
    () => new ReplayGuard().verify(envelope, key, { now: 1_000_000, maxClockSkewMs: 1_000 }),
    /timestamp/,
  );
});

test('capability grants cannot escalate beyond read-only policy', () => {
  assert.deepEqual(
    grantCapabilities([
      'filesystem.read',
      'filesystem.write',
      'process.execute',
      'filesystem.search',
    ]),
    ['filesystem.read', 'filesystem.search'],
  );
  assert.deepEqual(grantCapabilities(READ_ONLY_CAPABILITIES), READ_ONLY_CAPABILITIES);
  assert.throws(() => grantCapabilities(['unknown.operation']), /Unknown capability/);
});

test('web origin requires HTTPS except explicitly allowed loopback', () => {
  assert.equal(validateWebOrigin('https://chat.example.com'), 'https://chat.example.com');
  assert.throws(() => validateWebOrigin('http://chat.example.com'), /HTTPS/);
  assert.equal(
    validateWebOrigin('http://127.0.0.1:3080', { allowLoopback: true }),
    'http://127.0.0.1:3080',
  );
  assert.throws(() => validateWebOrigin('https://chat.example.com/path'), /paths/);
});

test('expired pairing offers are rejected', () => {
  const offer = createPairingOffer({
    deviceName: 'Development PC',
    webOrigin: 'https://chat.example.com',
    now: 10_000,
    ttlMs: 30_000,
  });
  const client = createClientHello({
    pairingId: offer.registration.pairingId,
    webOrigin: 'https://chat.example.com',
    now: 11_000,
  });
  assert.throws(
    () =>
      deriveDesktopSession({
        privateState: offer.privateState,
        registration: offer.registration,
        clientHello: client.hello,
        now: 50_001,
      }),
    /expired/,
  );
});
