import crypto from "node:crypto";

export async function hashPassword(password: string, salt = crypto.randomBytes(16).toString("base64url")) {
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 16_384, r: 8, p: 1 }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
  return `scrypt$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string) {
  const [scheme, salt, digest] = storedHash.split("$");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  const candidate = await hashPassword(password, salt);
  const candidateDigest = candidate.split("$")[2];
  return safeEqual(candidateDigest, digest);
}

export function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function sessionSecret() {
  return process.env.SESSION_SECRET ?? process.env.DOWNLOAD_SECRET ?? "local-session-secret";
}

export function signSessionValue(token: string) {
  const signature = crypto.createHmac("sha256", sessionSecret()).update(token).digest("base64url");
  return `${token}.${signature}`;
}

export function verifySessionValue(value: string | undefined) {
  if (!value) return null;
  const [token, signature] = value.split(".");
  if (!token || !signature) return null;
  const expected = crypto.createHmac("sha256", sessionSecret()).update(token).digest("base64url");
  if (!safeEqual(signature, expected)) return null;
  return token;
}

export function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}
