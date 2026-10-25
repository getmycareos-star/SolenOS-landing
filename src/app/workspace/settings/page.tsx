"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  FileText,
  Info,
  Lock,
  Share2,
  Shield,
  User,
} from "lucide-react";

import { Button, type ButtonVariant } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useWorkspace } from "@/lib/workspace-context";
import { getOnboardingCompletedAt } from "@/lib/onboarding";
import { SUPPORT_EMAIL } from "@/lib/early-access-trust";
import { ensureAnonymousSession, getJSON, putJSON, revokeAnonymousSession } from "@/api/client";
import { PolicySettingsPanel } from "@/components/mvp-workspace/PolicySettingsPanel";

const CARE_RECIPIENT_NAME_STORAGE = "solenos_care_recipient_display_name";

/** Notification controls persist to the authenticated care-record backend. */
function NotificationsCard() {
  const { show, render } = useToast();
  const [quietHours, setQuietHours] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureAnonymousSession();
        const prefs = await getJSON("/notifications/preferences") as {
          quiet_hours_enabled: boolean; reminders_enabled: boolean;
        };
        if (!cancelled) {
          setQuietHours(prefs.quiet_hours_enabled);
          setReminders(prefs.reminders_enabled);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load backend notification preferences.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = async (key: "quiet_hours_enabled" | "reminders_enabled", value: boolean) => {
    setSaving(true);
    setError("");
    try {
      await ensureAnonymousSession();
      const result = await putJSON("/notifications/preferences", { [key]: value }) as {
        quiet_hours_enabled: boolean; reminders_enabled: boolean;
      };
      setQuietHours(result.quiet_hours_enabled);
      setReminders(result.reminders_enabled);
      show("Notification preferences saved to this care record.", "success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save notification preferences.");
      show("Notification preferences were not saved.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title"><Bell size={16} aria-hidden /> Notifications</h2>
      {loading && <p className="mobile-settings-hint" role="status">Loading preferences from the care backend…</p>}
      {error && <p className="mobile-settings-hint" role="alert">{error}</p>}
      <label className="mobile-settings-row">
        <span><span className="mobile-settings-label">Quiet hours</span><span className="mobile-settings-hint">Suppress non-emergency reminders. Emergency handling is not disabled by this preference.</span></span>
        <span className="mobile-toggle"><input type="checkbox" checked={quietHours} disabled={loading || saving || Boolean(error)} onChange={(e) => void persist("quiet_hours_enabled", e.target.checked)} /><span className="mobile-toggle-track" /></span>
      </label>
      <label className="mobile-settings-row">
        <span><span className="mobile-settings-label">Care reminders</span><span className="mobile-settings-hint">Allow care-related reminder notifications.</span></span>
        <span className="mobile-toggle"><input type="checkbox" checked={reminders} disabled={loading || saving || Boolean(error)} onChange={(e) => void persist("reminders_enabled", e.target.checked)} /><span className="mobile-toggle-track" /></span>
      </label>
      <div className="mobile-settings-actions">
        <Button variant="secondary" asChild><Link href="/workspace/notifications">View notifications</Link></Button>
      </div>
      {render()}
    </section>
  );
}

/** Profile — editable care-recipient fields (no internal identifiers). */
function ProfileCard() {
  const { show, render } = useToast();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [condition, setCondition] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(CARE_RECIPIENT_NAME_STORAGE);
      if (stored) setName(stored);
      const meta = window.localStorage.getItem("solenos_care_profile");
      if (meta) {
        const p = JSON.parse(meta) as {
          relationship?: string;
          condition?: string;
        };
        if (p.relationship) setRelationship(p.relationship);
        if (p.condition) setCondition(p.condition);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const save = useCallback(() => {
    setSaving(true);
    try {
      window.localStorage.setItem(CARE_RECIPIENT_NAME_STORAGE, name.trim());
      window.localStorage.setItem(
        "solenos_care_profile",
        JSON.stringify({ relationship: relationship.trim(), condition: condition.trim() }),
      );
      show("Saved on this device", "success");
    } catch {
      show("Could not save", "error");
    } finally {
      setSaving(false);
    }
  }, [name, relationship, condition, show]);

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title">
        <User size={16} aria-hidden /> Profile
      </h2>
      <div className="mobile-settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.4rem" }}>
        <label className="mobile-settings-label" htmlFor="mob-name">
          Care recipient name
        </label>
        <input
          id="mob-name"
          className="mobile-settings-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter the care recipient’s preferred name"
        />
      </div>
      <div className="mobile-settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.4rem" }}>
        <label className="mobile-settings-label" htmlFor="mob-relation">
          Relationship
        </label>
        <input
          id="mob-relation"
          className="mobile-settings-input"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
          placeholder="Enter your relationship (optional)"
        />
      </div>
      <div className="mobile-settings-row" style={{ flexDirection: "column", alignItems: "stretch", gap: "0.4rem" }}>
        <label className="mobile-settings-label" htmlFor="mob-condition">
          Condition / stage
        </label>
        <input
          id="mob-condition"
          className="mobile-settings-input"
          value={condition}
          onChange={(e) => setCondition(e.target.value)}
          placeholder="Only enter a confirmed condition or stage (optional)"
        />
      </div>
      <div className="mobile-settings-actions">
        <Button variant="primary" loading={saving} onClick={save}>
          {saving ? undefined : "Save"}
        </Button>
      </div>
      {render()}
    </section>
  );
}

/** Security — show actual bearer-session status and allow server-side revocation. */
function SecurityCard() {
  const { show, render } = useToast();
  const [status, setStatus] = useState<"checking" | "active" | "unavailable" | "revoked">("checking");
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState("");
  const [accountEmail, setAccountEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([checkAuthState(), ensureAnonymousSession()]).then(([account, session]) => {
      if (!cancelled) {
        setStatus("active");
        setExpiresAt(session.expires_at);
        setAccountEmail(account.authenticated ? account.sessionInfo?.account_email || "" : "");
      }
    }).catch(() => {
      if (!cancelled) setStatus("unavailable");
    });
    return () => { cancelled = true; };
  }, []);

  const revoke = async () => {
    setBusy(true);
    try {
      await revokeAnonymousSession();
      setStatus("revoked");
      setExpiresAt("");
      show("This care-record session was revoked by the backend.", "success");
    } catch (e) {
      show(e instanceof Error ? e.message : "The backend could not revoke this session.", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title"><Shield size={16} aria-hidden /> Security</h2>
      <p className="mobile-settings-hint" role="status">
        {status === "checking" ? "Checking the backend-issued care-record session…" :
          status === "active" ? (accountEmail ? `Signed in as ${accountEmail}. Care APIs also use a record-scoped bearer capability.` : "An active, scoped anonymous bearer session is protecting this care record. No account login is active.") :
          status === "revoked" ? "This session has been revoked. Care APIs will reject its token." :
          "No valid session could be confirmed. Protected care operations should remain unavailable until the backend confirms a session."}
      </p>
      {expiresAt && <p className="mobile-settings-hint">Session expires: {new Date(expiresAt).toLocaleString()}</p>}
      <div className="mobile-settings-buttons">
        <Button variant="destructive" disabled={status !== "active" || busy} loading={busy} onClick={() => void revoke()}>
          {busy ? "Revoking…" : "Revoke this session"}
        </Button>
      </div>
      <div className="mobile-settings-buttons">
        <Button variant="secondary" asChild><Link href="/signup">Create account</Link></Button>
        <Button variant="secondary" asChild><Link href="/login">Sign in</Link></Button>
      </div>
      <p className="mobile-settings-hint">
        Account sign-up is optional; anonymous care sessions remain available. Email verification, password reset, and MFA are not implemented.
      </p>
      {render()}
    </section>
  );
}

/** Legal — Terms / Privacy / Contact as real buttons. */
function LegalCard() {
  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title">
        <FileText size={16} aria-hidden /> Legal
      </h2>
      <div className="mobile-settings-buttons">
        <Button variant="secondary" className="mobile-fab-sheet-item" asChild>
          <Link href="/terms">Terms of Service</Link>
        </Button>
        <Button variant="secondary" className="mobile-fab-sheet-item" asChild>
          <Link href="/privacy">Privacy Policy</Link>
        </Button>
        <Button variant="secondary" className="mobile-fab-sheet-item" asChild>
          <a href={`mailto:${SUPPORT_EMAIL}`}>Contact support</a>
        </Button>
      </div>
      <p className="mobile-settings-hint">Version 0.1.0</p>
    </section>
  );
}

/** Privacy & Data — clear/delete local data + data-training toggle. */
function PrivacyCard() {
  const { show, render } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const [consentDate, setConsentDate] = useState<string | null>(null);

  useEffect(() => {
    // Read consent date only after mount — prevents server/client mismatch.
    try {
      const consentAt = getOnboardingCompletedAt();
      setConsentDate(
        consentAt
          ? new Date(consentAt).toLocaleDateString(undefined, {
              month: "long",
              day: "numeric",
              year: "numeric",
            })
          : null,
      );
    } catch {
      setConsentDate(null);
    }
  }, []);

  const clearLocalData = () => {
    const keys = [
      // identity
      "solenos_durable_care_key",
      "solenos_care_session_id",
      "solenos_telemetry_user_id",
      // record
      "solenos_situations",
      "solenos_timeline",
      "solenos_active_situation_id",
      "solenos_care_recipient_display_name",
      "solenos_care_profile",
      "solenos_care_recipient_id",
      "solenos_last_input_raw",
      // preferences
      "solenos_notif_prefs",
      "solenos_data_training",
      "solenos_language_preference",
      "solenos_early_access_consent_v1",
      "onboarding_complete",
      "onboarding_complete_at",
    ];
    keys.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
    show("Local data cleared", "success");
    setConfirmClear(false);
    setTimeout(() => {
      window.location.href = "/start";
    }, 1200);
  };

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title">
        <Shield size={16} aria-hidden /> Privacy &amp; Data
      </h2>

      {consentDate && (
        <div className="mobile-settings-row">
          <span className="mobile-settings-label">Consent</span>
          <span className="mobile-settings-value">Accepted on {consentDate}</span>
        </div>
      )}

      <PolicySettingsPanel />

      <div className="mobile-settings-buttons">
        {confirmClear ? (
          <div className="mobile-settings-actions">
            <Button variant="destructive" onClick={clearLocalData}>
              Clear now
            </Button>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button
            variant="destructive"
            onClick={() => setConfirmClear(true)}
          >
            Clear local data
          </Button>
        )}
        <Button variant="secondary" className="mobile-fab-sheet-item" asChild>
          <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
            "SolenOS data deletion request",
          )}`}>
            Request data deletion
          </a>
        </Button>
        <Button variant="secondary" className="mobile-fab-sheet-item" asChild>
          <a href={`mailto:${SUPPORT_EMAIL}`}>Contact support</a>
        </Button>
        <Button variant="secondary" className="mobile-fab-sheet-item" asChild>
          <Link href="/privacy">Read Privacy Policy</Link>
        </Button>
      </div>
      {render()}
    </section>
  );
}

/** Product — real product info + content links (How It Works, About, Help, etc.). */
function ProductCard() {
  const { show, render } = useToast();
  const items: { label: string; value: string }[] = [
    { label: "App version", value: "0.1.0" },
    { label: "Release channel", value: "Early access" },
    { label: "Environment", value: "Web (Netlify + Railway)" },
  ];

  const contentLinks: { label: string; href: string }[] = [
    { label: "How It Works", href: "/how-it-works" },
    { label: "About", href: "/about" },
    { label: "Help", href: "/help" },
    { label: "Capabilities", href: "/capabilities" },
    { label: "Founder's Story", href: "/our-story" },
    { label: "Our Mission", href: "/mission" },
  ];

  const handleShareSolenos = useCallback(async () => {
    const shareData = {
      title: "SolenOS",
      text: "I am using SolenOS to keep care information organized.",
      url: typeof window !== "undefined" ? window.location.origin : undefined,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        show("Shared ✓", "success");
      } else {
        await navigator.clipboard.writeText(shareData.url ?? "https://solenosai.netlify.app/");
        show("SolenOS link copied", "success");
      }
    } catch {
      show("Could not share", "error");
    }
  }, [show]);

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title">
        <Info size={16} aria-hidden /> Product
      </h2>
      <div className="mobile-settings-buttons">
        {contentLinks.map((link) => (
          <Button
            key={link.href}
            variant="secondary"
            className="mobile-fab-sheet-item"
            asChild
          >
            <Link href={link.href}>{link.label}</Link>
          </Button>
        ))}
      </div>
      <div className="mobile-settings-buttons" style={{ display: "block" }}>
        {items.map((item) => (
          <div key={item.label} className="mobile-settings-row">
            <span className="mobile-settings-label">{item.label}</span>
            <span className="mobile-settings-value">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="settings-product-share">
        <p className="settings-product-share-text">
          Share SolenOS with someone who might find it helpful.
        </p>
        <div className="settings-product-share-actions">
          <Button variant="secondary" onClick={handleShareSolenos}>
            <Share2 size={16} aria-hidden />
            Share SolenOS
          </Button>
        </div>
      </div>
      {render()}
    </section>
  );
}

export default function WorkspaceSettingsPage() {
  const { hydrated, entryReady } = useWorkspace();

  if (!hydrated || !entryReady) {
    return (
      <div className="mobile-screen">
        <div className="mobile-loading">
          <div className="mobile-loading-spinner" aria-hidden="true" />
          <span className="mobile-loading-text">Loading settings…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-screen">
      <div className="mobile-page-head">
        <h1>Settings</h1>
        <p>Manage your care record, notifications, security, and privacy.</p>
      </div>
      <div className="mobile-settings">
        <ProfileCard />
        <NotificationsCard />
        <SecurityCard />
        <LegalCard />
        <PrivacyCard />
        <ProductCard />
      </div>
    </div>
  );
}
