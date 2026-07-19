import { NextRequest, NextResponse } from "next/server";
import { createAccount, createUserSession, publicUser, SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth";
import { getUserByEmail } from "@/lib/auth-store";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = rateLimit(`register:${ip}`, 6, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many registration attempts." }, { status: 429 });

  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null;
  const email = body?.email ?? "";
  const password = body?.password ?? "";
  if (await getUserByEmail(email.trim().toLowerCase())) {
    return NextResponse.json({ error: "Email is already registered." }, { status: 409 });
  }

  try {
    const user = await createAccount({ email, password });
    const session = await createUserSession(user.id);
    const response = NextResponse.json({ user: publicUser(user) });
    response.cookies.set(SESSION_COOKIE, session.cookieValue, sessionCookieOptions(session.expiresAt));
    return response;
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
