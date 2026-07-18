import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { CheckoutClient } from "@/components/CheckoutClient";
import { getOrder } from "@/lib/order-store";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage({ params }: PageProps) {
  const { orderId } = await params;
  const order = await getOrder(orderId);
  if (!order) notFound();

  return (
    <SiteShell>
      <section className="section">
        <div className="container">
          <CheckoutClient initialOrder={order} />
        </div>
      </section>
    </SiteShell>
  );
}
