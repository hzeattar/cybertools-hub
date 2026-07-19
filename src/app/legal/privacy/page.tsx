import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "CyberTools Hub privacy policy for accounts, local tools, Cyber AI, checkout, and downloads.",
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
              Checkout pages store order metadata needed to verify payment, attach purchases to your account, and deliver
              downloads.
            </p>
            <p>
              Account data includes email, password hash, session metadata, orders, entitlements, and AI usage counters.
              Stored order data can include product name, expected amount, receiving wallet, transaction hash, timestamps,
              and download token hashes.
            </p>
            <p>
              Cyber AI prompts are sent to the configured AgentRouter API to generate responses, but CyberTools Hub does
              not store prompt text by default. Do not paste private keys, live credentials, or third-party personal data.
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
