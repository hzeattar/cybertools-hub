"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function LogoutClient() {
  const router = useRouter();

  useEffect(() => {
    async function logout() {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    }
    void logout();
  }, [router]);

  return (
    <section className="panel">
      <p className="eyebrow">Session</p>
      <h1 className="hero-title compact-title">Logging out</h1>
      <p className="hero-copy">Clearing your CyberTools Hub session.</p>
    </section>
  );
}
