"use client";

import { apiUrl } from "@/lib/api-url";
import { useCallback, useEffect, useState } from "react";

type NotificationControl = {
  urgencyFilter: "RED" | "RED_ORANGE" | "ALL";
  quietHoursEnabled: boolean;
  emergencyOverride: boolean;
  digestMode: "instant" | "hourly" | "daily";
};

type PrivacyControl = {
  exportEnabled: boolean;
  deleteAccountEnabled: boolean;
  disableInferenceEngine: boolean;
  disableBehaviorSignals: boolean;
  allowBehaviorInference: boolean;
};

const DEFAULT_NOTIFICATIONS: NotificationControl = {
  urgencyFilter: "RED",
  quietHoursEnabled: false,
  emergencyOverride: true,
  digestMode: "instant",
};

const DEFAULT_PRIVACY: PrivacyControl = {
  exportEnabled: true,
  deleteAccountEnabled: true,
  disableInferenceEngine: false,
  disableBehaviorSignals: false,
  allowBehaviorInference: true,
};

const TELEMETRY_USER_STORAGE_KEY = "solenos_telemetry_user_id";

/**
 * SettingsManager — client-side settings panel that talks to the SolenOS backend
 * (/api/user/notifications, /api/user/privacy) using the telemetry user id stored
 * in localStorage by the workspace.
 */
export function SettingsManager() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationControl | null>(null);
  const [privacy, setPrivacy] = useState<PrivacyControl | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(TELEMETRY_USER_STORAGE_KEY);
    setUserId(stored);
    if (!stored) {
      setLoading(false);
      setError("No active SolenOS session found. Open the Living Care Record to create one.");
    }
  }, []);

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [notifRes, privacyRes] = await Promise.all([
        fetch(apiUrl(`/api/user/notifications?telemetry_user_id=${encodeURIComponent(userId)}`)),
        fetch(apiUrl(`/api/user/privacy?telemetry_user_id=${encodeURIComponent(userId)}`)),
      ]);

      const notifData = (await notifRes.json()) as { notificationControl?: NotificationControl; error?: string };
      const privacyData = (await privacyRes.json()) as { privacyControl?: PrivacyControl; error?: string };

      if (!notifRes.ok) {
        setError(notifData.error ?? "Could not load notification settings.");
        return;
      }
      if (!privacyRes.ok) {
        setError(privacyData.error ?? "Could not load privacy settings.");
        return;
      }

      setNotifications({ ...DEFAULT_NOTIFICATIONS, ...(notifData.notificationControl ?? {}) });
      setPrivacy({ ...DEFAULT_PRIVACY, ...(privacyData.privacyControl ?? {}) });
    } catch {
      setError("Could not reach the SolenOS backend. Settings are read-only right now.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  async function saveNotifications(patch: Partial<NotificationControl>) {
    if (!userId || !notifications) return;
    const next = { ...notifications, ...patch };
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/user/notifications"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telemetry_user_id: userId, notificationControl: patch }),
      });
      const data = (await res.json()) as { notificationControl?: NotificationControl; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setNotifications(data.notificationControl ?? next);
      setMessage("Notification preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notification preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function savePrivacy(patch: Partial<PrivacyControl>) {
    if (!userId || !privacy) return;
    const next = { ...privacy, ...patch };
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(apiUrl("/api/user/privacy"), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ telemetry_user_id: userId, privacyControl: patch }),
      });
      const data = (await res.json()) as { privacyControl?: PrivacyControl; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setPrivacy(data.privacyControl ?? next);
      setMessage("Privacy preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save privacy preferences.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="panel-muted">Loading settings…</p>;
  }

  if (!userId) {
    return (
      <p className="panel-muted" role="status">
        {error}
      </p>
    );
  }

  return (
    <div className="settings-manager">
      {message && (
        <p className="settings-message" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}

      {notifications && (
        <section className="settings-section" id="notifications-controls">
          <h3 className="public-section-title">Notification preferences</h3>

          <label className="settings-field">
            <span>Urgency filter</span>
            <select
              value={notifications.urgencyFilter}
              disabled={saving}
              onChange={(e) =>
                void saveNotifications({
                  urgencyFilter: e.target.value as NotificationControl["urgencyFilter"],
                })
              }
            >
              <option value="RED">Red only</option>
              <option value="RED_ORANGE">Red + Orange</option>
              <option value="ALL">All</option>
            </select>
          </label>

          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={notifications.quietHoursEnabled}
              disabled={saving}
              onChange={(e) => void saveNotifications({ quietHoursEnabled: e.target.checked })}
            />
            <span>Quiet hours — suppress non-emergency notifications</span>
          </label>

          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={notifications.emergencyOverride}
              disabled={saving}
              onChange={(e) => void saveNotifications({ emergencyOverride: e.target.checked })}
            />
            <span>Always allow emergency override</span>
          </label>

          <label className="settings-field">
            <span>Digest mode</span>
            <select
              value={notifications.digestMode}
              disabled={saving}
              onChange={(e) =>
                void saveNotifications({ digestMode: e.target.value as NotificationControl["digestMode"] })
              }
            >
              <option value="instant">Instant</option>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
            </select>
          </label>
        </section>
      )}

      {privacy && (
        <section className="settings-section" id="privacy-controls">
          <h3 className="public-section-title">Privacy &amp; data controls</h3>

          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={privacy.exportEnabled}
              disabled={saving}
              onChange={(e) => void savePrivacy({ exportEnabled: e.target.checked })}
            />
            <span>Allow exporting my data</span>
          </label>

          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={privacy.deleteAccountEnabled}
              disabled={saving}
              onChange={(e) => void savePrivacy({ deleteAccountEnabled: e.target.checked })}
            />
            <span>Allow account deletion</span>
          </label>

          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={privacy.disableInferenceEngine}
              disabled={saving}
              onChange={(e) => void savePrivacy({ disableInferenceEngine: e.target.checked })}
            />
            <span>Disable inference engine</span>
          </label>

          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={privacy.disableBehaviorSignals}
              disabled={saving}
              onChange={(e) => void savePrivacy({ disableBehaviorSignals: e.target.checked })}
            />
            <span>Disable behavior signals</span>
          </label>

          <label className="consent-checkbox">
            <input
              type="checkbox"
              checked={privacy.allowBehaviorInference}
              disabled={saving}
              onChange={(e) => void savePrivacy({ allowBehaviorInference: e.target.checked })}
            />
            <span>Allow behavior inference</span>
          </label>
        </section>
      )}
    </div>
  );
}
