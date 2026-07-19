import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { products } from "@/data/catalog";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Security Research Store",
  description: "Buy bug bounty templates, API security checklists, and report packs with USDT TRC20.",
};

export default function StorePage() {
  return (
    <SiteShell>
      <section className="section">
        <div className="container">
          <div className="store-hero">
            <div>
              <p className="eyebrow">USDT TRC20 store</p>
              <h1 className="hero-title compact-title">Security research products and AI Pro access.</h1>
              <p className="hero-copy">
                Digital products get signed downloads. AI Pro Pass unlocks higher Cyber AI limits for 30 days after
                payment.
              </p>
            </div>
            <div className="store-flow panel" aria-label="Payment and delivery flow">
              <div>
                <span>1</span>
                <strong>Create order</strong>
                <small>Login tied checkout</small>
              </div>
              <div>
                <span>2</span>
                <strong>Pay USDT TRC20</strong>
                <small>Unique amount match</small>
              </div>
              <div>
                <span>3</span>
                <strong>Unlock access</strong>
                <small>Download or AI Pro</small>
              </div>
            </div>
          </div>
          <div className="grid product-grid" style={{ marginTop: 24 }}>
            {products.map((product) => (
              <Link className="card product-card" href={`/store/${product.slug}`} key={product.slug}>
                <span className="product-thumb">
                  <Image src={product.image} alt={`${product.name} preview`} width={900} height={600} loading="eager" />
                </span>
                <span className="price">{product.priceUsdt.toFixed(2)} USDT</span>
                <h3>{product.name}</h3>
                <p className="muted">{product.summary}</p>
                <div className="tag-row">
                  <span className="tag teal">{product.kind === "ai_pro" ? "30-day pass" : "instant delivery"}</span>
                  <span className="tag">TRC20</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
