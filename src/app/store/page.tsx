import type { Metadata } from "next";
import Link from "next/link";
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
          <p className="eyebrow">USDT TRC20 store</p>
          <h1 className="hero-title" style={{ fontSize: 48 }}>
            Security research products and AI Pro access.
          </h1>
          <p className="hero-copy">
            Digital products get signed downloads. AI Pro Pass unlocks higher Cyber AI limits for 30 days after payment.
          </p>
          <div className="grid grid-4" style={{ marginTop: 24 }}>
            {products.map((product) => (
              <Link className="card product-card" href={`/store/${product.slug}`} key={product.slug}>
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
