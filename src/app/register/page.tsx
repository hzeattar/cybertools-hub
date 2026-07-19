import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Create Account",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <SiteShell>
      <section className="section">
        <div className="container auth-layout">
          <div>
            <p className="eyebrow">Research account</p>
            <h1 className="hero-title compact-title">Create your workspace</h1>
            <p className="hero-copy">Keep purchases, AI Pro access, and signed download links tied to one account.</p>
            <p className="muted" style={{ marginTop: 18 }}>
              Already registered? <Link className="inline-link" href="/login">Login</Link>.
            </p>
          </div>
          <Suspense fallback={<div className="panel">Loading form...</div>}>
            <AuthForm mode="register" />
          </Suspense>
        </div>
      </section>
    </SiteShell>
  );
}
