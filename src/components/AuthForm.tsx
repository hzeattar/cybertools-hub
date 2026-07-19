"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Props = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setMessage(data.error ?? "Authentication failed.");
      return;
    }
    router.push(searchParams.get("next") || "/account");
    router.refresh();
  }

  return (
    <form className="panel auth-panel" onSubmit={submit}>
      <div className="field">
        <label htmlFor={`${mode}-email`}>Email</label>
        <input
          id={`${mode}-email`}
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor={`${mode}-password`}>Password</label>
        <input
          id={`${mode}-password`}
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
      </div>
      <button className="btn primary" type="submit" disabled={loading}>
        {loading ? "Processing" : mode === "login" ? "Login" : "Create account"}
      </button>
      {message ? <p className="status expired">{message}</p> : null}
    </form>
  );
}
