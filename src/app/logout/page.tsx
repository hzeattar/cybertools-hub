import type { Metadata } from "next";
import { LogoutClient } from "@/components/LogoutClient";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Logout",
  robots: { index: false, follow: false },
};

export default function LogoutPage() {
  return (
    <SiteShell>
      <section className="section">
        <div className="container">
          <LogoutClient />
        </div>
      </section>
    </SiteShell>
  );
}
