"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signInToAccount } from "@/api/client";

export function ExistingAccountSignIn() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      await signInToAccount(email.trim(), password);
      router.replace("/workspace");
    } catch {
      setError("We couldn't sign you in. Check your email and password, then try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <details className="existing-account-signin">
      <summary>Already have a SolenOS account? Sign in</summary>
      <p>Sign in to restore the care record linked to your account on this device.</p>
      <form onSubmit={(event) => void submit(event)}>
        <label htmlFor="existing-account-email">Email</label>
        <input id="existing-account-email" type="email" autoComplete="email" required maxLength={320}
          value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} />
        <label htmlFor="existing-account-password">Password</label>
        <input id="existing-account-password" type="password" autoComplete="current-password" required maxLength={256}
          value={password} onChange={(event) => setPassword(event.target.value)} disabled={submitting} />
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>{submitting ? "Signing in…" : "Sign in"}</button>
      </form>
      <p className="existing-account-signin-note">
        If you used SolenOS without creating an account, your anonymous care record is tied to the browser session.
        Clearing all site data can remove the credential needed to restore it.
      </p>
    </details>
  );
}
