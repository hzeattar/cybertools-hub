"use client";

import { useState } from "react";
import type { Order } from "@/lib/payment";

export function AdminClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("Load recent orders for this environment.");

  async function loadOrders() {
    const response = await fetch("/api/admin/orders");
    if (!response.ok) {
      setMessage("Admin session required.");
      return;
    }
    const data = (await response.json()) as { orders: Order[] };
    setOrders(data.orders);
    setMessage(`Loaded ${data.orders.length} orders.`);
  }

  return (
    <section className="panel">
      <button className="btn primary" type="button" onClick={loadOrders}>
        Load orders
      </button>
      <p className="muted" style={{ marginTop: 12 }}>
        {message}
      </p>
      <div className="grid" style={{ marginTop: 18 }}>
        {orders.map((order) => (
          <article className="card product-card" key={order.id}>
            <div className="tag-row">
              <span className={`status ${order.status}`}>{order.status}</span>
              <span className="tag">{order.kind}</span>
            </div>
            <h3>{order.productName}</h3>
            <p className="mono">{order.id}</p>
            <p className="mono">{order.expectedAmount} USDT</p>
            <p className="muted">{order.txHash ?? "No transaction yet"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
