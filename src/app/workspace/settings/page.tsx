"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  Bell,
  FileText,
  Info,
  Share2,
  Shield,
  Trash2,
  User,
  UserPlus,
} from "lucide-react";

import { Button, type ButtonVariant } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { useWorkspace } from "@/lib/workspace-context";
import { getOnboardingCompletedAt } from "@/lib/onboarding";
import { SUPPORT_EMAIL } from "@/lib/early-access-trust";
import { deleteJSON, ensureAnonymousSession, getJSON, postJSON, putJSON } from "@/api/client";
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
      <Link href="/workspace/reminders" className="care-reminders-settings-link">Manage care reminders</Link>
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

/** Account controls use the backend and remain scoped to the current care record. */
function AccountCard() {
  const { show, render } = useToast();
  const [account, setAccount] = useState<{ id: string; email: string; created_at: string | null } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [mode, setMode] = useState<"idle" | "create" | "delete">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const refreshAccount = useCallback(async () => {
    try {
      await ensureAnonymousSession();
      const result = await getJSON("/accounts/me") as { account: typeof account };
      setAccount(result.account ?? null);
      setError("");
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
      setError("We couldn’t check account status. Please try again.");
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { void refreshAccount(); }, [refreshAccount]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (mode === "create") {
        const result = await postJSON("/accounts", { email, password }) as { account: typeof account; message?: string };
        setAccount(result.account ?? null);
        setMessage("Account created and linked to this care record.");
        setMode("idle");
        setPassword("");
        show("Account created.", "success");
      } else if (mode === "delete") {
        await deleteJSON("/accounts/me", { password });
        setAccount(null);
        setMessage("Account deleted. Your care record remains available in this anonymous session; deleting the account does not erase care history.");
        setMode("idle");
        setPassword("");
        show("Account deleted. Care history was retained.", "success");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn’t complete that account action. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mobile-settings-account-controls">
      <h2 className="mobile-settings-card-title"><UserPlus size={16} aria-hidden /> Account</h2>
      {!loaded && <p className="mobile-settings-hint" role="status">Loading account options…</p>}
      {loaded && account && mode === "idle" && (
        <div className="mobile-settings-buttons">
          <Button variant="destructive" onClick={() => { setMode("delete"); setPassword(""); setError(""); setMessage(""); }}>
            <Trash2 size={16} aria-hidden /> Delete account
          </Button>
        </div>
      )}
      {loaded && (!account || loadFailed) && mode === "idle" && (
        <div className="mobile-settings-buttons">
          <Button variant="primary" onClick={() => { setMode("create"); setError(""); setMessage(""); }}>
            <UserPlus size={16} aria-hidden /> Create account
          </Button>
        </div>
      )}
      {mode !== "idle" && (
        <form onSubmit={(event) => void submit(event)} style={{ display: "grid", gap: "0.8rem", marginTop: "0.8rem" }}>
          <h3 className="mobile-settings-label" style={{ margin: 0 }}>
            {mode === "create" ? "Create your account" : "Confirm account deletion"}
          </h3>
          {mode === "create" && (
            <label className="mobile-settings-label" htmlFor="account-email">
              Email address
              <input id="account-email" className="mobile-settings-input" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
          )}
          <label className="mobile-settings-label" htmlFor="account-password">
            {mode === "delete" ? "Enter your password to confirm" : "Password"}
            <input id="account-password" className="mobile-settings-input" type="password" autoComplete={mode === "create" ? "new-password" : "current-password"} minLength={mode === "create" ? 12 : 1} maxLength={256} required value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          {mode === "create" && <p className="mobile-settings-hint">Use at least 12 characters.</p>}
          {mode === "delete" && <p className="mobile-settings-hint">This deletes the email/password account, not the Living Care Record or its care history. Those remain under the current anonymous session.</p>}
          {error && <p className="mobile-settings-hint" role="alert">{error}</p>}
          <div className="mobile-settings-actions">
            <Button type="submit" variant={mode === "delete" ? "destructive" : "primary"} loading={busy} disabled={busy}>
              {busy ? "Please wait…" : mode === "create" ? "Create account" : "Delete account"}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => { setMode("idle"); setPassword(""); setError(""); }}>Cancel</Button>
          </div>
        </form>
      )}
      {message && <p className="mobile-settings-hint" role="status">{message}</p>}
      {error && mode === "idle" && <p className="mobile-settings-hint" role="alert">{error} <button type="button" onClick={() => void refreshAccount()} className="mobile-settings-label">Try again</button></p>}
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
    const url = typeof window !== "undefined" ? window.location.origin : "https://solenosai.netlify.app/";
    const shareData = {
      title: "SolenOS",
      text: "I am using SolenOS to keep care information organized.",
      url,
    };
    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share(shareData);
          show("SolenOS shared.", "success");
          return;
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            show("Sharing cancelled.", "info");
            return;
          }
        }
      }
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(url);
          show("SolenOS link copied. You can paste it into a message.", "success");
          return;
        } catch {
          // Try the fallback below for browsers that restrict clipboard access.
        }
      }
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(field);
      if (!copied) throw new Error("Copy failed");
      show("SolenOS link copied. You can paste it into a message.", "success");
    } catch {
      show("We couldn't open sharing or copy the link. Please copy the page address from your browser.", "error");
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
        <p>Manage your care record and preferences.</p>
      </div>
      <div className="mobile-settings">
        <ProfileCard />
        <NotificationsCard />
        <AccountCard />
        <LegalCard />
        <PrivacyCard />
        <ProductCard />
      </div>
    </div>
  );
}
