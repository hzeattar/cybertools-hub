"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function StoreClient({ productSlug, signedIn, owned }: { productSlug: string; signedIn: boolean; owned: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  async function createOrder() {
    if (!signedIn) {
      router.push(`/login?next=/store/${productSlug}`);
      return;
    }
    if (owned) {
      router.push("/account");
      return;
    }
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
        {state === "loading" ? "Creating order" : owned ? "Open in account" : signedIn ? "Pay with USDT TRC20" : "Login to buy"}
      </button>
      {state === "error" ? <span className="status expired">Order creation failed</span> : null}
    </div>
  );
}
