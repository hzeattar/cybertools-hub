import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    ok: true,
    service: "cybertools-hub",
    time: new Date().toISOString(),
  });
}
