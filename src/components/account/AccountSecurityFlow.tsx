"use client";

import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

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

const fieldStyle: CSSProperties = {
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
  const [recoveryCode, setRecoveryCode] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [recoveryKeyToShow, setRecoveryKeyToShow] = useState("");
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
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [mfaCodeToConfirm, setMfaCodeToConfirm] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [mfaBusy, setMfaBusy] = useState(false);

  useEffect(() => {
    try {
      const accountId = window.localStorage.getItem("solenos_backend_account_id");
      const tokenValue = window.localStorage.getItem("solenos_anonymous_access_token");
      if (accountId && tokenValue) {
        setAccountToken(tokenValue);
        void fetch(`${API}/account-security/mfa/status`, { headers: { Authorization: `Bearer ${tokenValue}` } })
          .then(async (response) => response.ok ? response.json() : { enabled: false })
          .then((result) => setMfaEnabled(Boolean(result.enabled)))
          .catch(() => setMfaEnabled(false));
      }
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
    setMfaEnabled(Boolean(result.mfa_enabled));
    setMessage("Signed in. Your account session is active on this device.");
  };

  const signUp = async () => {
    const result = await post("/sessions/register", {
      email, password, caregiver_name: caregiverName.trim(), care_recipient_name: recipientName.trim(),
      anonymous_access_token: window.localStorage.getItem("solenos_anonymous_access_token") || undefined,
    });
    if (!result.recovery_code) throw new Error("Account was created, but the server did not return a recovery key. Do not close this screen; contact support before relying on recovery.");
    setRecoveryKeyToShow(result.recovery_code);
    setMessage(result.message || "Account created. Save the recovery key now; it will not be shown again.");
    setTab("login");
    setPassword("");
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    setMfaBusy(true); setError(""); setMessage("");
    try {
      if (newPassword.length < 10) throw new Error("Use a password with at least 10 characters.");
      if (newPassword !== confirmPassword) throw new Error("The passwords do not match.");
      await post("/account-security/password/change", { current_password: currentPassword, new_password: newPassword }, accountToken);
      clearSavedSession();
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setMessage("Password changed. For security, all sessions were revoked. Sign in again with the new password.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not change password."); }
    finally { setMfaBusy(false); }
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
      setMfaEnabled(true);
      setMfaSecret("");
      setMfaCodeToConfirm("");
      setMessage("Multi-factor authentication is enabled. Save the recovery codes now; they will not be shown again.");
    } catch (e) { setError(e instanceof Error ? e.message : "MFA confirmation failed."); }
    finally { setMfaBusy(false); }
  };


  const disableMfa = async (event: FormEvent) => {
    event.preventDefault();
    setMfaBusy(true); setError(""); setMessage("");
    try {
      await post("/account-security/mfa/disable", { code: disableCode.trim() }, accountToken);
      setMfaEnabled(false);
      setDisableCode("");
      setMessage("MFA disabled. Your account is protected by password and email verification only.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not disable MFA."); }
    finally { setMfaBusy(false); }
  };

  const clearSavedSession = () => {
    try {
      window.localStorage.removeItem("solenos_anonymous_access_token");
      window.localStorage.removeItem("solenos_backend_person_id");
      window.localStorage.removeItem("solenos_backend_caregiver_id");
      window.localStorage.removeItem("solenos_anonymous_session_expires_at");
      window.localStorage.removeItem("solenos_backend_account_id");
    } catch { /* storage may be unavailable */ }
    setAccountToken("");
    window.dispatchEvent(new Event("personIdChanged"));
  };

  const confirmRecoveryKey = async () => {
    if (newPassword.length < 10) throw new Error("Use a password with at least 10 characters.");
    if (newPassword !== confirmPassword) throw new Error("The passwords do not match.");
    await post("/account-security/recovery/confirm", {
      email: email.trim(), recovery_code: recoveryCode.trim(), new_password: newPassword,
    });
    clearSavedSession();
    setRecoveryCode("");
    setNewPassword("");
    setConfirmPassword("");
    setMessage("Password reset. The recovery key has been used and all existing sessions were revoked. Sign in with your new password.");
  };

  const confirmTokenAction = async (purpose: "password-reset" | "recovery") => {
    if (!token) throw new Error("The secure link is missing its token.");
    if (newPassword.length < 10) throw new Error("Use a password with at least 10 characters.");
    if (newPassword !== confirmPassword) throw new Error("The passwords do not match.");
    const path = purpose === "password-reset" ? "/account-security/password-reset/confirm" : "/account-security/recovery/confirm";
    await post(path, { token, new_password: newPassword });
    clearSavedSession();
    setMessage("Password changed. Existing sessions have been revoked. Sign in again with your new password.");
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
        {token ? "Choose a new password. This link is single-use and expires after 30 minutes." :
          recovery ? "Use the recovery key you saved when creating your account. The key is single-use. No email service is required." :
          "Password reset by email is unavailable until an email provider is configured. Use your saved recovery key instead."}
      </p>
      <form onSubmit={(e) => void run(e, async () => {
        if (token) await confirmTokenAction(recovery ? "recovery" : "password-reset");
        else if (recovery) await confirmRecoveryKey();
        else throw new Error("Email reset is not configured. Use the saved recovery key.");
      })} style={{ display: "grid", gap: 12 }}>
        {!token && <label style={{ display: "grid", gap: 6 }}>Email address
          <input style={fieldStyle} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>}
        {!token && recovery && <label style={{ display: "grid", gap: 6 }}>Saved recovery key
          <input style={fieldStyle} autoComplete="off" required value={recoveryCode} onChange={(e) => setRecoveryCode(e.target.value)} />
        </label>}
        {(token || recovery) && <>
          <label style={{ display: "grid", gap: 6 }}>New password
            <input style={fieldStyle} type="password" autoComplete="new-password" minLength={10} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </label>
          <label style={{ display: "grid", gap: 6 }}>Confirm new password
            <input style={fieldStyle} type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </label>
        </>}
        <button style={buttonStyle} disabled={busy}>{busy ? "Working…" : token || recovery ? "Reset password" : "Unavailable without email setup"}</button>
      </form>
      {error && <p role="alert" style={{ color: "#9b2525" }}>{error}</p>}
      {message && <p role="status" style={{ color: "#315d40" }}>{message}</p>}
      <p style={{ marginTop: 18 }}><a href="/account" style={{ color: "#315d40" }}>Return to account sign-in</a></p>
    </section>;
  }

  return <main style={{ minHeight: "70vh", padding: "48px 18px", background: "#f7faf7", color: "#17211c" }}>
    <div style={{ ...cardStyle, marginBottom: 24 }}>
      <h1 style={{ fontSize: 28, margin: "0 0 8px" }}>SolenOS account</h1>
      <p style={{ color: "#526157", lineHeight: 1.6 }}>Your care record stays under your control. Sign in with your email and password on any device. Save your one-time recovery key somewhere safe; anonymous use remains available separately.</p>
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
        <button style={buttonStyle} disabled={busy}>{busy ? "Working…" : tab === "login" ? "Sign in" : "Create account"}</button>
      </form>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 18, fontSize: 14 }}>
        <a href="/recover-account" style={{ color: "#315d40" }}>Forgot password?</a>
        <a href="/recover-account" style={{ color: "#315d40" }}>Recover account</a>
 
      </div>
      {error && <p role="alert" style={{ color: "#9b2525" }}>{error}</p>}
      {message && <p role="status" style={{ color: "#315d40" }}>{message}</p>}
      {recoveryKeyToShow && <section role="alert" style={{ marginTop: 18, padding: 16, border: "1px solid #b9cdbd", borderRadius: 12, background: "#f5faf5" }}>
        <h2 style={{ marginTop: 0, fontSize: 18 }}>Save your account recovery key now</h2>
        <p>This key is shown only once. Store it somewhere separate from this device. Anyone who has both your email and this key can reset your password.</p>
        <code style={{ display: "block", overflowWrap: "anywhere", padding: 12, background: "#fff", borderRadius: 8 }}>{recoveryKeyToShow}</code>
        <button type="button" style={{ ...buttonStyle, marginTop: 10 }} onClick={() => { void navigator.clipboard?.writeText(recoveryKeyToShow).then(() => setMessage("Recovery key copied. Save it somewhere safe.")).catch(() => setMessage("Copy failed. Select and copy the recovery key manually.")); }}>Copy recovery key</button>
        <button type="button" style={{ ...buttonStyle, marginTop: 8, background: "#f0f4f0" }} onClick={() => setRecoveryKeyToShow("")}>I saved it — hide key</button>
      </section>}
    </div>
    {accountToken && <section style={cardStyle}>
      <p><a href="/workspace" style={{ color: "#315d40" }}>Continue to your care record</a></p>
      <h2 style={{ fontSize: 22, marginTop: 0 }}>Change password</h2>
      <form onSubmit={(e) => void changePassword(e)} style={{ display: "grid", gap: 12, marginBottom: 28 }}>
        <label style={{ display: "grid", gap: 6 }}>Current password
          <input style={fieldStyle} type="password" autoComplete="current-password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>New password
          <input style={fieldStyle} type="password" autoComplete="new-password" minLength={10} required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </label>
        <label style={{ display: "grid", gap: 6 }}>Confirm new password
          <input style={fieldStyle} type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </label>
        <button style={buttonStyle} disabled={mfaBusy}>{mfaBusy ? "Updating…" : "Change password and sign out"}</button>
      </form>
      <h2 style={{ fontSize: 22, marginTop: 0 }}>Multi-factor authentication</h2>
      <p style={{ color: "#526157", lineHeight: 1.6 }}>Enable an authenticator app as a second factor for future sign-ins. Recovery codes are displayed once after confirmation.</p>
      {mfaEnabled ? <form onSubmit={(e) => void disableMfa(e)} style={{ display: "grid", gap: 12 }}>
        <p role="status">MFA is enabled for this account. Disabling it requires a current authenticator code.</p>
        <label style={{ display: "grid", gap: 6 }}>Authenticator code to disable MFA
          <input style={fieldStyle} inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={6} value={disableCode} onChange={(e) => setDisableCode(e.target.value)} />
        </label>
        <button style={buttonStyle} disabled={mfaBusy}>{mfaBusy ? "Updating…" : "Disable MFA"}</button>
      </form> : !mfaSecret ? <button style={buttonStyle} disabled={mfaBusy} onClick={() => void startMfa()}>{mfaBusy ? "Starting…" : "Set up MFA"}</button> : <>
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
