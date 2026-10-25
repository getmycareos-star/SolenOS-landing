"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AccountAuthResponse, adoptAccountSession, getAnonymousAccessToken, postPublicJSON } from "@/api/client";
import { PublicShell } from "@/components/public/PublicShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = await postPublicJSON("/auth/login", { email, password }, getAnonymousAccessToken()) as AccountAuthResponse;
      adoptAccountSession(session);
      router.replace("/workspace?enter=1");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign-in failed. No account session was assumed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PublicShell activeHref="/" hideNavLinks>
      <main className="account-auth-page">
        <div className="account-auth-card">
          <p className="account-auth-kicker">ACCOUNT SIGN-IN</p>
          <h1>Return to your care record</h1>
          <p>Sign in with the email and password you used when creating your account. If you started anonymously with a different care record in this browser, SolenOS will refuse to switch or merge it silently.</p>
          <form onSubmit={submit} className="account-auth-form">
            <label>Email
              <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} />
            </label>
            <label>Password
              <input type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={event => setPassword(event.target.value)} />
            </label>
            {error && <p className="account-auth-error" role="alert">{error}</p>}
            <button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          </form>
          <p className="account-auth-switch">New to SolenOS? <Link href="/signup">Create an account</Link></p>
          <p className="account-auth-switch">No account? <Link href="/workspace?enter=1">Continue without one</Link></p>
        </div>
      </main>
    </PublicShell>
  );
}
