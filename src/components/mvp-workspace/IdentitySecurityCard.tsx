"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, MonitorSmartphone, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { ensureAnonymousSession, getJSON, postJSON, deleteJSON } from "@/api/client";

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

export function IdentitySecurityCard() {
  const { show, render } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDevice, setSavingDevice] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
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
      const result = await postJSON("/identity/devices", {
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

  const requestRecovery = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRecoveryBusy(true);
    setRecoveryMessage("");
    setError("");
    try {
      const response = await fetch("/api/v1/identity/recovery-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => ({})) as { message?: string; detail?: string };
      if (!response.ok) throw new Error(body.detail || "We couldn't submit the recovery request.");
      setRecoveryMessage(body.message || "Request recorded. Additional verification is required.");
      setEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't submit the recovery request.");
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
        <h3 className="mobile-settings-label"><KeyRound size={14} aria-hidden /> Account recovery request</h3>
        <p className="mobile-settings-hint">
          Submit the email address associated with an optional account. The response does not reveal whether an account exists. This records a pending request; automated password-reset delivery is not enabled yet, so this form does not itself restore access.
        </p>
        <form onSubmit={(event) => void requestRecovery(event)} style={{ display: "grid", gap: "0.7rem" }}>
          <label className="mobile-settings-label" htmlFor="identity-recovery-email">Account email
            <input id="identity-recovery-email" className="mobile-settings-input" type="email" autoComplete="email" required maxLength={320} value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <Button type="submit" variant="secondary" loading={recoveryBusy} disabled={recoveryBusy}>
            {recoveryBusy ? undefined : "Submit recovery request"}
          </Button>
        </form>
        {recoveryMessage && <p className="mobile-settings-hint" role="status">{recoveryMessage}</p>}
      </div>
      {render()}
    </section>
  );
}
