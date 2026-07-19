import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Login",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <SiteShell>
      <section className="section">
        <div className="container auth-layout">
          <div>
            <p className="eyebrow">Account access</p>
            <h1 className="hero-title compact-title">Login to CyberTools Hub</h1>
            <p className="hero-copy">Orders, downloads, and Cyber AI usage are attached to your account.</p>
            <p className="muted" style={{ marginTop: 18 }}>
              New here? <Link className="inline-link" href="/register">Create an account</Link>.
            </p>
          </div>
          <Suspense fallback={<div className="panel">Loading form...</div>}>
            <AuthForm mode="login" />
          </Suspense>
        </div>
      </section>
    </SiteShell>
  );
}
