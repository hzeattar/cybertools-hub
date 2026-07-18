import type { Metadata } from "next";
import Link from "next/link";
import { tools } from "@/data/catalog";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Free Security Tools",
  description:
    "Free browser-first tools for JWT decoding, security headers, CORS, CSP, cookies, CVSS, and bug bounty reporting.",
};

export default function ToolsPage() {
  return (
    <SiteShell>
      <section className="section">
        <div className="container">
          <div className="section-header">
            <div>
              <p className="eyebrow">Tool library</p>
              <h1 className="hero-title" style={{ fontSize: 48 }}>
                Free security tools for authorized testing.
              </h1>
              <p className="hero-copy">
                Each tool produces useful notes for reports without running hidden scans or storing inputs.
              </p>
            </div>
          </div>
          <div className="grid grid-4">
            {tools.map((tool) => (
              <Link className="card tool-card" href={`/tools/${tool.slug}`} key={tool.slug}>
                <div className="tag-row">
                  <span className="tag">{tool.category}</span>
                  <span className="tag teal">client-side</span>
                </div>
                <h3>{tool.name}</h3>
                <p className="muted">{tool.summary}</p>
                <span className="btn secondary">Open</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
