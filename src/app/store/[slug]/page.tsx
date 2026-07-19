import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getProduct, products } from "@/data/catalog";
import { SiteShell } from "@/components/SiteShell";
import { StoreClient } from "@/components/StoreClient";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveEntitlement } from "@/lib/order-store";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  return {
    title: product.name,
    description: product.seo,
    alternates: { canonical: `/store/${product.slug}` },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  const user = await getCurrentUser();
  const owned = user ? await hasActiveEntitlement(user.id, product.kind, product.kind === "product" ? product.slug : undefined) : false;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.seo,
    offers: {
      "@type": "Offer",
      price: product.priceUsdt.toFixed(2),
      priceCurrency: "USDT",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <SiteShell>
      <section className="section">
        <div className="container checkout-grid">
          <div>
            <p className="eyebrow">{product.kind === "ai_pro" ? "AI subscription pass" : "Digital download"}</p>
            <h1 className="hero-title" style={{ fontSize: 48 }}>
              {product.name}
            </h1>
            <p className="hero-copy">{product.summary}</p>
            <div className="price" style={{ marginTop: 18 }}>
              {product.priceUsdt.toFixed(2)} USDT
            </div>
            <StoreClient productSlug={product.slug} signedIn={Boolean(user)} owned={owned} />
          </div>
          <aside className="panel product-detail-panel">
            <div className="product-detail-image">
              <Image src={product.image} alt={`${product.name} product preview`} width={900} height={600} priority />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800 }}>What is included</h2>
            <ul style={{ marginTop: 14, paddingLeft: 18 }}>
              {product.deliverables.map((item) => (
                <li key={item} style={{ marginBottom: 10 }}>
                  {item}
                </li>
              ))}
            </ul>
            <p className="muted" style={{ marginTop: 14 }}>
              Built for authorized testing, repeatable evidence collection, concise reports, and defensive AI-assisted
              review.
            </p>
          </aside>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
    </SiteShell>
  );
}
