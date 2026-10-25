"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AccountAuthResponse, adoptAccountSession, getAnonymousAccessToken, postPublicJSON } from "@/api/client";
import { PublicShell } from "@/components/public/PublicShell";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [careRecipientName, setCareRecipientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await postPublicJSON("/auth/signup", {
        email,
        password,
        display_name: displayName,
        care_recipient_name: careRecipientName,
      }, getAnonymousAccessToken()) as AccountAuthResponse;
      adoptAccountSession(session);
      router.replace("/workspace?enter=1");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Account creation failed. No account session was assumed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell activeHref="/" hideNavLinks>
      <main className="account-auth-page">
        <div className="account-auth-card">
          <p className="account-auth-kicker">OPTIONAL ACCOUNT</p>
          <h1>Create your SolenOS account</h1>
          <p>Create an account to return to the same care record when you sign in. You can also use SolenOS without an account. If you already started anonymously in this browser, your existing care record will be linked rather than replaced.</p>
          <form onSubmit={submit} className="account-auth-form">
            <label>Email
              <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
            </label>
            <label>Password
              <input type="password" autoComplete="new-password" required minLength={12} maxLength={1024} value={password} onChange={event => setPassword(event.target.value)} />
              <small>Use at least 12 characters. SolenOS stores a password hash, not your password.</small>
            </label>
            <label>Your name
              <input type="text" autoComplete="name" required minLength={1} maxLength={120} value={displayName} onChange={event => setDisplayName(event.target.value)} />
            </label>
            <label>Care recipient’s name
              <input type="text" required minLength={1} maxLength={200} value={careRecipientName} onChange={event => setCareRecipientName(event.target.value)} />
              <small>This is the care record you are creating. Enter the real name you want associated with it.</small>
            </label>
            {error && <p className="account-auth-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
          </form>
          <p className="account-auth-switch">Already have an account? <Link href="/login">Sign in</Link></p>
          <p className="account-auth-switch">Prefer no account? <Link href="/workspace?enter=1">Continue without one</Link></p>
        </div>
      </main>
    </PublicShell>
  );
}
