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
import { caregiverSafeErrorMessage } from "@/lib/caregiver-language";
import { useWorkspace } from "@/lib/workspace-context";
import { SUPPORT_EMAIL } from "@/lib/early-access-trust";
import { createAccount, deleteJSON, ensureAnonymousSession, getAnonymousAccessToken, getJSON, patchJSON, postJSON, putJSON, revokeAnonymousSession, signInToAccount } from "@/api/client";
import { PolicySettingsPanel } from "@/components/mvp-workspace/PolicySettingsPanel";
import { IdentityDeviceRecoveryPanel } from "@/components/mvp-workspace/IdentityDeviceRecoveryPanel";

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
  const [pushBusy, setPushBusy] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushAvailable, setPushAvailable] = useState(false);

  useEffect(() => {
    let active = true;
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.getRegistration("/").then(async (registration) => {
        const subscription = await registration?.pushManager.getSubscription();
        if (active) setPushEnabled(Boolean(subscription));
      }).catch(() => {
        if (active) setPushEnabled(false);
      });
    }
    void ensureAnonymousSession()
      .then(() => getJSON("/notifications/push/public-key"))
      .then((result) => {
        const capability = result as { available?: boolean; public_key?: string | null };
        if (active) setPushAvailable(Boolean(capability.available && capability.public_key));
      })
      .catch(() => {
        if (active) setPushAvailable(false);
      });
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

  const enablePushNotifications = async () => {
    setPushBusy(true);
    setPushStatus("");
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        throw new Error("This browser does not support Web Push notifications.");
      }
      await ensureAnonymousSession();
      const permission = Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();
      if (permission !== "granted") {
        throw new Error("Notification permission was not granted. You can enable it in your browser settings.");
      }
      const keyResult = await getJSON("/notifications/push/public-key") as { available?: boolean; public_key?: string | null };
      if (!keyResult.available || !keyResult.public_key) {
        setPushAvailable(false);
        throw new Error("Browser push is not configured on this server yet. In-app notifications remain available.");
      }
      const publicKey = keyResult.public_key;
      const padding = "=".repeat((4 - publicKey.length % 4) % 4);
      const base64 = (publicKey + padding).replace(/-/g, "+").replace(/_/g, "/");
      const raw = window.atob(base64);
      const applicationServerKey = new Uint8Array(raw.length);
      for (let index = 0; index < raw.length; index += 1) applicationServerKey[index] = raw.charCodeAt(index);
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription()
        || await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      await postJSON("/notifications/push/subscriptions", subscription.toJSON());
      setPushEnabled(true);
      setPushStatus("Push is enabled on this browser. Delivery is reported when the push provider accepts it; device display still depends on browser and operating-system settings.");
      show("Push notifications enabled on this browser.", "success");
    } catch (reason) {
      const message = "We couldn't enable push notifications. In-app notifications are still available.";
      setPushStatus(message);
      show("Push notifications weren't enabled.", "error");
    } finally {
      setPushBusy(false);
    }
  };

  const disablePushNotifications = async () => {
    setPushBusy(true);
    setPushStatus("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await ensureAnonymousSession();
        await deleteJSON("/notifications/push/subscriptions", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setPushEnabled(false);
      setPushStatus("Push notifications are disabled on this browser.");
      show("Push notifications disabled.", "success");
    } catch {
      setPushStatus("We couldn't disable push notifications. The existing subscription has been left unchanged.");
      show("Push notifications weren't disabled.", "error");
    } finally {
      setPushBusy(false);
    }
  };

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
        <span><span className="mobile-settings-label">Care reminders</span><span className="mobile-settings-hint">When enabled, due reminders appear in your in-app notifications. Browser push is optional; SolenOS does not send email alerts.</span></span>
        <span className="mobile-toggle"><input type="checkbox" checked={reminders} disabled={loading || saving || Boolean(error)} onChange={(e) => void persist("reminders_enabled", e.target.checked)} /><span className="mobile-toggle-track" /></span>
      </label>
      <div className="mobile-settings-actions">
        <Button variant="secondary" asChild><Link href="/workspace/reminders">Manage care reminders</Link></Button>
        {pushAvailable ? (pushEnabled ? <Button variant="secondary" onClick={disablePushNotifications} disabled={pushBusy || loading}>{pushBusy ? "Updating…" : "Disable push alerts"}</Button> : <Button variant="secondary" onClick={enablePushNotifications} disabled={pushBusy || loading}>{pushBusy ? "Enabling…" : "Enable push alerts"}</Button>) : <span className="mobile-settings-hint">Browser push is not configured on this server yet. In-app notifications remain available.</span>}
        <Button variant="secondary" onClick={() => void loadInbox()} disabled={inboxLoading}>Refresh notifications</Button>
      </div>
      {pushStatus && <p className="mobile-settings-hint" role="status">{pushStatus}</p>}
      <div id="settings-notifications" className="settings-notification-inbox" aria-label="Notification inbox">
        <h3 className="mobile-settings-label">Recent notifications · {unreadCount} unread</h3>
        {inboxLoading && <p className="mobile-settings-hint" role="status">Loading notifications…</p>}
        {inboxError && <p className="mobile-settings-hint" role="alert">{inboxError}</p>}
        {!inboxLoading && !inboxError && notifications.length === 0 && <p className="mobile-settings-hint">No notifications yet. When a saved care reminder is due, it will appear here. Care updates that need your attention will appear here too.</p>}
        {notifications.map((item) => (
          <article key={item.id} className="mobile-settings-row" aria-label={item.title}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mobile-settings-label">{item.title}</span>
              <span className="mobile-settings-hint">{item.body}</span>
              <span className="mobile-settings-hint">{item.created_at ? new Date(item.created_at).toLocaleString() : "Date unavailable"} · {item.priority} · {notificationCategoryLabel(item.category)}</span>
              {item.category === "open_loop_due" && <Link href="/workspace/open-loops" className="mobile-settings-hint">Review follow-ups</Link>}
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
        setMessage("Account created and linked to this care record.");
        setMode("idle");
        setPassword("");
        show("Account created.", "success");
      } else if (mode === "login") {
        const result = await signInToAccount(email, password);
        setAccount(result.account);
        setSignedOut(false);
        setMessage("Signed in. Your existing care record is available in this session.");
        setMode("idle");
        setPassword("");
        show("Signed in to your care record.", "success");
      } else if (mode === "delete") {
        await deleteJSON("/accounts/me", { password });
        setAccount(null);
        setMessage("Account deleted. Your care record remains available in this anonymous session; deleting the account does not erase care history.");
        setMode("idle");
        setPassword("");
        show("Account deleted. Care history was retained.", "success");
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
      setMessage("Signed out securely. Your care record remains on SolenOS. Sign in again to restore access on this browser.");
      show("Signed out securely.", "success");
    } catch (e) {
      const detail = e instanceof Error ? e.message : "";
      setError("We couldn’t complete sign-out. Your current session is still available. Check your connection and try again.");
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
          {loadFailed && <Button variant="secondary" onClick={() => void refreshAccount()} disabled={busy}>Retry account status</Button>}
        </div>
      )}
      {signedOut && !account && mode === "idle" && (
        <p className="mobile-settings-hint">Your previous care record is protected. Sign in with the same account to access it again; creating a new account here would not recover that record.</p>
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

          {mode === "delete" && <p className="mobile-settings-hint">This deletes the email/password account, not the Living Care Record or its care history. Those remain under the current anonymous session.</p>}
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
          <strong>Save this one-time recovery code now.</strong>
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

/** Privacy & Data — clear/delete local data + data-training toggle. */
function PrivacyCard() {
  const { show, render } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);

  const clearLocalData = () => {
    const keys = [
      // identity
      "solenos_durable_care_key",
      "solenos_care_session_id",
      "solenos_telemetry_user_id",
      // Current server-issued session credentials. Clearing them removes this browser's access.
      "solenos_anonymous_access_token",
      "solenos_backend_person_id",
      "solenos_backend_caregiver_id",
      "solenos_anonymous_session_expires_at",
      "solenos_person_id",
      "solenos_device_installation_key_v1",
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

      <PolicySettingsPanel />

      {confirmClear && <p className="mobile-settings-hint" role="alert">This removes saved information and sign-in credentials from this browser. If you have no other recovery method, you may not be able to reopen this care record on this device. It does not delete the server-held care history.</p>}
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
      <div className="mobile-page-head settings-page-heading">
        <span className="settings-eyebrow">YOUR CARE SPACE</span>
        <h1>Settings</h1>
        <p>Keep your care space personal, protected, and working the way you need.</p>
      </div>
      <nav className="settings-section-nav" aria-label="Settings sections">
        <a href="#settings-profile">Profile</a>
        <a href="#settings-notifications">Notifications</a>
        <a href="#settings-account">Account</a>
        <a href="#settings-security">Security</a>
        <a href="#settings-privacy">Privacy &amp; data</a>
        <a href="#settings-help">Help</a>
      </nav>
      <div className="mobile-settings settings-page-grid">
        <div className="settings-section-wrap" id="settings-profile"><div className="settings-section-intro"><span>01</span><div><h2>Your care profile</h2><p>Personal details used to make your care space easier to recognize.</p></div></div><ProfileCard /></div>
        <div className="settings-section-wrap" id="settings-notifications"><div className="settings-section-intro"><span>02</span><div><h2>Notifications</h2><p>Choose how routine care updates reach you.</p></div></div><NotificationsCard /></div>
        <div className="settings-section-wrap" id="settings-account"><div className="settings-section-intro"><span>03</span><div><h2>Account access</h2><p>An account is optional. Anonymous care access remains available.</p></div></div><AccountCard /></div>
        <div className="settings-section-wrap" id="settings-security"><div className="settings-section-intro"><span>04</span><div><h2>Devices and account access</h2><p>Review registered devices and request help recovering access.</p></div></div><IdentityDeviceRecoveryPanel /></div>
        <div className="settings-section-wrap" id="settings-privacy"><div className="settings-section-intro"><span>05</span><div><h2>Privacy &amp; data</h2><p>Manage optional improvement consent and local information.</p></div></div><PrivacyCard /></div>
        <div className="settings-section-wrap" id="settings-help"><div className="settings-section-intro"><span>06</span><div><h2>Help &amp; information</h2><p>Find support, policies, and information about SolenOS.</p></div></div><LegalCard /><ProductCard /></div>
      </div>
    </div>
  );
}
