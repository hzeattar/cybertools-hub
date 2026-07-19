import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, isValidEmail } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createSupportMessage } from "@/lib/support-store";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = rateLimit(`support:${ip}`, 8, 60_000);
  if (!limit.ok) return NextResponse.json({ error: "Too many support messages." }, { status: 429 });

  const user = await getCurrentUser();
  const body = (await request.json().catch(() => null)) as {
    email?: string;
    subject?: string;
    message?: string;
    orderId?: string;
  } | null;

  const email = (user?.email ?? body?.email ?? "").trim().toLowerCase();
  const subject = (body?.subject ?? "").trim();
  const message = (body?.message ?? "").trim();
  const orderId = (body?.orderId ?? "").trim();

  if (!isValidEmail(email)) return NextResponse.json({ error: "Enter a valid support email." }, { status: 400 });
  if (subject.length < 4 || subject.length > 120) {
    return NextResponse.json({ error: "Subject must be between 4 and 120 characters." }, { status: 400 });
  }
  if (message.length < 12 || message.length > 4000) {
    return NextResponse.json({ error: "Message must be between 12 and 4000 characters." }, { status: 400 });
  }

  const supportMessage = await createSupportMessage({
    userId: user?.id,
    email,
    subject,
    body: message,
    orderId: orderId || undefined,
  });

  return NextResponse.json({
    message: "Support message received.",
    supportMessage: {
      id: supportMessage.id,
      status: supportMessage.status,
      createdAt: supportMessage.createdAt,
    },
  });
}
