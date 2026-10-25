"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PublicShell } from "@/components/public/PublicShell";
import { Button } from "@/components/ui/Button";
import { authenticateAccount } from "@/api/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [caregiverName, setCaregiverName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await authenticateAccount("register", {
        email: email.trim(),
        password,
        caregiver_name: caregiverName.trim() || "Caregiver",
        care_recipient_name: recipientName.trim() || "Care recipient",
      });
      router.replace("/workspace");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "SolenOS could not create your account. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell activeHref="/signup">
      <section className="public-section" style={{ maxWidth: 620, margin: "0 auto", paddingTop: "3rem", paddingBottom: "4rem" }}>
        <p className="public-eyebrow">SolenOS · Caregiver account</p>
        <h1 className="public-section-title">Create your account</h1>
        <p className="public-prose">Use an email and password to return to your SolenOS care record from another session. Your password is stored as a one-way password hash by the backend, not as plain text.</p>
        <form onSubmit={submit} style={{ display: "grid", gap: "1rem", marginTop: "1.5rem" }}>
          <label style={{ display: "grid", gap: ".4rem" }}>
            <span>Email address</span>
            <input autoComplete="email" type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: ".4rem" }}>
            <span>Password (at least 10 characters)</span>
            <input autoComplete="new-password" type="password" required minLength={10} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: ".4rem" }}>
            <span>Your name (optional)</span>
            <input autoComplete="name" maxLength={120} value={caregiverName} onChange={(event) => setCaregiverName(event.target.value)} style={fieldStyle} />
          </label>
          <label style={{ display: "grid", gap: ".4rem" }}>
            <span>Care recipient name (optional)</span>
            <input maxLength={120} value={recipientName} onChange={(event) => setRecipientName(event.target.value)} style={fieldStyle} />
          </label>
          {error && <p role="alert" style={{ color: "#9b2424" }}>{error}</p>}
          <Button type="submit" loading={busy} disabled={busy}>{busy ? "Creating account…" : "Create account"}</Button>
        </form>
        <p className="public-prose" style={{ marginTop: "1.25rem" }}>Already have an account? <Link href="/login">Log in</Link>.</p>
        <p className="public-prose">Prefer not to create an account? <Link href="/start">Continue with the available anonymous option</Link>.</p>
        <p className="public-prose" style={{ fontSize: ".9rem" }}>Creating an account starts a separate care record; it does not merge an existing anonymous record. If this browser already has an anonymous session, SolenOS preserves it so you can switch back from Settings → Security.</p>
      </section>
    </PublicShell>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%", minHeight: 48, border: "1px solid #9aa99b", borderRadius: 10,
  padding: "0.75rem", font: "inherit", color: "#18251b", background: "#fff",
};
