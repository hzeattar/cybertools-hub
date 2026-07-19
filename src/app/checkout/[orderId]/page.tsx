import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { CheckoutClient } from "@/components/CheckoutClient";
import { getOrder } from "@/lib/order-store";
import { getCurrentUser } from "@/lib/auth";

type PageProps = {
  params: Promise<{ orderId: string }>;
};

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CheckoutPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const { orderId } = await params;
  const order = await getOrder(orderId);
  if (!order) notFound();
  if (order.userId !== user.id && user.role !== "admin") notFound();

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
