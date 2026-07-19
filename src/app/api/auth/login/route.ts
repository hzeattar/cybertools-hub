import { NextRequest, NextResponse } from "next/server";
import {
  createUserSession,
  ensureBootstrapAdmin,
  normalizeEmail,
  publicUser,
  SESSION_COOKIE,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { getUserByEmail } from "@/lib/auth-store";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = rateLimit(`login:${ip}`, 10, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many login attempts." }, { status: 429 });

  await ensureBootstrapAdmin();
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = normalizeEmail(body?.email ?? "");
  const password = body?.password ?? "";
  const user = await getUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const session = await createUserSession(user.id);
  const response = NextResponse.json({ user: publicUser(user) });
  response.cookies.set(SESSION_COOKIE, session.cookieValue, sessionCookieOptions(session.expiresAt));
  return response;
}
