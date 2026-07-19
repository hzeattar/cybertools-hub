import { NextRequest, NextResponse } from "next/server";
import { getOrder, isTransactionUsed, markOrderExpired, markOrderPaid } from "@/lib/order-store";
import { hashToken, isExpired, issueDownloadToken } from "@/lib/payment";
import { fetchRecentUsdtTransfers, findMatchingTransfer } from "@/lib/tronscan";
import { rateLimit } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Login required." }, { status: 401 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const limit = rateLimit(`verify:${ip}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many verification attempts." }, { status: 429 });
  }

  const { id } = await context.params;
  const order = await getOrder(id);
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }
  if (order.userId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.status === "paid") {
    const token = order.kind === "product" ? issueDownloadToken(order) : undefined;
    return NextResponse.json({ order, downloadToken: token, message: "Payment already verified." });
  }

  if (isExpired(order)) {
    const expired = await markOrderExpired(order);
    return NextResponse.json({ order: expired, message: "Order expired. Create a fresh order." });
  }

  if (process.env.NODE_ENV !== "production" && request.nextUrl.searchParams.get("mock") === "paid") {
    const token = order.kind === "product" ? issueDownloadToken(order) : "";
    const paid = await markOrderPaid(order, `mock-${order.id}`, token ? hashToken(token) : "");
    return NextResponse.json({ order: paid, downloadToken: token || undefined, message: "Mock payment verified." });
  }

  if (!process.env.TRONSCAN_API_KEY) {
    return NextResponse.json({
      order,
      message: "TRONSCAN_API_KEY is not configured, so live payment verification is pending.",
    });
  }

  try {
    const payload = await fetchRecentUsdtTransfers(order.receiverAddress);
    const match = findMatchingTransfer(payload, {
      receiverAddress: order.receiverAddress,
      expectedAmountUnits: order.expectedAmountUnits,
      minTimestamp: new Date(order.createdAt).getTime() - 60_000,
    });

    if (!match) {
      return NextResponse.json({ order, message: "No matching confirmed USDT TRC20 transfer found yet." });
    }

    if (await isTransactionUsed(match.txHash)) {
      return NextResponse.json({ order, message: "Matching transaction was already used by another order." });
    }

    const token = order.kind === "product" ? issueDownloadToken(order) : "";
    const paid = await markOrderPaid(order, match.txHash, token ? hashToken(token) : "");
    return NextResponse.json({ order: paid, downloadToken: token || undefined, message: "Payment verified." });
  } catch (error) {
    return NextResponse.json(
      {
        order,
        message: `TRONSCAN verification failed: ${(error as Error).message}`,
      },
      { status: 502 },
    );
  }
}
