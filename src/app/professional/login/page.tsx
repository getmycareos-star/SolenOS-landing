"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/Button";
import { loginProfessional } from "@/api/professionalAuth";

const fieldStyle: React.CSSProperties = {
  width: "100%", minHeight: 48, border: "1px solid #9aa99b", borderRadius: 10,
  padding: "0.75rem", font: "inherit", color: "#18251b", background: "#fff",
};

export default function ProfessionalLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    try { await loginProfessional(email.trim(), password); router.replace("/professional/dashboard"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sign in to your professional account."); }
    finally { setBusy(false); }
  }
  return (
    <PublicShell activeHref="/professional/login">
      <section className="public-section" style={{ maxWidth: 620, margin: "0 auto", paddingTop: "3rem", paddingBottom: "4rem" }}>
        <p className="public-eyebrow">SolenOS · Professional account</p>
        <h1 className="public-section-title">Professional login</h1>
        <p className="public-prose">Sign in to manage your professional profile and review status. This login is separate from caregiver accounts and does not grant access to any caregiver's Living Care Record.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
          <label style={{ display: "grid", gap: ".4rem" }}><span>Email address</span><input autoComplete="email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle} /></label>
          <label style={{ display: "grid", gap: ".4rem" }}><span>Password</span><input autoComplete="current-password" type="password" required maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} style={fieldStyle} /></label>
          {error && <p role="alert" style={{ color: "#9b2424" }}>{error}</p>}
          <Button type="submit" loading={busy} disabled={busy}>{busy ? "Signing in…" : "Log in"}</Button>
        </form>
        <p className="public-prose" style={{ marginTop: "1.25rem" }}>New professional to SolenOS? <Link href="/professional/signup">Create a professional profile</Link>.</p>
      </section>
    </PublicShell>
  );
}
