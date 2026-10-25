"use client";

import { FormEvent, useEffect, useState } from "react";

type Mode = "account" | "verify-email" | "reset-password" | "recover-account";

type Props = { mode: Mode; token?: string };

const API = "/api/v1";

async function post(path: string, body: unknown, bearer?: string) {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const raw = await response.text();
  let data: any = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
  if (!response.ok) {
    throw new Error(data.detail || data.message || `Request failed (${response.status})`);
  }
  return data;
}

const fieldStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: "1px solid #cbd5cf",
  borderRadius: 10, padding: "12px 14px", fontSize: 16, background: "#fff",
  color: "#17211c", minHeight: 46,
};
const buttonStyle: React.CSSProperties = {
  width: "100%", border: 0, borderRadius: 10, padding: "13px 16px",
  minHeight: 48, background: "#dce9df", color: "#17211c", fontWeight: 650,
  fontSize: 16, cursor: "pointer",
};
const cardStyle: React.CSSProperties = {
  width: "100%", maxWidth: 520, margin: "0 auto", padding: 24,
  border: "1px solid #dfe7e1", borderRadius: 18, background: "#fff",
  boxShadow: "0 8px 28px rgba(22, 38, 28, 0.06)",
};

export default function AccountSecurityFlow({ mode, token = "" }: Props) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [caregiverName, setCaregiverName] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [accountToken, setAccountToken] = useState("");
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaCodeToConfirm, setMfaCodeToConfirm] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [mfaBusy, setMfaBusy] = useState(false);

  useEffect(() => {
    try {
      const accountId = window.localStorage.getItem("solenos_backend_account_id");
      const tokenValue = window.localStorage.getItem("solenos_anonymous_access_token");
      if (accountId && tokenValue) setAccountToken(tokenValue);
    } catch { /* storage may be unavailable */ }
  }, []);

  const run = async (event: FormEvent, action: () => Promise<void>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try { await action(); }
    catch (e) { setError(e instanceof Error ? e.message : "The request could not be completed."); }
    finally { setBusy(false); }
  };

  const signIn = async () => {
    const result = await post("/sessions/login", { email, password, ...(mfaCode.trim() ? { mfa_code: mfaCode.trim() } : {}) });
    if (!result.access_token || !result.person?.id || !result.caregiver?.id || !result.expires_at) {
      throw new Error("The server did not return a complete account session. No session was saved.");
    }
    window.localStorage.setItem("solenos_anonymous_access_token", result.access_token);
    window.localStorage.setItem("solenos_backend_person_id", result.person.id);
    window.localStorage.setItem("solenos_backend_caregiver_id", result.caregiver.id);
    window.localStorage.setItem("solenos_anonymous_session_expires_at", result.expires_at);
    window.localStorage.setItem("solenos_backend_account_id", result.account?.id || "");
    window.dispatchEvent(new Event("personIdChanged"));
    setAccountToken(result.access_token);
    setMessage("Signed in. Your account session is active on this device.");
  };

  const signUp = async () => {
    const result = await post("/sessions/register", {
      email, password, caregiver_name: caregiverName.trim(), care_recipient_name: recipientName.trim(),
    });
    setMessage(result.message || "Account created. Check your email to verify your address before signing in.");
    setTab("login");
    setPassword("");
  };

  const startMfa = async () => {
    if (!accountToken) throw new Error("Sign in to your verified caregiver account first.");
    setMfaBusy(true); setError(""); setMessage(""); setRecoveryCodes([]);
    try {
      const result = await post("/account-security/mfa/enroll", {}, accountToken);
      setMfaSecret(result.secret || "");
      setMessage("Scan the authenticator setup URI or enter the secret in your authenticator app, then verify a current code.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start MFA enrollment.");
    } finally { setMfaBusy(false); }
  };

  const confirmMfa = async (event: FormEvent) => {
    event.preventDefault();
    setMfaBusy(true); setError(""); setMessage("");
    try {
      const result = await post("/account-security/mfa/confirm", { code: mfaCodeToConfirm.trim() }, accountToken);
      setRecoveryCodes(result.recovery_codes || []);
      setMfaSecret("");
      setMfaCodeToConfirm("");
      setMessage("Multi-factor authentication is enabled. Save the recovery codes now; they will not be shown again.");
    } catch (e) { setError(e instanceof Error ? e.message : "MFA confirmation failed."); }
    finally { setMfaBusy(false); }
  };

  const requestEmailAction = async (purpose: "password-reset" | "recovery") => {
    const path = purpose === "password-reset" ? "/account-security/password-reset/request" : "/account-security/recovery/request";
    const result = await post(path, { email: email.trim() });
    setMessage(result.message || "If the account exists, instructions will be sent to its email address.");
  };

  const confirmTokenAction = async (purpose: "password-reset" | "recovery") => {
    if (!token) throw new Error("The secure link is missing its token. Request a new email.");
    if (newPassword.length < 10) throw new Error("Use a password with at least 10 characters.");
    if (newPassword !== confirmPassword) throw new Error("The passwords do not match.");
    const path = purpose === "password-reset" ? "/account-security/password-reset/confirm" : "/account-security/recovery/confirm";
    await post(path, { token, new_password: newPassword });
    setMessage(purpose === "password-reset"
      ? "Password changed. Existing sessions have been revoked. Sign in again with your new password."
      : "Account recovered. Existing sessions and MFA enrollment have been revoked/reset. Sign in again and set up MFA again.");
  };

  if (mode === "verify-email") {
    return <section style={cardStyle}>
      <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>Verify your email</h1>
      <p style={{ color: "#526157", lineHeight: 1.6 }}>This one-time link expires after 24 hours.</p>
      <button style={buttonStyle} disabled={busy || !token} onClick={(e) => void run(e as any, async () => {
        await post("/account-security/verification/confirm", { token });
        setMessage("Email verified. You can now sign in to SolenOS.");
      })}>{busy ? "Verifying…" : "Verify email address"}</button>
      {!token && <p role="alert" style={{ color: "#9b2525" }}>The verification token is missing. Request a new verification email.</p>}
      {error && <p role="alert" style={{ color: "#9b2525" }}>{error}</p>}
      {message && <p role="status" style={{ color: "#315d40" }}>{message}</p>}
      <p><a href="/account" style={{ color: "#315d40" }}>Return to account sign-in</a></p>
    </section>;
  }

  if (mode === "reset-password" || mode === "recover-account") {
    const recovery = mode === "recover-account";
    const title = recovery ? "Recover your account" : "Reset your password";
    return <section style={cardStyle}>
      <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>{title}</h1>
      <p style={{ color: "#526157", lineHeight: 1.6 }}>
        {token ? "Choose a new password. The secure link is single-use and expires after 30 minutes." :
          "Enter the email address associated with the account. If it exists, we will send a secure link."}
      </p>
      <form onSubmit={(e) => void run(e, async () => {
        if (token) await confirmTokenAction(recovery ? "recovery" : "password-reset");
        else await requestEmailAction(recovery ? "recovery" : "password-reset");
      })} style={{ display: "grid", gap: 12 }}>
        {!token ? <label style={{ display: "grid", gap: 6 }}>Email address
          <input style={fieldStyle} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label> : <>
          <label style={{ display: "grid", gap: 6 }}>New password
            <input style={fieldStyle} type="password" autoComplete="new-password" minLength={10} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>Confirm new password
            <input style={fieldStyle} type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </label>
        </>}
        <button style={buttonStyle} disabled={busy}>{busy ? "Working…" : token ? "Save new password" : "Send secure link"}</button>
      </form>
      {error && <p role="alert" style={{ color: "#9b2525" }}>{error}</p>}
      {message && <p role="status" style={{ color: "#315d40" }}>{message}</p>}
      <p style={{ marginTop: 18 }}><a href="/account" style={{ color: "#315d40" }}>Return to account sign-in</a></p>
    </section>;
  }

  return <main style={{ minHeight: "70vh", padding: "48px 18px", background: "#f7faf7", color: "#17211c" }}>
    <div style={{ ...cardStyle, marginBottom: 24 }}>
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>SolenOS account</h1>
      <p style={{ color: "#526157", lineHeight: 1.6 }}>Your care record stays under your control. Email verification is required before account sign-in; anonymous use remains available separately.</p>
      <div role="tablist" aria-label="Account action" style={{ display: "flex", gap: 8, margin: "20px 0" }}>
        <button type="button" role="tab" aria-selected={tab === "login"} onClick={() => setTab("login")} style={{ ...buttonStyle, background: tab === "login" ? "#dce9df" : "#f0f4f0" }}>Sign in</button>
        <button type="button" role="tab" aria-selected={tab === "register"} onClick={() => setTab("register")} style={{ ...buttonStyle, background: tab === "register" ? "#dce9df" : "#f0f4f0" }}>Create account</button>
      </div>
      <form onSubmit={(e) => void run(e, tab === "login" ? signIn : signUp)} style={{ display: "grid", gap: 12 }}>
        {tab === "register" && <>
          <label style={{ display: "grid", gap: 6 }}>Your name
            <input style={fieldStyle} autoComplete="name" required value={caregiverName} onChange={(e) => setCaregiverName(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>Care recipient name
            <input style={fieldStyle} required value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
          </label>
        </>}
        <label style={{ display: "grid", gap: 6 }}>Email address
          <input style={fieldStyle} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>Password
          <input style={fieldStyle} type="password" autoComplete={tab === "login" ? "current-password" : "new-password"} minLength={10} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {tab === "login" && <label style={{ display: "grid", gap: 6 }}>Authenticator or recovery code (if MFA is enabled)
          <input style={fieldStyle} autoComplete="one-time-code" inputMode="numeric" value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} placeholder="6-digit code or recovery code" />
        </label>}
        <button style={buttonStyle} disabled={busy}>{busy ? "Working…" : tab === "login" ? "Sign in" : "Create account and verify email"}</button>
      </form>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 18, fontSize: 14 }}>
        <a href="/reset-password" style={{ color: "#315d40" }}>Forgot password?</a>
        <a href="/recover-account" style={{ color: "#315d40" }}>Recover account</a>
      </div>
      {error && <p role="alert" style={{ color: "#9b2525" }}>{error}</p>}
      {message && <p role="status" style={{ color: "#315d40" }}>{message}</p>}
    </div>
    {accountToken && <section style={cardStyle}>
      <h2 style={{ fontSize: 22, marginTop: 0 }}>Multi-factor authentication</h2>
      <p style={{ color: "#526157", lineHeight: 1.6 }}>Enable an authenticator app as a second factor for future sign-ins. Recovery codes are displayed once after confirmation.</p>
      {!mfaSecret ? <button style={buttonStyle} disabled={mfaBusy} onClick={() => void startMfa()}>{mfaBusy ? "Starting…" : "Set up MFA"}</button> : <>
        <p><strong>Authenticator secret</strong></p>
        <code style={{ display: "block", padding: 12, overflowWrap: "anywhere", background: "#f2f5f2", borderRadius: 8 }}>{mfaSecret}</code>
        <form onSubmit={(e) => void confirmMfa(e)} style={{ display: "grid", gap: 12, marginTop: 16 }}>
          <label style={{ display: "grid", gap: 6 }}>Current authenticator code
            <input style={fieldStyle} inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} value={mfaCodeToConfirm} onChange={(e) => setMfaCodeToConfirm(e.target.value)} />
          </label>
          <button style={buttonStyle} disabled={mfaBusy}>{mfaBusy ? "Confirming…" : "Confirm and enable MFA"}</button>
        </form>
      </>}
      {recoveryCodes.length > 0 && <div style={{ marginTop: 18 }}>
        <h3>Save these recovery codes now</h3>
        <ul>{recoveryCodes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
        <button type="button" style={buttonStyle} onClick={() => void navigator.clipboard?.writeText(recoveryCodes.join("\n"))}>Copy recovery codes</button>
      </div>}
      {error && <p role="alert" style={{ color: "#9b2525" }}>{error}</p>}
      {message && <p role="status" style={{ color: "#315d40" }}>{message}</p>}
    </section>}
  </main>;
}
