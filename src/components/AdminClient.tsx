"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/lib/payment";
import type { SupportMessage } from "@/lib/support-store";

export function AdminClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [message, setMessage] = useState("Loading admin workspace...");
  const [busyOrderId, setBusyOrderId] = useState("");
  const [busySupportId, setBusySupportId] = useState("");

  async function loadAdminData() {
    const [ordersResponse, supportResponse] = await Promise.all([fetch("/api/admin/orders"), fetch("/api/admin/support")]);
    if (!ordersResponse.ok || !supportResponse.ok) {
      setMessage("Admin session required.");
      return;
    }
    const ordersData = (await ordersResponse.json()) as { orders: Order[] };
    const supportData = (await supportResponse.json()) as { messages: SupportMessage[] };
    setOrders(ordersData.orders);
    setSupportMessages(supportData.messages);
    setMessage(`Loaded ${ordersData.orders.length} orders and ${supportData.messages.length} support messages.`);
  }

  useEffect(() => {
    void loadAdminData();
  }, []);

  async function approveOrder(order: Order) {
    const reference = window.prompt("Manual approval reference", `manual-${order.id}`);
    if (reference === null) return;
    setBusyOrderId(order.id);
    const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reference }),
    });
    const data = (await response.json().catch(() => ({}))) as { order?: Order; message?: string; error?: string };
    if (!response.ok) {
      setMessage(data.error ?? "Manual approval failed.");
      setBusyOrderId("");
      return;
    }
    if (data.order) setOrders((current) => current.map((item) => (item.id === data.order?.id ? data.order : item)));
    setMessage(data.message ?? "Order manually approved.");
    setBusyOrderId("");
  }

  async function updateSupportStatus(support: SupportMessage, status: SupportMessage["status"]) {
    setBusySupportId(support.id);
    const response = await fetch(`/api/admin/support/${encodeURIComponent(support.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = (await response.json().catch(() => ({}))) as { message?: SupportMessage; error?: string };
    if (!response.ok || !data.message) {
      setMessage(data.error ?? "Support update failed.");
      setBusySupportId("");
      return;
    }
    setSupportMessages((current) => current.map((item) => (item.id === data.message?.id ? data.message : item)));
    setMessage(`Support message marked ${data.message.status}.`);
    setBusySupportId("");
  }

  return (
    <section className="admin-workspace">
      <div className="panel admin-toolbar">
        <div>
          <p className="eyebrow">Admin control</p>
          <h2>Orders and support</h2>
          <p className="muted">{message}</p>
        </div>
        <button className="btn primary" type="button" onClick={loadAdminData}>
          Refresh
        </button>
      </div>

      <div className="admin-grid">
        <section className="panel">
          <div className="section-header compact">
            <div>
              <h2>Recent orders</h2>
              <p>Approve verified manual deposits or inspect checkout state.</p>
            </div>
          </div>
          <div className="admin-list">
            {orders.length ? (
              orders.map((order) => (
                <article className="admin-row" key={order.id}>
                  <div>
                    <div className="tag-row">
                      <span className={`status ${order.status}`}>{order.status}</span>
                      <span className="tag">{order.kind}</span>
                    </div>
                    <h3>{order.productName}</h3>
                    <p className="mono">{order.id}</p>
                    <p className="muted">User: {order.userId ?? "legacy order"}</p>
                  </div>
                  <div>
                    <p className="mono">{order.expectedAmount} USDT</p>
                    <p className="muted">{order.txHash ?? "No transaction/reference yet"}</p>
                    <div className="button-row tight">
                      {order.status !== "paid" ? (
                        <button
                          className="btn primary"
                          type="button"
                          disabled={busyOrderId === order.id}
                          onClick={() => void approveOrder(order)}
                        >
                          {busyOrderId === order.id ? "Approving" : "Manual approve"}
                        </button>
                      ) : null}
                      <a className="btn secondary" href={`/checkout/${order.id}`}>
                        Open checkout
                      </a>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">No orders yet.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="section-header compact">
            <div>
              <h2>Support inbox</h2>
              <p>Messages from the Talk to support button and contact page.</p>
            </div>
          </div>
          <div className="admin-list">
            {supportMessages.length ? (
              supportMessages.map((support) => (
                <article className="admin-row support-row" key={support.id}>
                  <div>
                    <div className="tag-row">
                      <span className={`status ${support.status === "open" ? "pending" : "paid"}`}>{support.status}</span>
                      {support.orderId ? <span className="tag">order</span> : null}
                    </div>
                    <h3>{support.subject}</h3>
                    <p className="mono">{support.email}</p>
                    {support.orderId ? <p className="mono">{support.orderId}</p> : null}
                    <p className="muted">{new Date(support.createdAt).toLocaleString()}</p>
                  </div>
                  <div>
                    <p>{support.body}</p>
                    <div className="button-row tight">
                      <button
                        className="btn secondary"
                        type="button"
                        disabled={busySupportId === support.id || support.status === "closed"}
                        onClick={() => void updateSupportStatus(support, "closed")}
                      >
                        Close
                      </button>
                      <button
                        className="btn secondary"
                        type="button"
                        disabled={busySupportId === support.id || support.status === "open"}
                        onClick={() => void updateSupportStatus(support, "open")}
                      >
                        Reopen
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="muted">No support messages yet.</p>
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
