"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import QRCode from "qrcode";
import type { Order } from "@/lib/payment";

function formatUtcTime(value: string) {
  const date = new Date(value);
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds} UTC`;
}

export function CheckoutClient({ initialOrder }: { initialOrder: Order }) {
  const [order, setOrder] = useState(initialOrder);
  const [downloadToken, setDownloadToken] = useState<string | null>(null);
  const [message, setMessage] = useState("Waiting for a matching USDT TRC20 transfer.");
  const [qrUrl, setQrUrl] = useState("");

  const paymentText = useMemo(
    () => `USDT TRC20\nAddress: ${order.receiverAddress}\nAmount: ${order.expectedAmount}\nOrder: ${order.id}`,
    [order],
  );
  useEffect(() => {
    QRCode.toDataURL(paymentText, { width: 220, margin: 1, color: { dark: "#06130f", light: "#f8fffb" } })
      .then(setQrUrl)
      .catch(() => setQrUrl(""));
  }, [paymentText]);

  async function verify() {
    const response = await fetch(`/api/orders/${order.id}/verify`, { method: "POST" });
    const data = (await response.json()) as { order?: Order; downloadToken?: string; message?: string };
    if (data.order) setOrder(data.order);
    if (data.downloadToken) setDownloadToken(data.downloadToken);
    if (data.message) setMessage(data.message);
  }

  useEffect(() => {
    if (order.status !== "pending") return;
    const timer = window.setInterval(() => {
      void verify();
    }, 15000);
    return () => window.clearInterval(timer);
  });

  return (
    <div className="checkout-grid">
      <section className="panel">
        <p className={`status ${order.status}`}>{order.status.toUpperCase()}</p>
        <h1 className="hero-title" style={{ fontSize: 42 }}>
          Complete USDT TRC20 payment
        </h1>
        <p className="hero-copy">
          Send the exact amount below from a wallet that supports USDT on TRON. The unique amount identifies this order
          automatically.
        </p>

        <div className="split" style={{ marginTop: 18 }}>
          <div className="metric">
            <span>Amount</span>
            <strong>{order.expectedAmount} USDT</strong>
          </div>
          <div className="metric">
            <span>Expires</span>
            <strong>{formatUtcTime(order.expiresAt)}</strong>
          </div>
        </div>

        <div className="field" style={{ marginTop: 18 }}>
          <label>Receiving wallet</label>
          <p className="mono">{order.receiverAddress}</p>
        </div>

        <div className="button-row">
          <button className="btn primary" type="button" onClick={verify}>
            Verify payment
          </button>
          <button className="btn secondary" type="button" onClick={() => navigator.clipboard.writeText(order.receiverAddress)}>
            Copy address
          </button>
          <button className="btn secondary" type="button" onClick={() => navigator.clipboard.writeText(order.expectedAmount)}>
            Copy amount
          </button>
        </div>

        <p className="muted" style={{ marginTop: 14 }}>
          {message}
        </p>
        {downloadToken ? (
          <p style={{ marginTop: 18 }}>
            <Link className="btn primary" href={`/download/${downloadToken}`}>
              Open download
            </Link>
          </p>
        ) : null}
      </section>
      <aside className="qr-box">
        {qrUrl ? (
          <Image src={qrUrl} alt="USDT TRC20 payment QR code" width={220} height={220} unoptimized />
        ) : (
          <div className="qr-placeholder">QR</div>
        )}
        <p className="mono" style={{ marginTop: 12, textAlign: "center" }}>
          {order.productName}
        </p>
      </aside>
    </div>
  );
}
