"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "@/lib/workspace-context";
import { SettingsManager } from "@/components/settings/SettingsManager";
import { SUPPORT_EMAIL } from "@/lib/early-access-trust";

type SettingsTab = "profile" | "notifications" | "privacy" | "security" | "legal";

const TABS: { id: SettingsTab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy & Data" },
  { id: "security", label: "Security" },
  { id: "legal", label: "Legal" },
];

export default function WorkspaceSettingsPage() {
  const { careKey, sessionId, telemetryUserId, hydrated, entryReady } = useWorkspace();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");

  const showMessage = useCallback((text: string, type: "success" | "error" = "success") => {
    setMessage(text);
    setMessageType(type);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const handleClearLocalData = useCallback(() => {
    if (typeof window === "undefined") return;
    const keys = [
      "solenos_durable_care_key",
      "solenos_care_session_id",
      "solenos_telemetry_user_id",
      "solenos_language_preference",
      "solenos_situations",
      "solenos_timeline",
      "solenos_active_situation_id",
    ];
    keys.forEach((k) => window.localStorage.removeItem(k));
    showMessage("Local data cleared. You will be redirected to start.", "success");
    setTimeout(() => {
      window.location.href = "/start";
    }, 1500);
  }, [showMessage]);

  const handleCopyCareKey = useCallback(() => {
    if (typeof navigator === "undefined" || !careKey) return;
    navigator.clipboard.writeText(careKey).then(
      () => showMessage("Care key copied to clipboard."),
      () => showMessage("Failed to copy care key.", "error"),
    );
  }, [careKey, showMessage]);

  useEffect(() => {
    if (!hydrated || !entryReady) return;
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get("tab") as SettingsTab | null;
    if (tab && TABS.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [hydrated, entryReady]);

  if (!hydrated || !entryReady) {
    return (
      <div className="settings-workspace">
        <div className="workspace-loading">
          <div className="workspace-loading-spinner" />
          <span className="workspace-loading-text">Loading settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-workspace">
      <h1 className="page-title">Settings</h1>

      <div className="settings-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`settings-tab${activeTab === tab.id ? " is-active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {message && (
        <div className={`settings-message settings-message--${messageType}`}>
          {message}
        </div>
      )}

      {activeTab === "profile" && (
        <section className="settings-section">
          <h2 className="settings-section-title">Profile</h2>
          <div className="settings-row">
            <div>
              <div className="settings-label">Care Key</div>
              <div className="settings-hint">
                Your durable identity for this browser. Do not share.
              </div>
            </div>
            <div className="settings-value">{careKey ? `${careKey.slice(0, 8)}…` : "—"}</div>
          </div>
          <div className="settings-actions">
            <button type="button" className="settings-button" onClick={handleCopyCareKey}>
              Copy care key
            </button>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Session ID</div>
              <div className="settings-hint">
                Temporary interaction session (not your durable identity).
              </div>
            </div>
            <div className="settings-value">{sessionId ? `${sessionId.slice(0, 8)}…` : "—"}</div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Telemetry ID</div>
              <div className="settings-hint">
                Anonymous usage identifier for product improvement.
              </div>
            </div>
            <div className="settings-value">{telemetryUserId ? `${telemetryUserId.slice(0, 8)}…` : "—"}</div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Account</div>
              <div className="settings-hint">
                Your SolenOS profile is tied to the care key stored in this browser.
                No separate username is required — you sign in with the email and password used during early access.
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "notifications" && (
        <section className="settings-section">
          <h2 className="settings-section-title">Notifications</h2>
          <p className="settings-hint" style={{ marginBottom: "1rem" }}>
            Control how and when SolenOS notifies you about care updates.
          </p>
          <SettingsManager />
        </section>
      )}

      {activeTab === "privacy" && (
        <section className="settings-section">
          <h2 className="settings-section-title">Privacy & Data</h2>
          <div className="settings-row">
            <div>
              <div className="settings-label">Local data</div>
              <div className="settings-hint">
                Clear all locally stored care data. This cannot be undone.
              </div>
            </div>
          </div>
          <div className="settings-actions">
            <button type="button" className="settings-button settings-button--danger" onClick={handleClearLocalData}>
              Clear local data
            </button>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Data permissions</div>
              <div className="settings-hint">
                Only information you choose to upload is stored.
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Delete my data</div>
              <div className="settings-hint">
                Contact support to request deletion as the platform grows.
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Privacy policy</div>
              <div className="settings-hint">
                <Link href="/privacy" className="settings-link">Read the Privacy Policy</Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "security" && (
        <section className="settings-section">
          <h2 className="settings-section-title">Security</h2>
          <div className="settings-row">
            <div>
              <div className="settings-label">Session</div>
              <div className="settings-hint">
                Your current interaction session. Sessions are temporary and rotate automatically.
              </div>
            </div>
            <div className="settings-value">{sessionId ? `${sessionId.slice(0, 12)}…` : "—"}</div>
          </div>
          <div className="settings-actions">
            <button
              type="button"
              className="settings-button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.localStorage.removeItem("solenos_care_session_id");
                  showMessage("New session started. Refresh to continue.", "success");
                  setTimeout(() => window.location.reload(), 1200);
                }
              }}
            >
              Start new session
            </button>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Care key</div>
              <div className="settings-hint">
                Your durable identity. Never share this value.
              </div>
            </div>
            <div className="settings-value">{careKey ? `${careKey.slice(0, 8)}…` : "—"}</div>
          </div>
          <div className="settings-actions">
            <button type="button" className="settings-button" onClick={handleCopyCareKey}>
              Copy care key
            </button>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Authentication</div>
              <div className="settings-hint">
                SolenOS uses email and password to restore your care record across devices.
              </div>
            </div>
          </div>

          <div className="settings-row">
            <div>
              <div className="settings-label">Unauthorized access</div>
              <div className="settings-hint">
                If you notice unauthorized access, contact support immediately.
              </div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "legal" && (
        <section className="settings-section">
          <h2 className="settings-section-title">Legal</h2>
          <div className="settings-row">
            <div className="settings-label">Terms of Service</div>
            <Link href="/terms" className="settings-link">Terms</Link>
          </div>
          <div className="settings-row">
            <div className="settings-label">Privacy Policy</div>
            <Link href="/privacy" className="settings-link">Privacy</Link>
          </div>
          <div className="settings-row">
            <div className="settings-label">Version</div>
            <div className="settings-value">0.1.0</div>
          </div>
          <div className="settings-row">
            <div className="settings-label">Contact support</div>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="settings-link">{SUPPORT_EMAIL}</a>
          </div>
        </section>
      )}
    </div>
  );
}
