"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { acceptCaregiverInvitation } from "@/api/client";
import { Button } from "@/components/ui/Button";

export default function AcceptCaregiverInvitationPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fragment = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(fragment);
    setToken(params.get("token") ?? "");
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await acceptCaregiverInvitation({ token, name: name.trim(), email: email.trim(), password });
      router.replace("/workspace");
    } catch {
      setError("We couldn't accept this invitation. Check that the invitation is still valid and that you are using the invited email address.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mobile-screen" style={{ maxWidth: 560, margin: "0 auto", padding: "2rem 1rem" }}>
      <div className="mobile-page-head">
        <span className="settings-eyebrow">SOLENOS CARE RECORD</span>
        <h1>Join the care team</h1>
        <p>Accept your invitation to access the care information that has been shared with you.</p>
      </div>
      {!token ? (
        <section className="mobile-settings-card">
          <p className="mobile-settings-hint" role="alert">This invitation link is missing its secure code. Ask the person who invited you to share the original link again.</p>
        </section>
      ) : (
        <form className="mobile-settings-card" onSubmit={(event) => void submit(event)} style={{ display: "grid", gap: "0.9rem" }}>
          <label className="mobile-settings-label" htmlFor="invite-name">Your name</label>
          <input id="invite-name" className="mobile-settings-input" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
          <label className="mobile-settings-label" htmlFor="invite-email">Invited email address</label>
          <input id="invite-email" className="mobile-settings-input" type="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          <label className="mobile-settings-label" htmlFor="invite-password">Create a password</label>
          <input id="invite-password" className="mobile-settings-input" type="password" required minLength={12} maxLength={256} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" />
          <p className="mobile-settings-hint">Use at least 12 characters. Your access was authorised by the person who sent this invitation.</p>
          {error && <p className="mobile-settings-hint" role="alert">{error}</p>}
          <Button type="submit" variant="primary" loading={busy} disabled={busy || !name.trim() || !email.trim() || password.length < 12}>Accept invitation</Button>
        </form>
      )}
    </main>
  );
}
