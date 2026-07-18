import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "CyberTools Hub privacy policy for local tools, checkout, and digital downloads.",
};

export default function PrivacyPage() {
  return (
    <SiteShell>
      <section className="section">
        <div className="container" style={{ maxWidth: 860 }}>
          <h1 className="hero-title" style={{ fontSize: 44 }}>
            Privacy Policy
          </h1>
          <div className="panel">
            <p>
              Most tools run in your browser and do not send pasted tokens, headers, JSON, or evidence to the server.
              Checkout pages store order metadata needed to verify payment and deliver downloads.
            </p>
            <p>
              Stored order data can include product name, expected amount, receiving wallet, transaction hash, timestamps,
              and download token hashes. Do not paste secrets into contact messages.
            </p>
            <p>
              Server logs may include IP address, browser metadata, and API route timestamps for security and abuse
              prevention.
            </p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
