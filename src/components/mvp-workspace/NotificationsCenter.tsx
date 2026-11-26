"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { caregiverSafeGeneratedText, caregiverStatusLabel } from "@/lib/caregiver-language";
import { deleteJSON, ensureAnonymousSession, getCaregiverId, getPersonId, getJSON, patchJSON, putJSON } from "@/api/client";

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
      return "Care review update";
    case "reminder_due":
      return "Reminder";
    case "open_loop_due":
      return "Follow-up update";
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
export function NotificationsCenter() {
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
  const scopeSequenceRef = useRef(0);
  const inboxRequestSequenceRef = useRef(0);
  const preferencesRequestSequenceRef = useRef(0);

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
    const requestSequence = ++inboxRequestSequenceRef.current;
    const scopeSequence = scopeSequenceRef.current;
    const isCurrentRequest = () =>
      requestSequence === inboxRequestSequenceRef.current
      && scopeSequence === scopeSequenceRef.current;
    if (!options?.silent) setInboxLoading(true);
    setInboxError("");
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || !session.caregiver?.id
        || session.person.id !== getPersonId() || session.caregiver.id !== getCaregiverId()
        || !isCurrentRequest()) return;
      const [feed, unread] = await Promise.all([
        getJSON("/notifications?limit=100&offset=0") as Promise<{ items: CareNotification[] }>,
        getJSON("/notifications/unread-count") as Promise<{ unread_count: number }>,
      ]);
      if (!isCurrentRequest() || session.person.id !== getPersonId() || session.caregiver.id !== getCaregiverId()) return;
      setNotifications(feed.items ?? []);
      setUnreadCount(unread.unread_count ?? 0);
    } catch {
      if (isCurrentRequest()) setInboxError("We couldn't load notifications. Check your connection and try again.");
    } finally {
      if (isCurrentRequest()) setInboxLoading(false);
    }
  }, []);

  const markNotificationRead = async (item: CareNotification) => {
    if (item.is_read) return;
    const requestPersonId = getPersonId();
    const requestCaregiverId = getCaregiverId();
    const scopeSequence = scopeSequenceRef.current;
    const isCurrentScope = () => Boolean(requestPersonId && requestCaregiverId)
      && requestPersonId === getPersonId()
      && requestCaregiverId === getCaregiverId()
      && scopeSequence === scopeSequenceRef.current;
    if (!isCurrentScope()) return;
    setBusyNotificationId(item.id);
    setInboxError("");
    try {
      const updated = await patchJSON("/notifications/" + encodeURIComponent(item.id) + "/read", {}) as CareNotification;
      if (!isCurrentScope()) return;
      setNotifications((current) => current.map((row) => row.id === updated.id ? updated : row));
      setUnreadCount((current) => Math.max(0, current - 1));
      window.dispatchEvent(new Event("solenos:notifications-updated"));
    } catch {
      if (isCurrentScope()) setInboxError("We couldn't update this notification. Please try again.");
    } finally {
      if (isCurrentScope()) setBusyNotificationId(null);
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
    const requestSequence = ++preferencesRequestSequenceRef.current;
    const scopeSequence = scopeSequenceRef.current;
    const isCurrentRequest = () =>
      requestSequence === preferencesRequestSequenceRef.current
      && scopeSequence === scopeSequenceRef.current;
    setLoading(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || !session.caregiver?.id
        || session.person.id !== getPersonId() || session.caregiver.id !== getCaregiverId()
        || !isCurrentRequest()) return;
      const prefs = await getJSON("/notifications/preferences") as {
        quiet_hours_enabled: boolean; reminders_enabled: boolean;
        quiet_hours_start?: string; quiet_hours_end?: string; timezone_name?: string; configured?: boolean;
      };
      if (!isCurrentRequest() || session.person.id !== getPersonId() || session.caregiver.id !== getCaregiverId()) return;
      setQuietHours(prefs.quiet_hours_enabled);
      setScheduleSupported(typeof prefs.quiet_hours_start === "string" && typeof prefs.quiet_hours_end === "string" && typeof prefs.timezone_name === "string");
      setQuietStart(prefs.quiet_hours_start || "21:00");
      setQuietEnd(prefs.quiet_hours_end || "08:00");
      // Quiet-hours delivery uses its own saved timezone, never the
      // Companion's separate caregiver timezone preference.
      setTimezoneName(
        prefs.configured ? (prefs.timezone_name || "UTC") : (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"),
      );
      setReminders(prefs.reminders_enabled);
    } catch {
      if (isCurrentRequest()) setError("We couldn't load your notification settings. Check your connection and try again.");
    } finally {
      if (isCurrentRequest()) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const resetForCareRecipientChange = () => {
      scopeSequenceRef.current += 1;
      inboxRequestSequenceRef.current += 1;
      preferencesRequestSequenceRef.current += 1;
      setNotifications([]);
      setUnreadCount(0);
      setInboxError("");
      setInboxLoading(true);
      setBusyNotificationId(null);
      setQuietHours(false);
      setScheduleSupported(false);
      setQuietStart("21:00");
      setQuietEnd("08:00");
      setTimezoneName(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
      setReminders(true);
      setError("");
      setSaving(false);
      setLoading(true);
      void loadInbox();
      void loadPreferences();
    };
    window.addEventListener("personIdChanged", resetForCareRecipientChange);
    return () => {
      window.removeEventListener("personIdChanged", resetForCareRecipientChange);
      scopeSequenceRef.current += 1;
      inboxRequestSequenceRef.current += 1;
      preferencesRequestSequenceRef.current += 1;
    };
  }, [loadInbox, loadPreferences]);

  useEffect(() => { void loadPreferences(); }, [loadPreferences]);

  const persist = async (key: "quiet_hours_enabled" | "reminders_enabled", value: boolean) => {
    const requestPersonId = getPersonId();
    const requestCaregiverId = getCaregiverId();
    const scopeSequence = scopeSequenceRef.current;
    const isCurrentScope = () => Boolean(requestPersonId && requestCaregiverId)
      && requestPersonId === getPersonId()
      && requestCaregiverId === getCaregiverId()
      && scopeSequence === scopeSequenceRef.current;
    if (!isCurrentScope()) return;
    setSaving(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      if (!isCurrentScope() || session.person?.id !== requestPersonId || session.caregiver?.id !== requestCaregiverId) return;
      const payload = key === "quiet_hours_enabled"
        ? { quiet_hours_enabled: value, quiet_hours_start: quietStart, quiet_hours_end: quietEnd, timezone_name: timezoneName }
        : { reminders_enabled: value };
      const result = await putJSON("/notifications/preferences", payload) as {
        quiet_hours_enabled: boolean; reminders_enabled: boolean;
        quiet_hours_start: string; quiet_hours_end: string; timezone_name: string;
      };
      if (!isCurrentScope()) return;
      setQuietHours(result.quiet_hours_enabled);
      setScheduleSupported(typeof result.quiet_hours_start === "string" && typeof result.quiet_hours_end === "string" && typeof result.timezone_name === "string");
      setQuietStart(result.quiet_hours_start);
      setQuietEnd(result.quiet_hours_end);
      setTimezoneName(result.timezone_name);
      setReminders(result.reminders_enabled);
      show("Notification settings saved.", "success");
    } catch {
      if (isCurrentScope()) {
        setError("We couldn't save your notification settings. Your previous settings are unchanged.");
        show("Notification settings weren't saved.", "error");
      }
    } finally {
      if (isCurrentScope()) setSaving(false);
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
          <label className="mobile-settings-label" style={{ display: "block", marginTop: "0.5rem" }}>Quiet-hours time zone
            <input className="mobile-settings-input" type="text" value={timezoneName} maxLength={64} disabled={loading || saving || !scheduleSupported} onChange={(event) => setTimezoneName(event.target.value)} placeholder="America/New_York" autoComplete="off" />
          </label>
          <span className="mobile-settings-hint">This time zone controls quiet hours only. Your Companion time zone is set separately under Caregiver preferences.</span>
          <Button variant="secondary" disabled={loading || saving || !scheduleSupported || quietStart === quietEnd || !timezoneName.trim()} onClick={() => void persist("quiet_hours_enabled", quietHours)}>Save quiet-hours settings</Button>
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
        {!inboxLoading && !inboxError && notifications.length === 0 && <p className="mobile-settings-hint">No notifications yet. When a care update or saved reminder is available, it will appear here.</p>}
        {notifications.map((item) => (
          <article key={item.id} className="mobile-settings-row" aria-label={caregiverSafeGeneratedText(item.title) || "Care notification"}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="mobile-settings-label">{caregiverSafeGeneratedText(item.title) || "Care update"}</span>
              <span className="mobile-settings-hint">{caregiverSafeGeneratedText(item.body) || "Open your Care Record to review this update."}</span>
              <span className="mobile-settings-hint">{item.created_at ? new Date(item.created_at).toLocaleString() : "Date unavailable"} · {caregiverStatusLabel(item.priority) || "Priority not available"} · {notificationCategoryLabel(item.category)}</span>
              {notificationReviewHref(item.category) && (
                <Link href={notificationReviewHref(item.category)!} className="mobile-settings-hint">
                  {item.category === "open_loop_due" ? "Review Needs attention" : item.category === "reminder_due" ? "Review reminders" : "View care information"}
                </Link>
              )}
              {(item.status ?? "active") === "active"
                ? <span className="mobile-settings-hint">Current update</span>
                : <span className="mobile-settings-hint">{item.status === "superseded" ? "Replaced by newer information" : item.status === "resolved" ? "No longer current" : "Update cancelled"}</span>}
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

