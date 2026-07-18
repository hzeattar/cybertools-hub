"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StoreClient({ productSlug }: { productSlug: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function createOrder() {
    setState("loading");
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ productSlug }),
    });

    if (!response.ok) {
      setState("error");
      return;
    }
    const data = (await response.json()) as { orderId: string };
    router.push(`/checkout/${data.orderId}`);
  }

  return (
    <div className="button-row">
      <button className="btn primary" type="button" onClick={createOrder} disabled={state === "loading"}>
        {state === "loading" ? "Creating order" : "Pay with USDT TRC20"}
      </button>
      {state === "error" ? <span className="status expired">Order creation failed</span> : null}
    </div>
  );
}
