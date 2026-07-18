import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { ToolConsole } from "@/components/ToolConsole";

export const metadata: Metadata = {
  title: "Bug Bounty Report Builder",
  description: "Build evidence-first vulnerability reports with redaction and triage-friendly structure.",
};

export default function ReportBuilderPage() {
  return (
    <SiteShell>
      <section className="section">
        <div className="container">
          <p className="eyebrow">Assistant</p>
          <h1 className="hero-title" style={{ fontSize: 48 }}>
            Evidence-first report builder
          </h1>
          <p className="hero-copy">
            Draft concise vulnerability reports from facts you can reproduce. The tool masks common secrets in pasted
            evidence before output.
          </p>
          <div style={{ marginTop: 22 }}>
            <ToolConsole slug="bug-bounty-report-formatter" name="Bug Bounty Report Formatter" />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
