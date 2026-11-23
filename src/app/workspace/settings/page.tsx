"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
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
import { caregiverSafeAssistantText, caregiverSafeErrorMessage, caregiverSafeGeneratedText, caregiverStatusLabel } from "@/lib/caregiver-language";
import { useWorkspace } from "@/lib/workspace-context";
import { SUPPORT_EMAIL } from "@/lib/early-access-trust";
import { createAccount, deleteJSON, ensureAnonymousSession, getAnonymousAccessToken, getJSON, markAnonymousSessionRevokedLocally, patchJSON, postJSON, putJSON, revokeAnonymousSession, signInToAccount } from "@/api/client";
import { PolicySettingsPanel } from "@/components/mvp-workspace/PolicySettingsPanel";
import { IdentityDeviceRecoveryPanel } from "@/components/mvp-workspace/IdentityDeviceRecoveryPanel";
import { CaregiverAccessPanel } from "@/components/mvp-workspace/CaregiverAccessPanel";

const CARE_RECIPIENT_NAME_STORAGE = "solenos_care_recipient_display_name";

type CareNotification = {
  id: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  status?: "active" | "resolved" | "superseded" | "cancelled" | string;
  created_at: string | null;
  resolved_at?: string | null;
  resolution_reason?: string | null;
  is_read: boolean;
  push_delivery?: {
    status: "in_app_only" | "not_attempted" | "pending" | "partial_failure" | "failed" | "accepted_by_push_service" | "cancelled" | "unknown" | string;
    message: string;
    target_count?: number;
    accepted_count?: number;
    pending_count?: number;
    failed_count?: number;
    cancelled_count?: number;
  };
};

function notificationCategoryLabel(category: string): string {
  switch (category) {
    case "care_change":
      return "Care change";
    case "care_attention":
      return "Needs your input";
    case "reminder_due":
      return "Reminder";
    case "open_loop_due":
      return "Time-sensitive follow-up";
    default:
      return "Care update";
  }
}

function notificationReviewHref(category: string): string | null {
  if (category === "care_attention" || category === "care_change") return "/workspace/care-continuity";
  if (category === "open_loop_due") return "/workspace/open-loops";
  if (category === "reminder_due") return "/workspace/reminders";
  return null;
}

/** Notification controls persist to the authenticated care-record backend. */
function NotificationsCard() {
  const { show, render } = useToast();
  const [quietHours, setQuietHours] = useState(false);
  const [scheduleSupported, setScheduleSupported] = useState(false);
  const [quietStart, setQuietStart] = useState("21:00");
  const [quietEnd, setQuietEnd] = useState("08:00");
  const [timezoneName, setTimezoneName] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [reminders, setReminders] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState<CareNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState("");
  const [busyNotificationId, setBusyNotificationId] = useState<string | null>(null);
  const [pushStatus, setPushStatus] = useState("");

  useEffect(() => {
    let active = true;
    const turnOffLegacyBrowserAlerts = async () => {
      try {
        await ensureAnonymousSession();
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription) return;
        try {
          await deleteJSON("/notifications/push/subscriptions", { endpoint: subscription.endpoint });
        } catch {
          // The browser subscription is still removed locally; the server worker
          // also revokes any remaining legacy subscriptions.
        }
        const unsubscribed = await subscription.unsubscribe();
        if (active) {
          setPushStatus(
            unsubscribed
              ? "Browser alerts are off. Reminders appear only in your in-app notifications."
              : "Reminders and care updates appear only in your in-app notifications.",
          );
        }
      } catch {
        if (active) setPushStatus("Reminders and care updates appear only in your in-app notifications.");
      }
    };
    if ("serviceWorker" in navigator) void turnOffLegacyBrowserAlerts();
    return () => { active = false; };
  }, []);

  const loadInbox = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setInboxLoading(true);
    setInboxError("");
    try {
      await ensureAnonymousSession();
      const [feed, unread] = await Promise.all([
        getJSON("/notifications?limit=100&offset=0") as Promise<{ items: CareNotification[] }>,
        getJSON("/notifications/unread-count") as Promise<{ unread_count: number }>,
      ]);
      setNotifications(feed.items ?? []);
      setUnreadCount(unread.unread_count ?? 0);
    } catch {
      setInboxError("We couldn't load notifications. Check your connection and try again.");
    } finally {
      if (!options?.silent) setInboxLoading(false);
    }
  }, []);

  const markNotificationRead = async (item: CareNotification) => {
    if (item.is_read) return;
    setBusyNotificationId(item.id);
    setInboxError("");
    try {
      const updated = await patchJSON("/notifications/" + encodeURIComponent(item.id) + "/read", {}) as CareNotification;
      setNotifications((current) => current.map((row) => row.id === updated.id ? updated : row));
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      setInboxError("We couldn't update this notification. Please try again.");
    } finally {
      setBusyNotificationId(null);
    }
  };

  useEffect(() => {
    void loadInbox();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadInbox({ silent: true });
    };
    const interval = window.setInterval(refreshWhenVisible, 30_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [loadInbox]);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await ensureAnonymousSession();
      const prefs = await getJSON("/notifications/preferences") as {
        quiet_hours_enabled: boolean; reminders_enabled: boolean;
        quiet_hours_start?: string; quiet_hours_end?: string; timezone_name?: string; configured?: boolean;
      };
      setQuietHours(prefs.quiet_hours_enabled);
      setScheduleSupported(typeof prefs.quiet_hours_start === "string" && typeof prefs.quiet_hours_end === "string" && typeof prefs.timezone_name === "string");
      setQuietStart(prefs.quiet_hours_start || "21:00");
      setQuietEnd(prefs.quiet_hours_end || "08:00");
      setTimezoneName(prefs.configured ? (prefs.timezone_name || "UTC") : (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"));
      setReminders(prefs.reminders_enabled);
    } catch {
      setError("We couldn't load your notification settings. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadPreferences(); }, [loadPreferences]);

  const persist = async (key: "quiet_hours_enabled" | "reminders_enabled", value: boolean) => {
    setSaving(true);
    setError("");
    try {
      await ensureAnonymousSession();
      const payload = key === "quiet_hours_enabled"
        ? { quiet_hours_enabled: value, quiet_hours_start: quietStart, quiet_hours_end: quietEnd, timezone_name: timezoneName }
        : { reminders_enabled: value };
      const result = await putJSON("/notifications/preferences", payload) as {
        quiet_hours_enabled: boolean; reminders_enabled: boolean;
        quiet_hours_start: string; quiet_hours_end: string; timezone_name: string;
      };
      setQuietHours(result.quiet_hours_enabled);
      setScheduleSupported(typeof result.quiet_hours_start === "string" && typeof result.quiet_hours_end === "string" && typeof result.timezone_name === "string");
      setQuietStart(result.quiet_hours_start);
      setQuietEnd(result.quiet_hours_end);
      setTimezoneName(result.timezone_name);
      setReminders(result.reminders_enabled);
      show("Notification settings saved.", "success");
    } catch {
      setError("We couldn't save your notification settings. Your previous settings are unchanged.");
      show("Notification settings weren't saved.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title"><Bell size={16} aria-hidden /> Notifications</h2>
      {loading && <p className="mobile-settings-hint" role="status">Loading your notification settings…</p>}
      {error && <div className="mobile-settings-hint" role="alert">
        <p>{error}</p>
        <Button variant="secondary" onClick={() => void loadPreferences()} disabled={loading || saving}>Try again</Button>
      </div>}
      <div className="mobile-settings-row" style={{ alignItems: "flex-start" }}>
        <span style={{ flex: 1 }}>
          <span className="mobile-settings-label">Quiet hours</span>
          <span className="mobile-settings-hint">{scheduleSupported ? "Due reminders wait until quiet hours end. Your reminder due time does not change." : "Quiet-hours times aren't available from the server right now. Your reminders can still appear in your inbox."}</span>
          <span style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
            <label className="mobile-settings-label">Starts
              <input className="mobile-settings-input" type="time" value={quietStart} disabled={loading || saving || !scheduleSupported} onChange={(event) => setQuietStart(event.target.value)} />
            </label>
            <label className="mobile-settings-label">Ends
              <input className="mobile-settings-input" type="time" value={quietEnd} disabled={loading || saving || !scheduleSupported} onChange={(event) => setQuietEnd(event.target.value)} />
            </label>
          </span>
          <span className="mobile-settings-hint">Time zone: {timezoneName}</span>
          <Button variant="secondary" disabled={loading || saving || !scheduleSupported || quietStart === quietEnd} onClick={() => void persist("quiet_hours_enabled", quietHours)}>Save quiet-hours times</Button>
        </span>
        <span className="mobile-toggle"><input type="checkbox" checked={quietHours} disabled={loading || saving || Boolean(error) || !scheduleSupported} onChange={(event) => void persist("quiet_hours_enabled", event.target.checked)} /><span className="mobile-toggle-track" /></span>
      </div>
      <label className="mobile-settings-row">
        <span><span className="mobile-settings-label">Care reminders</span><span className="mobile-settings-hint">When enabled, due reminders appear in your in-app notifications. SolenOS does not send email, text, or browser alerts.</span></span>
        <span className="mobile-toggle"><input type="checkbox" checked={reminders} disabled={loading || saving || Boolean(error)} onChange={(e) => void persist("reminders_enabled", e.target.checked)} /><span className="mobile-toggle-track" /></span>
      </label>
      <div className="mobile-settings-actions">
        <Button variant="secondary" asChild><Link href="/workspace/reminders">Manage care reminders</Link></Button>
        <Button variant="secondary" onClick={() => void loadInbox()} disabled={inboxLoading}>Refresh notifications</Button>
      </div>
      <p className="mobile-settings-hint">Reminders and care updates appear only in your in-app notifications.</p>
      {pushStatus && <p className="mobile-settings-hint" role="status">{pushStatus}</p>}
      <div id="settings-notifications" className="settings-notification-inbox" aria-label="Notification inbox">
        <h3 className="mobile-settings-label">Recent notifications · {unreadCount} unread</h3>
        {inboxLoading && <p className="mobile-settings-hint" role="status">Loading notifications…</p>}
        {inboxError && <p className="mobile-settings-hint" role="alert">{inboxError}</p>}
        {!inboxLoading && !inboxError && notifications.length === 0 && <p className="mobile-settings-hint">No notifications yet. When a saved care reminder is due, it will appear here. Care updates that need your attention will appear here too.</p>}
        {notifications.map((item) => (
          <article key={item.id} className="mobile-settings-row" aria-label={caregiverSafeGeneratedText(item.title) || "Care notification"}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mobile-settings-label">{caregiverSafeGeneratedText(item.title) || "Care update"}</span>
              <span className="mobile-settings-hint">{caregiverSafeGeneratedText(item.body) || "Open your Care Record to review this update."}</span>
              <span className="mobile-settings-hint">{item.created_at ? new Date(item.created_at).toLocaleString() : "Date unavailable"} · {caregiverStatusLabel(item.priority) || "Priority not available"} · {notificationCategoryLabel(item.category)}</span>
              {notificationReviewHref(item.category) && (
                <Link href={notificationReviewHref(item.category)!} className="mobile-settings-hint">
                  {item.category === "open_loop_due" ? "Review follow-ups" : item.category === "reminder_due" ? "Review reminders" : "Review in Care Record"}
                </Link>
              )}
              {(item.status ?? "active") === "active"
                ? <span className="mobile-settings-hint">Needs attention</span>
                : <span className="mobile-settings-hint">{item.status === "superseded" ? "Replaced by newer information" : item.status === "resolved" ? "No longer needs attention" : "Cancelled"}</span>}
              {item.resolved_at && <span className="mobile-settings-hint">Updated {new Date(item.resolved_at).toLocaleString()}</span>}
              {item.status !== undefined && item.status !== "active" && <span className="mobile-settings-hint">{item.resolution_reason === "source_superseded" ? "A newer care record update replaced this message." : item.resolution_reason === "question_resolved" ? "The care question has since been resolved." : item.resolution_reason === "necessity_or_evidence_no_longer_valid" ? "The supporting information changed; no response is currently needed." : "The care record has changed since this message was created."}</span>}
              {item.is_read && <span className="mobile-settings-hint">Read</span>}
            </span>
            {!item.is_read && <Button variant="secondary" disabled={busyNotificationId === item.id} loading={busyNotificationId === item.id} onClick={() => void markNotificationRead(item)}><Check size={14} aria-hidden /> Mark read</Button>}
          </article>
        ))}
      </div>
      {render()}
    </section>
  );
}

/** Profile fields are read from and written to the bearer-scoped care record. */
function ProfileCard() {
  const { show, render } = useToast();
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [condition, setCondition] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setLoadError("");
      try {
        await ensureAnonymousSession();
        const persisted = await getJSON("/care-profile") as {
          name?: string;
          relationship?: string;
          condition?: string | null;
        };

        // One-time migration of older device-only profile values. They are
        // removed only after the server confirms the durable write.
        let legacyName = "";
        let legacyRelationship = "";
        let legacyCondition = "";
        try {
          legacyName = window.localStorage.getItem(CARE_RECIPIENT_NAME_STORAGE) ?? "";
          const legacy = window.localStorage.getItem("solenos_care_profile");
          if (legacy) {
            const parsed = JSON.parse(legacy) as { relationship?: string; condition?: string };
            legacyRelationship = parsed.relationship ?? "";
            legacyCondition = parsed.condition ?? "";
          }
        } catch {
          // Corrupt legacy device data is ignored; PostgreSQL remains authoritative.
        }

        const resolved = {
          name: legacyName.trim() && (!persisted.name?.trim() || persisted.name === "Care recipient")
            ? legacyName.trim()
            : persisted.name?.trim() || legacyName.trim(),
          relationship: legacyRelationship.trim() && (!persisted.relationship?.trim() || persisted.relationship === "Family")
            ? legacyRelationship.trim()
            : persisted.relationship?.trim() || legacyRelationship.trim(),
          condition: persisted.condition?.trim() || legacyCondition.trim(),
        };
        const needsLegacyMigration = Boolean(
          legacyName.trim() || legacyRelationship.trim() || legacyCondition.trim(),
        ) && Boolean(
          (legacyName.trim() && (!persisted.name?.trim() || persisted.name === "Care recipient")) ||
          (legacyRelationship.trim() && (!persisted.relationship?.trim() || persisted.relationship === "Family")) ||
          (legacyCondition.trim() && !persisted.condition?.trim()),
        );

        let profile = persisted;
        if (needsLegacyMigration && resolved.name) {
          profile = await putJSON("/care-profile", {
            name: resolved.name,
            relationship: resolved.relationship,
            condition: resolved.condition || null,
          }) as typeof persisted;
          try {
            window.localStorage.removeItem(CARE_RECIPIENT_NAME_STORAGE);
            window.localStorage.removeItem("solenos_care_profile");
          } catch {
            // The server write is already authoritative; stale legacy keys are harmless.
          }
        }

        if (!active) return;
        setName(profile.name ?? "");
        setRelationship(profile.relationship ?? "");
        setCondition(profile.condition ?? "");
      } catch {
        if (active) setLoadError("We couldn't load your saved profile. Your changes are not available until the care record reconnects.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    try {
      await ensureAnonymousSession();
      const saved = await putJSON("/care-profile", {
        name: name.trim(),
        relationship: relationship.trim(),
        condition: condition.trim() || null,
      }) as { name: string; relationship: string; condition?: string | null };
      setName(saved.name);
      setRelationship(saved.relationship);
      setCondition(saved.condition ?? "");
      show("Care profile saved to your care record.", "success");
    } catch {
      show("Your care profile wasn't saved. Check your connection and try again.", "error");
    } finally {
      setSaving(false);
    }
  }, [name, relationship, condition, show]);

  return (
    <section className="mobile-settings-card">
      <h2 className="mobile-settings-card-title">
        <User size={16} aria-hidden /> Profile
      </h2>
      {loading && <p className="mobile-settings-hint" role="status">Loading your saved care profile…</p>}
      {loadError && <p className="mobile-settings-hint" role="alert">{loadError}</p>}
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
        <p className="mobile-settings-hint">This is retained as caregiver-reported context, not an independently verified clinical fact.</p>
      </div>
      <div className="mobile-settings-actions">
        <Button variant="primary" loading={saving} disabled={loading || Boolean(loadError) || !name.trim()} onClick={save}>
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
  const [signedOut, setSignedOut] = useState(false);
  const [mode, setMode] = useState<"idle" | "create" | "login" | "delete">("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [rotatingRecoveryCode, setRotatingRecoveryCode] = useState(false);

  const refreshAccount = useCallback(async () => {
    // Do not create a new anonymous care record merely to inspect account status.
    // A returning caregiver without a local token must be able to sign in first.
    if (!getAnonymousAccessToken()) {
      setAccount(null);
      setLoadFailed(false);
      setLoaded(true);
      setError("");
      return;
    }
    try {
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
        const result = await createAccount(email, password);
        setAccount(result.account ?? null);
        setRecoveryCode(result.recovery_code);
        setMessage("Account created and linked to your Care Record.");
        setMode("idle");
        setPassword("");
        show("Account created.", "success");
      } else if (mode === "login") {
        const result = await signInToAccount(email, password);
        setAccount(result.account);
        setSignedOut(false);
        setMessage("Signed in. Your existing Care Record is available.");
        setMode("idle");
        setPassword("");
        show("Signed in to your care record.", "success");
      } else if (mode === "delete") {
        await deleteJSON("/accounts/me", { password });
        setAccount(null);
        setMessage("Account deleted. Your Care Record and care history were not deleted.");
        setMode("idle");
        setPassword("");
        show("Account deleted. Your Care Record was not deleted.", "success");
      }
    } catch (e) {
      const detail = e instanceof Error ? e.message : "";
      if (mode === "create" && (e instanceof TypeError || /network|fetch|timed out|timeout/i.test(detail))) {
        setError("We couldn’t confirm whether account creation completed. Your care record remains intact. Try signing in with the same email and password before attempting registration again.");
      } else {
        setError(caregiverSafeErrorMessage());
      }
    } finally {
      setBusy(false);
    }
  };

  const generateRecoveryCode = async () => {
    setRotatingRecoveryCode(true);
    setError("");
    setRecoveryCode("");
    try {
      const result = await postJSON("/accounts/recovery-code", {}) as { recovery_code: string; message: string };
      setRecoveryCode(result.recovery_code);
      setMessage("A new recovery code is ready. Store it somewhere safe.");
    } catch (e) {
      setError(caregiverSafeErrorMessage());
    } finally {
      setRotatingRecoveryCode(false);
    }
  };

  const signOut = async () => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      // Revoke on the server before removing the browser's bearer capability.
      // If the network call fails, revokeAnonymousSession leaves credentials intact.
      await revokeAnonymousSession();
      setAccount(null);
      setSignedOut(true);
      setMode("idle");
      setEmail("");
      setPassword("");
      setMessage("Signed out securely. Your Care Record is still saved. Sign in with the same account on this or another authorized device to access it.");
      show("Signed out securely.", "success");
    } catch (e) {
      const detail = e instanceof Error ? e.message : "";
      setError("We couldn’t sign you out. You are still signed in. Check your connection and try again.");
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
          <Button variant="secondary" onClick={() => void generateRecoveryCode()} loading={rotatingRecoveryCode} disabled={busy || rotatingRecoveryCode}>
            Generate recovery code
          </Button>
          <Button variant="secondary" onClick={() => void signOut()} loading={busy} disabled={busy}>
            Sign out
          </Button>
          <Button variant="destructive" onClick={() => { setMode("delete"); setPassword(""); setError(""); setMessage(""); }} disabled={busy}>
            <Trash2 size={16} aria-hidden /> Delete account
          </Button>
        </div>
      )}
      {loaded && !account && mode === "idle" && (
        <div className="mobile-settings-buttons">
          {!signedOut && <Button variant="primary" onClick={() => { setMode("create"); setError(""); setMessage(""); }}>
            <UserPlus size={16} aria-hidden /> Create account
          </Button>}
          <Button variant="secondary" onClick={() => { setMode("login"); setError(""); setMessage(""); }}>
            Sign in to an existing account
          </Button>
          {loadFailed && <Button variant="secondary" onClick={() => void refreshAccount()} disabled={busy}>Check again</Button>}
        </div>
      )}
      {signedOut && !account && mode === "idle" && (
        <p className="mobile-settings-hint">Your previous Care Record is still saved. Sign in with the same account to access it; creating a new account will not bring that record back.</p>
      )}
      {mode !== "idle" && (
        <form onSubmit={(event) => void submit(event)} style={{ display: "grid", gap: "0.8rem", marginTop: "0.8rem" }}>
          <h3 className="mobile-settings-label" style={{ margin: 0 }}>
            {mode === "create" ? "Create your account" : mode === "login" ? "Sign in to your account" : "Confirm account deletion"}
          </h3>
          {(mode === "create" || mode === "login") && (
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
          {mode === "login" && <p className="mobile-settings-hint">Sign in with the email and password linked to your existing care record.</p>}

          {mode === "delete" && <p className="mobile-settings-hint">This deletes your account login. It does not delete your Care Record or care history.</p>}
          {error && <p className="mobile-settings-hint" role="alert">{error}</p>}
          <div className="mobile-settings-actions">
            <Button type="submit" variant={mode === "delete" ? "destructive" : "primary"} loading={busy} disabled={busy}>
              {busy ? "Please wait…" : mode === "create" ? "Create account" : mode === "login" ? "Sign in" : "Delete account"}
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => { setMode("idle"); setPassword(""); setError(""); }}>Cancel</Button>
          </div>
        </form>
      )}
      {message && <p className="mobile-settings-hint" role="status">{message}</p>}
      {recoveryCode && (
        <div className="mobile-settings-hint" role="alert" style={{ border: "1px solid var(--border, #d8ded8)", borderRadius: "0.75rem", padding: "0.8rem" }}>
          <strong>Save this recovery code now.</strong>
          <p>This code is shown only once. Store it somewhere private and separate from this device. Anyone with the code and your account email can reset the account password.</p>
          <code style={{ display: "block", overflowWrap: "anywhere", userSelect: "all", padding: "0.5rem 0" }}>{recoveryCode}</code>
          <Button type="button" variant="secondary" onClick={() => setRecoveryCode("")}>I have saved the code</Button>
        </div>
      )}
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

function privacyRequestStatusLabel(status: string): string {
  switch (status) {
    case "received_pending_authority_review":
      return "Waiting for review";
    case "approved_pending_fulfilment_assessment":
      return "Approved; deletion still needs to be checked";
    case "fulfilled":
      return "Completed";
    case "rejected":
      return "Not approved";
    default:
      return "We’ll update you when we know more";
  }
}

/** Privacy & Data — clear/delete local data + data-training toggle. */
function PrivacyCard() {
  const { show, render } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearingLocalData, setClearingLocalData] = useState(false);
  const [erasureAuthority, setErasureAuthority] = useState<"self" | "parent_or_guardian" | "legal_representative" | "authorized_caregiver" | "other">("other");
  const [erasureAttested, setErasureAttested] = useState(false);
  const [erasureSubmitting, setErasureSubmitting] = useState(false);
  const [erasureRequest, setErasureRequest] = useState<{ id: string; status: string; message: string } | null>(null);
  const [erasureHistory, setErasureHistory] = useState<Array<{ id: string; request_type: string; status: string; requested_at: string | null }>>([]);
  const [erasureHistoryLoading, setErasureHistoryLoading] = useState(true);
  const [erasureError, setErasureError] = useState("");

  const loadErasureHistory = useCallback(async () => {
    setErasureHistoryLoading(true);
    setErasureError("");
    try {
      await ensureAnonymousSession();
      const result = await getJSON("/privacy/requests") as { requests?: Array<{ id: string; request_type: string; status: string; requested_at: string | null }> };
      setErasureHistory((result.requests ?? []).filter((item) => item.request_type === "deletion"));
    } catch {
      setErasureError("We couldn't load your previous privacy requests. You can try again.");
    } finally {
      setErasureHistoryLoading(false);
    }
  }, []);

  useEffect(() => { void loadErasureHistory(); }, [loadErasureHistory]);

  const hasUnresolvedErasureRequest = erasureHistory.some((item) =>
    ["received_pending_authority_review", "approved_pending_fulfilment_assessment"].includes(item.status)
  );

  const submitCareRecordErasureRequest = async () => {
    if (!erasureAttested || erasureSubmitting || hasUnresolvedErasureRequest) return;
    setErasureSubmitting(true);
    setErasureError("");
    try {
      const result = await postJSON("/privacy/requests", {
        request_type: "deletion",
        authority_basis: erasureAuthority,
        authority_attested: true,
      }) as { id: string; status: string; message: string };
      setErasureRequest(result);
      setErasureHistory((current) => [{
        id: result.id,
        request_type: "deletion",
        status: result.status,
        requested_at: new Date().toISOString(),
      }, ...current]);
      show("Your care-record erasure request was received.", "success");
    } catch {
      await loadErasureHistory();
      setErasureError("We couldn't submit a new request. If a request is already open, it will appear in your request history. Your care record has not been erased.");
      show("Your erasure request wasn't submitted.", "error");
    } finally {
      setErasureSubmitting(false);
    }
  };

  const clearLocalData = async () => {
    if (clearingLocalData) return;
    setClearingLocalData(true);
    let pushSubscriptionRemoved = true;
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const subscription = await registration?.pushManager.getSubscription();
        if (subscription) {
          if (getAnonymousAccessToken()) {
            await deleteJSON("/notifications/push/subscriptions", { endpoint: subscription.endpoint });
          } else {
            // Never create a replacement anonymous care session just to clean up
            // an old push subscription after the caregiver has already signed out.
            pushSubscriptionRemoved = false;
          }
          const browserUnsubscribed = await subscription.unsubscribe();
          pushSubscriptionRemoved = pushSubscriptionRemoved && browserUnsubscribed;
        }
      }
    } catch {
      // Do not claim push removal when the server or browser rejected it.
      pushSubscriptionRemoved = false;
    }

    let serverSessionRevoked = !getAnonymousAccessToken();
    let localRevocationMarkerSaved = false;
    if (!serverSessionRevoked) {
      try {
        await revokeAnonymousSession();
        serverSessionRevoked = true;
        localRevocationMarkerSaved = true;
      } catch {
        // Still clear local data, but do not claim that the server session was revoked.
      }
    }

    // A local deletion marker is required even when no bearer token exists or
    // server revocation fails. Otherwise the next background request could
    // silently mint a replacement care record on this device.
    if (!localRevocationMarkerSaved) {
      try {
        markAnonymousSessionRevokedLocally();
        localRevocationMarkerSaved = true;
      } catch {
        // Report the limitation below; never claim the local deletion boundary was retained.
      }
    }

    // Clear every SolenOS-owned browser key except the deletion marker. That
    // marker must survive this sweep so only explicit Care Record entry can
    // create a replacement session. Unrelated origin data is preserved.
    try {
      const ownedKeys = Array.from({ length: window.localStorage.length }, (_, index) =>
        window.localStorage.key(index)
      ).filter((key): key is string =>
        Boolean(key &&
          key !== "solenos_anonymous_session_revoked" &&
          (key.startsWith("solenos_") || key.startsWith("solenos:") || key === "onboarding_complete" || key === "onboarding_complete_at"))
      );
      ownedKeys.forEach((key) => window.localStorage.removeItem(key));
    } catch {
      // Continue clearing other browser storage even if localStorage is unavailable.
    }

    try {
      window.sessionStorage.clear();
    } catch {
      // Session storage may be unavailable in restricted browser contexts.
    }

    // Clear visible SolenOS notifications. Keep the service worker installed
    // so the browser can register a fresh subscription if the caregiver opts in later.
    try {
      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration("/");
        const notifications = await registration?.getNotifications();
        notifications?.forEach((notification) => notification.close());
      }
    } catch {
      // Notification cleanup must not prevent local data removal.
    }

    const cleanupWarnings = [
      ...(!serverSessionRevoked ? ["We couldn’t confirm that you have been signed out everywhere. Your previous sign-in may stay active until it expires"] : []),
      ...(!localRevocationMarkerSaved ? ["this browser could not retain its deletion marker; automatic record creation may remain possible on a later visit"] : []),
      ...(!pushSubscriptionRemoved ? ["We couldn’t remove notifications from this browser. Check your notification settings"] : []),
    ];
    show(
      cleanupWarnings.length
        ? `Saved SolenOS information was cleared, but ${cleanupWarnings.join("; ")}.`
        : "Saved SolenOS information and this browser's push subscription were cleared.",
      cleanupWarnings.length ? "error" : "success",
    );
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

      <PolicySettingsPanel />

      <div className="mobile-settings-hint" role="note">
        <strong>These actions do different things:</strong>
        <ul>
          <li><strong>Clear this device:</strong> removes saved information and sign-in details from this browser. It does not delete care information held by SolenOS.</li>
          <li><strong>Close or delete an account:</strong> if account closure is available, it stops that account from being used. It does not delete the Care Record or other care information.</li>
          <li><strong>Ask us to delete care information:</strong> asks SolenOS to review your request and remove information that can be deleted. We first check that you are allowed to make the request. If information is shared with others, must be kept for legal reasons, or is still in saved backups or copies held by other services, some parts may take longer or may not be removable. We will tell you what was actually deleted. Sending a request does not delete anything by itself.</li>
        </ul>
      </div>

      {confirmClear && <p className="mobile-settings-hint" role="alert">This removes saved information and sign-in details from this browser. If you have no other way to sign in, you may not be able to open your Care Record on this device. It does not delete your Care Record from SolenOS.</p>}
      <div className="mobile-settings-buttons">
        {confirmClear ? (
          <div className="mobile-settings-actions">
            <Button variant="destructive" onClick={clearLocalData} disabled={clearingLocalData} loading={clearingLocalData}>
              {clearingLocalData ? "Clearing this device…" : "Clear now"}
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
            Clear saved information from this device
          </Button>
        )}
        <div className="mobile-settings-hint" style={{ display: "grid", gap: "0.65rem" }}>
          <strong>Ask us to delete care information</strong>
          {erasureRequest && (
            <>
              <p role="status">We received your request. Reference: {erasureRequest.id}. {privacyRequestStatusLabel(erasureRequest.status)}.</p>
              <p>{caregiverSafeGeneratedText(erasureRequest.message) || "Your request is saved. We will show its status here when an update is available."}</p>
              <p>This is only a request. Your Care Record stays in place until we finish reviewing it and tell you what has been deleted.</p>
            </>
          )}
          {erasureHistoryLoading ? <p>Loading previous requests…</p> : erasureHistory.length > 0 && (
            <div aria-label="Previous requests to delete care information">
              <strong>Request history</strong>
              {erasureHistory.map((item) => (
                <p key={item.id}>Reference {item.id} · {privacyRequestStatusLabel(item.status)} · {item.requested_at ? new Date(item.requested_at).toLocaleDateString() : "Date unavailable"}</p>
              ))}
            </div>
          )}
          {!erasureRequest && (
            <>
              <label className="mobile-settings-label" htmlFor="erasure-authority">Why you can make this request</label>
              <select id="erasure-authority" className="mobile-settings-input" value={erasureAuthority} disabled={erasureSubmitting} onChange={(event) => setErasureAuthority(event.target.value as typeof erasureAuthority)}>
                <option value="self">I am the person this care information is about</option>
                <option value="parent_or_guardian">I am their parent or legal guardian</option>
                <option value="legal_representative">I am their legal representative</option>
                <option value="authorized_caregiver">I have permission to manage this care information</option>
                <option value="other">Another reason</option>
              </select>
              <label className="mobile-settings-label" style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                <input type="checkbox" checked={erasureAttested} disabled={erasureSubmitting} onChange={(event) => setErasureAttested(event.target.checked)} />
                I confirm that the information above is correct and that I am allowed to make this request.
              </label>
              {erasureError && <p role="alert">{erasureError} <button type="button" onClick={() => void loadErasureHistory()}>Try again</button></p>}
              {hasUnresolvedErasureRequest && <p role="status">You already have a request waiting for review. You do not need to send it again.</p>}
              <Button variant="secondary" onClick={() => void submitCareRecordErasureRequest()} disabled={!erasureAttested || erasureSubmitting || erasureHistoryLoading || Boolean(erasureError) || hasUnresolvedErasureRequest} loading={erasureSubmitting}>
                {erasureSubmitting ? "Sending request…" : "Send deletion request"}
              </Button>
              <p>Sending this request does not delete your care information right away. We first check that you are allowed to make the request and whether any information must be kept. We will tell you what we can remove and when it is done.</p>
            </>
          )}
        </div>
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
  const [caregiverAccessOpen, setCaregiverAccessOpen] = useState(false);

  useEffect(() => {
    const openLinkedSection = () => {
      const sectionId = window.location.hash.slice(1);
      const section = sectionId ? document.getElementById(sectionId) : null;
      if (section instanceof HTMLDetailsElement) section.open = true;
    };
    openLinkedSection();
    window.addEventListener("hashchange", openLinkedSection);
    return () => window.removeEventListener("hashchange", openLinkedSection);
  }, []);

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
      <div className="mobile-page-head settings-page-heading">
        <span className="settings-eyebrow">YOUR CARE SPACE</span>
        <h1>Settings</h1>
        <p>Keep your care space personal, protected, and working the way you need.</p>
      </div>
      <div className="mobile-settings settings-page-grid settings-accordion">
        <details className="settings-section-wrap settings-section-disclosure" id="settings-profile">
          <summary className="settings-section-summary"><span className="settings-section-number">01</span><span className="settings-section-summary-copy"><strong>Profile</strong><small>Personal details for your care space</small></span><span className="settings-section-chevron" aria-hidden="true">⌄</span></summary>
          <div className="settings-section-content"><ProfileCard /></div>
        </details>
        <details className="settings-section-wrap settings-section-disclosure" id="settings-notifications">
          <summary className="settings-section-summary"><span className="settings-section-number">02</span><span className="settings-section-summary-copy"><strong>Notifications</strong><small>Care updates, reminders and alerts</small></span><span className="settings-section-chevron" aria-hidden="true">⌄</span></summary>
          <div className="settings-section-content"><NotificationsCard /></div>
        </details>
        <details className="settings-section-wrap settings-section-disclosure" id="settings-account">
          <summary className="settings-section-summary"><span className="settings-section-number">03</span><span className="settings-section-summary-copy"><strong>Account and sign-in</strong><small>Email, password and account access</small></span><span className="settings-section-chevron" aria-hidden="true">⌄</span></summary>
          <div className="settings-section-content"><AccountCard /></div>
        </details>
        <details className="settings-section-wrap settings-section-disclosure" id="settings-caregivers" onToggle={(event) => setCaregiverAccessOpen(event.currentTarget.open)}>
          <summary className="settings-section-summary"><span className="settings-section-number">04</span><span className="settings-section-summary-copy"><strong>Caregiver access</strong><small>People who can access this care record</small></span><span className="settings-section-chevron" aria-hidden="true">⌄</span></summary>
          <div className="settings-section-content"><CaregiverAccessPanel enabled={caregiverAccessOpen} /></div>
        </details>
        <details className="settings-section-wrap settings-section-disclosure" id="settings-security">
          <summary className="settings-section-summary"><span className="settings-section-number">05</span><span className="settings-section-summary-copy"><strong>Devices and recovery</strong><small>Connected devices and help getting back in</small></span><span className="settings-section-chevron" aria-hidden="true">⌄</span></summary>
          <div className="settings-section-content"><IdentityDeviceRecoveryPanel /></div>
        </details>
        <details className="settings-section-wrap settings-section-disclosure" id="settings-privacy">
          <summary className="settings-section-summary"><span className="settings-section-number">06</span><span className="settings-section-summary-copy"><strong>Privacy and data</strong><small>Privacy choices and saved information</small></span><span className="settings-section-chevron" aria-hidden="true">⌄</span></summary>
          <div className="settings-section-content"><PrivacyCard /></div>
        </details>
        <details className="settings-section-wrap settings-section-disclosure" id="settings-help">
          <summary className="settings-section-summary"><span className="settings-section-number">07</span><span className="settings-section-summary-copy"><strong>Help and information</strong><small>Support, policies and product information</small></span><span className="settings-section-chevron" aria-hidden="true">⌄</span></summary>
          <div className="settings-section-content"><LegalCard /><ProductCard /></div>
        </details>
      </div>
    </div>
  );
}
