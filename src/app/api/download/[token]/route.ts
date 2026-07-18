import { NextResponse } from "next/server";
import { buildDigitalProductMarkdown } from "@/lib/digital-products";
import { getOrder } from "@/lib/order-store";
import { verifyDownloadToken } from "@/lib/payment";

type RouteContext = {
  params: Promise<{ token: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { token } = await context.params;
  const payload = verifyDownloadToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired download token." }, { status: 403 });
  }

  const order = await getOrder(payload.orderId);
  if (!order || order.status !== "paid") {
    return NextResponse.json({ error: "Order is not paid." }, { status: 403 });
  }

  const content = buildDigitalProductMarkdown(payload.productSlug);
  if (!content) {
    return NextResponse.json({ error: "Product file not found." }, { status: 404 });
  }

  return new NextResponse(content, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${payload.productSlug}.md"`,
      "cache-control": "private, no-store",
    },
  });
}
