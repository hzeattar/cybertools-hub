import { NextRequest, NextResponse } from "next/server";
import { deleteCurrentSession, SESSION_COOKIE } from "@/lib/auth";

export async function POST(request: NextRequest) {
  await deleteCurrentSession(request.cookies.get(SESSION_COOKIE)?.value);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return response;
}
