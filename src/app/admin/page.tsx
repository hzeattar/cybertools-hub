import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteShell } from "@/components/SiteShell";
import { AdminClient } from "@/components/AdminClient";
import { ensureBootstrapAdmin, getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  await ensureBootstrapAdmin();
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") notFound();

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
