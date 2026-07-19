import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { products } from "@/data/catalog";
import { SiteShell } from "@/components/SiteShell";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { issueDownloadToken } from "@/lib/payment";
import { listEntitlementsForUser, listOrders } from "@/lib/order-store";

export const metadata: Metadata = {
  title: "Account",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const [orders, entitlements] = await Promise.all([listOrders({ userId: user.id }), listEntitlementsForUser(user.id)]);
  const publicProfile = publicUser(user);
  const activeAiPro = entitlements.find(
    (item) => item.kind === "ai_pro" && (!item.expiresAt || new Date(item.expiresAt).getTime() > Date.now()),
  );
  const productEntitlements = entitlements.filter((item) => item.kind === "product");

  return (
    <SiteShell>
      <section className="section">
        <div className="container">
          <p className="eyebrow">Research workspace</p>
          <h1 className="hero-title compact-title">Account console</h1>
          <div className="grid grid-3" style={{ marginTop: 22 }}>
            <div className="metric">
              <span>Email</span>
              <strong className="mono">{publicProfile.email}</strong>
            </div>
            <div className="metric">
              <span>Role</span>
              <strong>{publicProfile.role}</strong>
            </div>
            <div className="metric">
              <span>AI Pro</span>
              <strong>{activeAiPro?.expiresAt ? `Until ${new Date(activeAiPro.expiresAt).toLocaleDateString()}` : "Inactive"}</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="section alt-band">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Owned products</h2>
              <p>Your paid downloads stay available from this account.</p>
            </div>
            <Link className="btn secondary" href="/store">
              Store
            </Link>
          </div>
          <div className="grid grid-3">
            {productEntitlements.length ? (
              productEntitlements.map((entitlement) => {
                const product = products.find((item) => item.slug === entitlement.productSlug);
                const token = issueDownloadToken({ id: entitlement.sourceOrderId, productSlug: entitlement.productSlug });
                return (
                  <article className="card product-card" key={entitlement.id}>
                    <span className="tag teal">owned</span>
                    <h3>{product?.name ?? entitlement.productSlug}</h3>
                    <p className="muted">{product?.summary ?? "Digital product entitlement."}</p>
                    <Link className="btn primary" href={`/download/${token}`}>
                      Open download
                    </Link>
                  </article>
                );
              })
            ) : (
              <article className="panel">
                <p className="muted">No paid products yet.</p>
              </article>
            )}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <div>
              <h2>Recent orders</h2>
              <p>Pending payments, verified purchases, and expired checkout windows.</p>
            </div>
          </div>
          <div className="grid">
            {orders.length ? (
              orders.map((order) => (
                <article className="card order-row" key={order.id}>
                  <div>
                    <h3>{order.productName}</h3>
                    <p className="mono">{order.id}</p>
                  </div>
                  <p className={`status ${order.status}`}>{order.status}</p>
                  <p className="mono">{order.expectedAmount} USDT</p>
                  <Link className="btn secondary" href={`/checkout/${order.id}`}>
                    Open
                  </Link>
                </article>
              ))
            ) : (
              <article className="panel">
                <p className="muted">No orders yet.</p>
              </article>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
