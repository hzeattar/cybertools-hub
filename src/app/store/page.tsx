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
            Downloadable security research products.
          </h1>
          <p className="hero-copy">
            Products are delivered with signed download tokens after checkout detects the matching USDT TRC20 transfer.
          </p>
          <div className="grid grid-4" style={{ marginTop: 24 }}>
            {products.map((product) => (
              <Link className="card product-card" href={`/store/${product.slug}`} key={product.slug}>
                <span className="price">{product.priceUsdt.toFixed(2)} USDT</span>
                <h3>{product.name}</h3>
                <p className="muted">{product.summary}</p>
                <div className="tag-row">
                  <span className="tag teal">instant delivery</span>
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
