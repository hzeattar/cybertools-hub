import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { getOrder } from "@/lib/order-store";
import { verifyDownloadToken } from "@/lib/payment";
import { getProduct } from "@/data/catalog";
import { getCurrentUser } from "@/lib/auth";

type PageProps = {
  params: Promise<{ token: string }>;
};

export const metadata: Metadata = {
  title: "Download",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function DownloadPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const { token } = await params;
  const payload = verifyDownloadToken(token);
  if (!payload) notFound();
  const order = await getOrder(payload.orderId);
  const product = getProduct(payload.productSlug);
  if (!order || order.status !== "paid" || !product) notFound();
  if (order.userId !== user.id && user.role !== "admin") notFound();

  return (
    <SiteShell>
      <section className="section">
        <div className="container">
          <div className="panel">
            <p className="status paid">PAID</p>
            <h1 className="hero-title" style={{ fontSize: 44 }}>
              {product.name}
            </h1>
            <p className="hero-copy">Your signed download link is active for seven days from payment verification.</p>
            <p className="button-row">
              <a className="btn primary" href={`/api/download/${token}`}>
                Download Markdown pack
              </a>
            </p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
