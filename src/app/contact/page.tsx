import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { SupportForm } from "@/components/SupportForm";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact CyberTools Hub for product support and responsible feedback.",
};

export const dynamic = "force-dynamic";

export default async function ContactPage() {
  const user = await getCurrentUser();

  return (
    <SiteShell>
      <section className="section">
        <div className="container" style={{ maxWidth: 760 }}>
          <p className="eyebrow">Support</p>
          <h1 className="hero-title" style={{ fontSize: 44 }}>
            Contact CyberTools Hub
          </h1>
          <SupportForm email={user?.email} />
        </div>
      </section>
    </SiteShell>
  );
}
