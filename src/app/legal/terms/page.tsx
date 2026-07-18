import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "CyberTools Hub terms for authorized testing and digital downloads.",
};

export default function TermsPage() {
  return (
    <SiteShell>
      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          <h1 className="hero-title" style={{ fontSize: 44 }}>
            Terms of Use
          </h1>
          <div className="panel">
            <p>
              CyberTools Hub is provided for authorized security research, internal application security, education, and
              responsible disclosure workflows.
            </p>
            <p>
              You are responsible for following program rules, laws, rate limits, and data handling requirements. The
              platform does not grant permission to test any third-party system.
            </p>
            <p>
              Digital products are delivered after payment verification. Crypto payments are irreversible, so always
              confirm network, token, address, and exact amount before sending.
            </p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
