import {
  createHmac,
  createHash,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes,
  randomInt,
  randomUUID,
  scryptSync,
  timingSafeEqual,
  createPrivateKey,
  createPublicKey,
} from 'node:crypto';

export const PROTOCOL_VERSION = 1;
export const DEFAULT_PAIRING_TTL_MS = 5 * 60 * 1000;
export const DEFAULT_CLOCK_SKEW_MS = 2 * 60 * 1000;

export const READ_ONLY_CAPABILITIES = Object.freeze([
  'filesystem.list',
  'filesystem.read',
  'filesystem.search',
]);

const ALL_CAPABILITIES = new Set([
  ...READ_ONLY_CAPABILITIES,
  'filesystem.write',
  'filesystem.delete',
  'process.execute',
  'network.listen',
]);

function base64url(buffer) {
  return Buffer.from(buffer).toString('base64url');
}

function fromBase64url(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError('Expected a non-empty base64url string');
  }
  return Buffer.from(value, 'base64url');
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
}

function sha256(value) {
  return createHash('sha256').update(value).digest();
}

function exportPublicKey(key) {
  return base64url(key.export({ type: 'spki', format: 'der' }));
}

function exportPrivateKey(key) {
  return base64url(key.export({ type: 'pkcs8', format: 'der' }));
}

function importPublicKey(value) {
  return createPublicKey({ key: fromBase64url(value), type: 'spki', format: 'der' });
}

function importPrivateKey(value) {
  return createPrivateKey({ key: fromBase64url(value), type: 'pkcs8', format: 'der' });
}

export function validateWebOrigin(origin, { allowLoopback = false } = {}) {
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    throw new Error('Invalid web origin');
  }

  const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]']);
  const isLoopback = loopbackHosts.has(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(allowLoopback && isLoopback && parsed.protocol === 'http:')) {
    throw new Error('Pairing origin must use HTTPS');
  }
  if (parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error('Origin must not contain credentials, paths, queries, or fragments');
  }
  return parsed.origin;
}

export function createCodeVerifier(code, salt = randomBytes(16)) {
  if (!/^\d{8}$/.test(code)) {
    throw new Error('Pairing code must contain exactly 8 digits');
  }
  const verifier = scryptSync(code, salt, 32, { N: 16_384, r: 8, p: 1 });
  return { salt: base64url(salt), verifier: base64url(verifier) };
}

export function verifyPairingCode(code, record) {
  if (!/^\d{8}$/.test(code)) {
    return false;
  }
  try {
    const expected = fromBase64url(record.verifier);
    const actual = scryptSync(code, fromBase64url(record.salt), expected.length, {
      N: 16_384,
      r: 8,
      p: 1,
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createPairingOffer({
  deviceName,
  webOrigin,
  now = Date.now(),
  ttlMs = DEFAULT_PAIRING_TTL_MS,
} = {}) {
  if (typeof deviceName !== 'string' || deviceName.trim().length < 1 || deviceName.length > 80) {
    throw new Error('Device name must be between 1 and 80 characters');
  }
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs < 30_000 || ttlMs > 15 * 60_000) {
    throw new Error('Invalid pairing lifetime');
  }

  const origin = validateWebOrigin(webOrigin);
  const code = randomInt(0, 100_000_000).toString().padStart(8, '0');
  const codeRecord = createCodeVerifier(code);
  const pairingSecret = randomBytes(32);
  const desktopKeys = generateKeyPairSync('x25519');
  const pairingId = randomUUID();

  return {
    displayCode: code,
    privateState: {
      pairingId,
      pairingSecret: base64url(pairingSecret),
      privateKey: exportPrivateKey(desktopKeys.privateKey),
      createdAt: now,
      expiresAt: now + ttlMs,
      webOrigin: origin,
    },
    registration: {
      version: PROTOCOL_VERSION,
      pairingId,
      deviceName: deviceName.trim(),
      webOrigin: origin,
      publicKey: exportPublicKey(desktopKeys.publicKey),
      codeVerifier: codeRecord,
      createdAt: now,
      expiresAt: now + ttlMs,
    },
  };
}

export function createClientHello({ pairingId, webOrigin, now = Date.now() } = {}) {
  if (typeof pairingId !== 'string' || pairingId.length < 16) {
    throw new Error('Invalid pairing identifier');
  }
  const origin = validateWebOrigin(webOrigin);
  const clientKeys = generateKeyPairSync('x25519');
  const nonce = base64url(randomBytes(24));
  return {
    privateState: {
      pairingId,
      privateKey: exportPrivateKey(clientKeys.privateKey),
      nonce,
      createdAt: now,
      webOrigin: origin,
    },
    hello: {
      version: PROTOCOL_VERSION,
      pairingId,
      webOrigin: origin,
      publicKey: exportPublicKey(clientKeys.publicKey),
      nonce,
      createdAt: now,
    },
  };
}

function pairingTranscript({ pairingId, webOrigin, desktopPublicKey, clientPublicKey, nonce }) {
  return stableJson({
    version: PROTOCOL_VERSION,
    pairingId,
    webOrigin,
    desktopPublicKey,
    clientPublicKey,
    nonce,
  });
}

function deriveMaterial({ privateKey, peerPublicKey, pairingSecret, transcript }) {
  const shared = diffieHellman({
    privateKey: importPrivateKey(privateKey),
    publicKey: importPublicKey(peerPublicKey),
  });
  const transcriptHash = sha256(transcript);
  const salt = sha256(Buffer.concat([fromBase64url(pairingSecret), transcriptHash]));
  return Buffer.from(hkdfSync('sha256', shared, salt, transcriptHash, 64));
}

export function deriveDesktopSession({ privateState, registration, clientHello, now = Date.now() }) {
  assertPairingWindow({ privateState, registration, clientHello, now });
  const transcript = pairingTranscript({
    pairingId: registration.pairingId,
    webOrigin: registration.webOrigin,
    desktopPublicKey: registration.publicKey,
    clientPublicKey: clientHello.publicKey,
    nonce: clientHello.nonce,
  });
  const material = deriveMaterial({
    privateKey: privateState.privateKey,
    peerPublicKey: clientHello.publicKey,
    pairingSecret: privateState.pairingSecret,
    transcript,
  });
  return buildSession(material, transcript, 'desktop');
}

export function deriveClientSession({ clientPrivateState, registration, pairingSecret, now = Date.now() }) {
  if (registration.webOrigin !== clientPrivateState.webOrigin) {
    throw new Error('Pairing origin mismatch');
  }
  if (now > registration.expiresAt) {
    throw new Error('Pairing offer expired');
  }
  const transcript = pairingTranscript({
    pairingId: registration.pairingId,
    webOrigin: registration.webOrigin,
    desktopPublicKey: registration.publicKey,
    clientPublicKey: createPublicKey(importPrivateKey(clientPrivateState.privateKey))
      .export({ type: 'spki', format: 'der' })
      .toString('base64url'),
    nonce: clientPrivateState.nonce,
  });
  const material = deriveMaterial({
    privateKey: clientPrivateState.privateKey,
    peerPublicKey: registration.publicKey,
    pairingSecret,
    transcript,
  });
  return buildSession(material, transcript, 'client');
}

function assertPairingWindow({ privateState, registration, clientHello, now }) {
  if (registration.version !== PROTOCOL_VERSION || clientHello.version !== PROTOCOL_VERSION) {
    throw new Error('Unsupported pairing protocol version');
  }
  if (registration.pairingId !== privateState.pairingId || clientHello.pairingId !== privateState.pairingId) {
    throw new Error('Pairing identifier mismatch');
  }
  if (registration.webOrigin !== privateState.webOrigin || clientHello.webOrigin !== privateState.webOrigin) {
    throw new Error('Pairing origin mismatch');
  }
  if (now > privateState.expiresAt || now > registration.expiresAt) {
    throw new Error('Pairing offer expired');
  }
}

function buildSession(material, transcript, role) {
  const first = material.subarray(0, 32);
  const second = material.subarray(32, 64);
  const desktopSend = first;
  const clientSend = second;
  return {
    sessionId: base64url(sha256(transcript).subarray(0, 18)),
    confirmationCode: confirmationCode(transcript),
    sendKey: base64url(role === 'desktop' ? desktopSend : clientSend),
    receiveKey: base64url(role === 'desktop' ? clientSend : desktopSend),
  };
}

export function confirmationCode(transcript) {
  const digest = sha256(transcript).toString('hex').toUpperCase();
  return `${digest.slice(0, 4)}-${digest.slice(4, 8)}-${digest.slice(8, 12)}`;
}

export function grantCapabilities(requested, allowed = READ_ONLY_CAPABILITIES) {
  if (!Array.isArray(requested) || !Array.isArray(allowed)) {
    throw new TypeError('Capabilities must be arrays');
  }
  const allowedSet = new Set(allowed);
  const result = [];
  for (const capability of requested) {
    if (!ALL_CAPABILITIES.has(capability)) {
      throw new Error(`Unknown capability: ${capability}`);
    }
    if (allowedSet.has(capability) && !result.includes(capability)) {
      result.push(capability);
    }
  }
  return Object.freeze(result);
}

export function createSignedEnvelope({ sessionId, sequence, body, key, now = Date.now(), nonce } = {}) {
  if (!Number.isSafeInteger(sequence) || sequence < 1) {
    throw new Error('Sequence must be a positive safe integer');
  }
  const envelope = {
    version: PROTOCOL_VERSION,
    sessionId,
    sequence,
    timestamp: now,
    nonce: nonce ?? base64url(randomBytes(18)),
    body,
  };
  const mac = createHmac('sha256', fromBase64url(key)).update(stableJson(envelope)).digest();
  return { ...envelope, mac: base64url(mac) };
}

export class ReplayGuard {
  #sessions = new Map();

  verify(envelope, key, { now = Date.now(), maxClockSkewMs = DEFAULT_CLOCK_SKEW_MS } = {}) {
    if (envelope.version !== PROTOCOL_VERSION) {
      throw new Error('Unsupported envelope version');
    }
    if (Math.abs(now - envelope.timestamp) > maxClockSkewMs) {
      throw new Error('Envelope timestamp is outside the accepted window');
    }
    if (!Number.isSafeInteger(envelope.sequence) || envelope.sequence < 1) {
      throw new Error('Invalid envelope sequence');
    }
    if (typeof envelope.nonce !== 'string' || envelope.nonce.length < 16) {
      throw new Error('Invalid envelope nonce');
    }

    const { mac, ...unsigned } = envelope;
    const expected = createHmac('sha256', fromBase64url(key)).update(stableJson(unsigned)).digest();
    const actual = fromBase64url(mac);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new Error('Envelope authentication failed');
    }

    const state = this.#sessions.get(envelope.sessionId) ?? { lastSequence: 0, nonces: new Set() };
    if (envelope.sequence <= state.lastSequence || state.nonces.has(envelope.nonce)) {
      throw new Error('Replay detected');
    }
    state.lastSequence = envelope.sequence;
    state.nonces.add(envelope.nonce);
    if (state.nonces.size > 2048) {
      state.nonces = new Set([...state.nonces].slice(-1024));
    }
    this.#sessions.set(envelope.sessionId, state);
    return envelope.body;
  }

  clear(sessionId) {
    this.#sessions.delete(sessionId);
  }
}
