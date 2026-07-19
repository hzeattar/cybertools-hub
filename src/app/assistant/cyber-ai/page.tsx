import type { Metadata } from "next";
import Link from "next/link";
import { CyberAiClient } from "@/components/CyberAiClient";
import { SiteShell } from "@/components/SiteShell";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveEntitlement } from "@/lib/order-store";

export const metadata: Metadata = {
  title: "Cyber AI Analyst",
  description: "AI-assisted defensive security analysis for authorized testing, reports, OpenAPI review, and threat modeling.",
  alternates: { canonical: "/assistant/cyber-ai" },
  openGraph: {
    title: "Cyber AI Analyst - CyberTools Hub",
    description: "A defensive cyber security AI assistant for authorized security research workflows.",
    url: "/assistant/cyber-ai",
  },
};

export default async function CyberAiPage() {
  const user = await getCurrentUser();
  const pro = user ? await hasActiveEntitlement(user.id, "ai_pro") : false;

  return (
    <SiteShell>
      <section className="section">
        <div className="container">
          <p className="eyebrow">AI security analyst</p>
          <h1 className="hero-title compact-title">Cyber AI Analyst</h1>
          <p className="hero-copy">
            Ask for defensive code review, header analysis, OpenAPI risk ranking, report wording, scope-safe test plans,
            or threat modeling. The API key stays server-side and prompts are not stored.
          </p>
          <div className="button-row" style={{ marginBottom: 22, marginTop: 18 }}>
            {!user ? (
              <Link className="btn primary" href="/login?next=/assistant/cyber-ai">
                Login to use AI
              </Link>
            ) : null}
            {!pro ? (
              <Link className="btn secondary" href="/store/ai-pro-pass-30-days">
                Upgrade to AI Pro
              </Link>
            ) : null}
          </div>
          <CyberAiClient signedIn={Boolean(user)} pro={pro} />
        </div>
      </section>
      <section className="section alt-band">
        <div className="container grid grid-3">
          {[
            ["Allowed", "Defensive analysis, authorized testing plans, report drafting, secure code/config review."],
            ["Blocked", "Malware, phishing, credential theft, persistence, and unauthorized exploitation."],
            ["Limits", "Free users get daily balanced usage. AI Pro unlocks a higher daily limit for 30 days."],
          ].map(([title, body]) => (
            <article className="card guide-card" key={title}>
              <h3>{title}</h3>
              <p className="muted">{body}</p>
            </article>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}
