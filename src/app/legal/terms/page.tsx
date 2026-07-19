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
              Cyber AI Analyst is limited to defensive security, authorized testing, report writing, code/config review,
              and safe planning. Requests for malware, phishing, credential theft, persistence, or unauthorized
              exploitation are not allowed.
            </p>
            <p>
              Cyber AI memory is user-approved context retrieval, not automatic model training. You are responsible for
              approving only stable, non-secret context and deleting memory suggestions that should not be reused.
            </p>
            <p>
              AI output can come from configured external providers or the local defensive fallback. You must review
              results before relying on them for reports, remediation decisions, or customer communication.
            </p>
            <p>
              Digital products are delivered after payment verification. Crypto payments are irreversible, so always
              confirm network, token, address, and exact amount before sending.
            </p>
            <p>
              AI Pro Pass is a 30-day access entitlement after verified payment. It is not an automatic recurring
              subscription because USDT TRC20 wallet payments do not support recurring debits from the user wallet.
            </p>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
