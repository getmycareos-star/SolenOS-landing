"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/Button";
import { authenticateAccount } from "@/api/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await authenticateAccount("login", { email: email.trim(), password });
      router.replace("/workspace");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SolenOS could not sign you in. Check your details and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell activeHref="/login">
      <section className="public-section" style={{ maxWidth: 620, margin: "0 auto", paddingTop: "3rem", paddingBottom: "4rem" }}>
        <p className="public-eyebrow">SolenOS · Caregiver account</p>
        <h1 className="public-section-title">Log in</h1>
        <p className="public-prose">Sign in with the email and password you used to create your SolenOS account.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
          <label style={{ display: "grid", gap: ".4rem" }}>
            <span>Email address</span>
            <input autoComplete="email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: ".4rem" }}>
            <span>Password</span>
            <input autoComplete="current-password" type="password" required maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} style={fieldStyle} />
          </label>
          {error && <p role="alert" style={{ color: "#9b2424" }}>{error}</p>}
          <Button type="submit" loading={busy} disabled={busy}>{busy ? "Signing in…" : "Log in"}</Button>
        </form>
        <p className="public-prose" style={{ marginTop: "1.25rem" }}>New to SolenOS? <Link href="/signup">Create an account</Link>.</p>
        <p className="public-prose">Want to continue without an account? <Link href="/start">Choose the anonymous option</Link>.</p>
      </section>
    </PublicShell>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%", minHeight: 48, border: "1px solid #9aa99b", borderRadius: 10,
  padding: "0.75rem", font: "inherit", color: "#18251b", background: "#fff",
};
