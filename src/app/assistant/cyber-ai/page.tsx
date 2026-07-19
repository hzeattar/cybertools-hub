import type { Metadata } from "next";
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
    <SiteShell hideFooter wide>
      <section className="ai-app-section">
        <div className="ai-app-container">
          <CyberAiClient signedIn={Boolean(user)} pro={pro} />
        </div>
      </section>
    </SiteShell>
  );
}
