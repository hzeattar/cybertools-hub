import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { ToolConsole } from "@/components/ToolConsole";

export const metadata: Metadata = {
  title: "Scope Guard",
  description: "Convert bug bounty policy notes into a safer authorization checklist before testing.",
};

export default function ScopeGuardPage() {
  return (
    <SiteShell>
      <section className="section">
        <div className="container">
          <p className="eyebrow">Assistant</p>
          <h1 className="hero-title" style={{ fontSize: 48 }}>
            Scope Guard
          </h1>
          <p className="hero-copy">
            Paste policy notes and convert them into in-scope candidates, blocking rules, and pre-test reminders.
          </p>
          <div style={{ marginTop: 22 }}>
            <ToolConsole slug="scope-checklist-generator" name="Scope Checklist Generator" />
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
