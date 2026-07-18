"use client";

import { useState } from "react";
import type { Order } from "@/lib/payment";

export function AdminClient() {
  const [password, setPassword] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [message, setMessage] = useState("Enter the admin password to load recent orders.");

  async function loadOrders() {
    const response = await fetch("/api/admin/orders", {
      headers: { "x-admin-password": password },
    });
    if (!response.ok) {
      setMessage("Admin authentication failed.");
      return;
    }
    const data = (await response.json()) as { orders: Order[] };
    setOrders(data.orders);
    setMessage(`Loaded ${data.orders.length} orders.`);
  }

  return (
    <section className="panel">
      <div className="field">
        <label>Admin password</label>
        <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      <button className="btn primary" type="button" onClick={loadOrders}>
        Load orders
      </button>
      <p className="muted" style={{ marginTop: 12 }}>
        {message}
      </p>
      <div className="grid" style={{ marginTop: 18 }}>
        {orders.map((order) => (
          <article className="card product-card" key={order.id}>
            <h3>{order.productName}</h3>
            <p className="mono">{order.id}</p>
            <p className={`status ${order.status}`}>{order.status}</p>
            <p className="mono">{order.expectedAmount} USDT</p>
            <p className="muted">{order.txHash ?? "No transaction yet"}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
