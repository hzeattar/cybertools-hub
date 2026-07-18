import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import { AdminClient } from "@/components/AdminClient";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <SiteShell>
      <section className="section">
        <div className="container">
          <h1 className="hero-title" style={{ fontSize: 44 }}>
            Order admin
          </h1>
          <AdminClient />
        </div>
      </section>
    </SiteShell>
  );
}
