import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact CyberTools Hub for product support and responsible feedback.",
};

export default function ContactPage() {
  return (
    <SiteShell>
      <section className="section">
        <div className="container" style={{ maxWidth: 760 }}>
          <p className="eyebrow">Support</p>
          <h1 className="hero-title" style={{ fontSize: 44 }}>
            Contact CyberTools Hub
          </h1>
          <div className="panel">
            <p>
              For product support, include your order ID and transaction hash. Do not send secrets, private keys, or
              third-party personal data.
            </p>
            <p style={{ marginTop: 16 }}>
              <a className="btn primary" href="mailto:support@example.com?subject=CyberTools%20Hub%20support">
                Email support
              </a>
            </p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
