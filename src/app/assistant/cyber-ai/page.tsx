import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CyberAiClient } from "@/components/CyberAiClient";
import { SiteShell } from "@/components/SiteShell";
import { getCurrentUser } from "@/lib/auth";
import { hasActiveEntitlement } from "@/lib/order-store";

export const metadata: Metadata = {
  title: "Cyber AI Analyst",
  description:
    "Multi-provider defensive cyber security analyst with safe local fallback for authorized testing, reports, OpenAPI review, and threat modeling.",
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
      <section className="ai-hero-section">
        <div className="container ai-hero-grid">
          <div>
            <p className="eyebrow">Defensive AI operations</p>
            <h1 className="hero-title compact-title">Cyber AI Analyst</h1>
            <p className="hero-copy">
              Security review console for headers, OpenAPI surfaces, code snippets, threat models, and report writing.
              It routes through configured model providers and falls back to a local defensive analyst when providers fail.
            </p>
            <div className="button-row ai-hero-actions">
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
          </div>
          <aside className="panel ai-preview-panel">
            <div className="ai-preview-image">
              <Image
                src="/images/cyber-ai-workspace-hero.webp"
                alt="Cyber AI workspace preview with conversations, memory context, and provider status"
                width={1600}
                height={1067}
                priority
              />
            </div>
            <div className="ai-signal-row">
              <span>Provider chain</span>
              <strong>AgentRouter {"->"} OpenRouter {"->"} Groq {"->"} Local</strong>
            </div>
            <div className="ai-signal-row">
              <span>Prompt storage</span>
              <strong>Disabled by default</strong>
            </div>
            <div className="ai-signal-row">
              <span>Mode</span>
              <strong>{pro ? "AI Pro" : "Free analyst"}</strong>
            </div>
          </aside>
        </div>
      </section>
      <section className="section ai-main-section">
        <div className="container">
          <CyberAiClient signedIn={Boolean(user)} pro={pro} />
        </div>
      </section>
      <section className="section alt-band">
        <div className="container grid grid-3">
          {[
            ["Allowed", "Defensive analysis, authorized testing plans, report drafting, secure code/config review."],
            ["Blocked", "Malware, phishing, credential theft, persistence, and unauthorized exploitation."],
            ["Resilience", "External providers are optional. Local fallback keeps the analyst usable while keys or quotas are fixed."],
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
