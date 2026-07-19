import crypto from "node:crypto";
import { cookies } from "next/headers";
import {
  hashPassword,
  hashSessionToken,
  signSessionValue,
  verifySessionValue,
} from "./auth-crypto";
import {
  createUser,
  deleteSession,
  getSession,
  getUserByEmail,
  getUserById,
  hasAnyAdmin,
  saveSession,
  toPublicUser,
  type PublicUser,
  type User,
  type UserRole,
} from "./auth-store";

export { hashPassword, hashSessionToken, signSessionValue, verifyPassword, verifySessionValue } from "./auth-crypto";

export const SESSION_COOKIE = "cth_session";
const SESSION_DAYS = 30;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export async function createUserSession(userId: string) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60_000);
  await saveSession({ sessionHash: hashSessionToken(token), userId, expiresAt: expiresAt.toISOString() });
  return { cookieValue: signSessionValue(token), expiresAt };
}

export async function deleteCurrentSession(cookieValue?: string) {
  const token = verifySessionValue(cookieValue);
  if (token) await deleteSession(hashSessionToken(token));
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = verifySessionValue(cookieStore.get(SESSION_COOKIE)?.value);
  if (!token) return null;
  const session = await getSession(hashSessionToken(token));
  if (!session || new Date(session.expiresAt).getTime() <= Date.now()) return null;
  return getUserById(session.userId);
}

export async function requireUser() {
  return getCurrentUser();
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

export function publicUser(user: User): PublicUser {
  return toPublicUser(user);
}

export async function createAccount(input: { email: string; password: string; role?: UserRole }) {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new Error("Enter a valid email address.");
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters.");

  const passwordHash = await hashPassword(input.password);
  const role = input.role ?? ((await shouldRegisterAsAdmin(email)) ? "admin" : "user");
  return createUser({ email, passwordHash, role });
}

async function shouldRegisterAsAdmin(email: string) {
  const adminEmail = process.env.ADMIN_EMAIL ? normalizeEmail(process.env.ADMIN_EMAIL) : "";
  if (!adminEmail || email !== adminEmail) return false;
  return !(await hasAnyAdmin());
}

export async function ensureBootstrapAdmin() {
  const adminEmail = process.env.ADMIN_EMAIL ? normalizeEmail(process.env.ADMIN_EMAIL) : "";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "";
  if (!adminEmail || !adminPassword || !isValidEmail(adminEmail) || adminPassword.length < 8) return null;

  const existing = await getUserByEmail(adminEmail);
  if (existing) return existing;
  if (await hasAnyAdmin()) return null;
  return createAccount({ email: adminEmail, password: adminPassword, role: "admin" });
}
