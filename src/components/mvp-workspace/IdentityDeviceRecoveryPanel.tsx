"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { KeyRound, MonitorSmartphone, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ensureAnonymousSession, getJSON, postJSON, deleteJSON, signInToAccount } from "@/api/client";

type Device = {
  id: string;
  label: string;
  platform: string | null;
  trust_status: string;
  last_seen_at: string | null;
  created_at: string | null;
  recovery_can_use_device_alone: boolean;
};

const INSTALLATION_KEY = "solenos_device_installation_key_v1";

function getInstallationKey(): string {
  let key = window.localStorage.getItem(INSTALLATION_KEY);
  if (!key) {
    key = typeof window.crypto?.randomUUID === "function"
      ? window.crypto.randomUUID() + window.crypto.randomUUID()
      : Array.from(window.crypto.getRandomValues(new Uint8Array(32)), (v) => v.toString(16).padStart(2, "0")).join("");
    window.localStorage.setItem(INSTALLATION_KEY, key);
  }
  return key;
}

export function IdentityDeviceRecoveryPanel() {
  const { show, render } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDevice, setSavingDevice] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [replacementRecoveryCode, setReplacementRecoveryCode] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [error, setError] = useState("");

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await ensureAnonymousSession();
      const result = await getJSON("/identity/devices") as { devices: Device[] };
      setDevices(result.devices ?? []);
    } catch {
      setError("We couldn't load device registrations. Your care record has not been changed.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDevices(); }, [loadDevices]);

  const registerThisDevice = async () => {
    setSavingDevice(true);
    setError("");
    try {
      await ensureAnonymousSession();
      await postJSON("/identity/devices", {
        installation_key: getInstallationKey(),
        label: "This browser/device",
        platform: typeof navigator === "undefined" ? "unknown" : navigator.platform || "browser",
      }) as { device: Device };
      show("Device registration saved. It is not treated as verified identity.", "success");
      await loadDevices();
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't register this device.");
    } finally {
      setSavingDevice(false);
    }
  };

  const revokeDevice = async (device: Device) => {
    setRevokingId(device.id);
    setError("");
    try {
      await deleteJSON(`/identity/devices/${encodeURIComponent(device.id)}`);
      setDevices((current) => current.filter((item) => item.id !== device.id));
      show("Device registration revoked.", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't revoke this device.");
    } finally {
      setRevokingId(null);
    }
  };

  const recoverAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecoveryBusy(true);
    setRecoveryMessage("");
    setReplacementRecoveryCode("");
    setError("");
    try {
      const response = await fetch("/api/v1/accounts/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, recovery_code: recoveryCode, new_password: newPassword }),
      });
      const body = await response.json().catch(() => ({})) as {
        message?: string;
        detail?: string;
        recovery_code?: string;
      };
      if (!response.ok) throw new Error(body.detail || "We couldn't recover this account.");
      // The recovery endpoint revokes every old session. Sign in immediately
      // with the new password to establish a fresh bearer on this device.
      await signInToAccount(email, newPassword);
      setRecoveryMessage(body.message || "Account recovered. You are signed in on this device.");
      setReplacementRecoveryCode(body.recovery_code || "");
      setRecoveryCode("");
      setNewPassword("");
      show("Account access restored.", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't recover this account.");
    } finally {
      setRecoveryBusy(false);
    }
  };

  return (
    <section className="mobile-settings-card" aria-labelledby="identity-security-title">
      <h2 id="identity-security-title" className="mobile-settings-card-title">
        <ShieldCheck size={16} aria-hidden /> Identity &amp; device security
      </h2>
      <p className="mobile-settings-hint">
        Anonymous care access remains available. Device registration helps you recognize a browser, but a device alone can never prove identity or restore account access.
      </p>
      {loading && <p className="mobile-settings-hint" role="status">Loading registered devices…</p>}
      {error && <p className="mobile-settings-hint" role="alert">{error}</p>}
      {!loading && devices.length === 0 && <p className="mobile-settings-hint">No active devices are registered for this caregiver yet.</p>}
      {devices.map((device) => (
        <div key={device.id} className="mobile-settings-row" style={{ alignItems: "flex-start" }}>
          <span>
            <span className="mobile-settings-label"><MonitorSmartphone size={14} aria-hidden /> {device.label}</span>
            <span className="mobile-settings-hint">
              {device.platform || "Platform not reported"} · {device.trust_status === "unverified" ? "Registered, not verified" : device.trust_status}
            </span>
            <span className="mobile-settings-hint">Device-only recovery: not allowed</span>
          </span>
          <Button variant="destructive" disabled={revokingId !== null} loading={revokingId === device.id} onClick={() => void revokeDevice(device)}>
            {revokingId === device.id ? undefined : <><Trash2 size={14} aria-hidden /> Revoke</>}
          </Button>
        </div>
      ))}
      <div className="mobile-settings-actions">
        <Button variant="primary" disabled={savingDevice || loading} loading={savingDevice} onClick={() => void registerThisDevice()}>
          {savingDevice ? undefined : "Register this device"}
        </Button>
        <Button variant="secondary" disabled={loading} onClick={() => void loadDevices()}>Refresh devices</Button>
      </div>
      <div style={{ borderTop: "1px solid var(--border, #d8ded8)", marginTop: "1rem", paddingTop: "1rem" }}>
        <h3 className="mobile-settings-label"><KeyRound size={14} aria-hidden /> Recover an account</h3>
        <p className="mobile-settings-hint">
          Use the one-time recovery code saved when the account was created or last rotated. A successful recovery resets the password and revokes every existing session. A registered device alone cannot recover an account.
        </p>
        <form onSubmit={(event) => void recoverAccount(event)} style={{ display: "grid", gap: "0.7rem" }}>
          <label className="mobile-settings-label" htmlFor="identity-recovery-email">Account email
            <input id="identity-recovery-email" className="mobile-settings-input" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="mobile-settings-label" htmlFor="identity-recovery-code">One-time recovery code
            <input id="identity-recovery-code" className="mobile-settings-input" type="text" autoComplete="off" required minLength={32} maxLength={200} value={recoveryCode} onChange={(event) => setRecoveryCode(event.target.value)} />
          </label>
          <label className="mobile-settings-label" htmlFor="identity-recovery-password">New password
            <input id="identity-recovery-password" className="mobile-settings-input" type="password" autoComplete="new-password" required minLength={12} maxLength={256} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          </label>
          <Button type="submit" variant="secondary" loading={recoveryBusy} disabled={recoveryBusy}>
            {recoveryBusy ? undefined : "Recover account"}
          </Button>
        </form>
        {recoveryMessage && <p className="mobile-settings-hint" role="status">{recoveryMessage}</p>}
        {replacementRecoveryCode && (
          <div className="mobile-settings-hint" role="alert" style={{ border: "1px solid var(--border, #d8ded8)", borderRadius: "0.75rem", padding: "0.8rem" }}>
            <strong>Save your replacement recovery code.</strong>
            <code style={{ display: "block", overflowWrap: "anywhere", userSelect: "all", padding: "0.5rem 0" }}>{replacementRecoveryCode}</code>
            <Button type="button" variant="secondary" onClick={() => setReplacementRecoveryCode("")}>I have saved the code</Button>
          </div>
        )}
      </div>
      {render()}
    </section>
  );
}
