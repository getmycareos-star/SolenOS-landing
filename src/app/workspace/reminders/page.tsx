"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Clock3, Plus, X } from "lucide-react";
import { ensureAnonymousSession, getJSON, patchJSON, postJSON } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { RecordState } from "@/components/ui/RecordState";
import { caregiverSafeAssistantText } from "@/lib/caregiver-language";

type ReminderStatus = "open" | "completed" | "cancelled";

type CaregiverMember = { caregiver_id: string; name: string; role: string; can_complete_assigned_reminders: boolean };

type CareReminderAssignmentEvent = {
  actor_caregiver_id: string;
  previous_assignee_caregiver_id: string | null;
  assigned_to_caregiver_id: string;
  occurred_at: string;
};

type CareReminderLifecycleEvent = {
  action: string;
  actor_caregiver_id: string;
  occurred_at: string;
  details: { new_due_at?: string | null; previous_due_at?: string | null };
};

type CareReminder = {
  id: string;
  person_id: string;
  created_by_caregiver_id: string;
  assigned_to_caregiver_id: string | null;
  version: number;
  assignment_history: CareReminderAssignmentEvent[];
  lifecycle_history: CareReminderLifecycleEvent[];
  title: string;
  note: string | null;
  due_at: string;
  status: ReminderStatus;
  snoozed_at?: string | null;
  snoozed_by_caregiver_id?: string | null;
  snooze_count?: number;
  completed_at: string | null;
  completed_by_caregiver_id: string | null;
  completion_note: string | null;
  cancelled_at: string | null;
  cancelled_by_caregiver_id: string | null;
  created_at: string;
  delivery_mode: "in_app_notification_feed";
  notification_delivery_status: "not_created" | "in_app_notification_created";
};

function localDateTimeValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function reminderLabel(reminder: CareReminder): string {
  if (reminder.status !== "open") return reminder.status === "completed" ? "Completed" : "Cancelled";
  return new Date(reminder.due_at).getTime() < Date.now() ? "Overdue" : "Upcoming";
}

export default function CareRemindersPage() {
  const [personId, setPersonId] = useState("");
  const [reminders, setReminders] = useState<CareReminder[]>([]);
  const [assignableMembers, setAssignableMembers] = useState<CaregiverMember[]>([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [snoozeSupported, setSnoozeSupported] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState(() => localDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [filter, setFilter] = useState<"open" | "completed" | "cancelled" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const hasLoadedRef = useRef(false);

  const refresh = useCallback(async (knownPersonId?: string) => {
    const session = await ensureAnonymousSession();
    const id = knownPersonId || session.person.id;
    setPersonId(id);
    const [data, members] = await Promise.all([
      getJSON(`/reminders/${encodeURIComponent(id)}`),
      getJSON("/caregiver-access/assignable-members").catch(() => []),
    ]);
    if (!Array.isArray(data)) throw new Error("The reminders response was not a list.");
    const items = data as CareReminder[];
    setReminders(items);
    const memberRows = Array.isArray(members) ? members as CaregiverMember[] : [];
    setAssignableMembers(memberRows);
    const eligibleRows = memberRows.filter((member) => member.can_complete_assigned_reminders);
    setAssignedTo((current) => eligibleRows.some((member) => member.caregiver_id === current) ? current : (eligibleRows[0]?.caregiver_id || ""));
    hasLoadedRef.current = true;
    setSnoozeSupported(items.length > 0 && items.every((item) => typeof item.snooze_count === "number"));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void refresh()
      .catch((reason: unknown) => {
        if (!active) return;
        setError("We couldn’t load your reminders. Check your connection and try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  const reminderAssignableMembers = useMemo(
    () => assignableMembers.filter((member) => member.can_complete_assigned_reminders),
    [assignableMembers],
  );

  const visibleReminders = useMemo(() => {
    const items = filter === "all" ? reminders : reminders.filter((item) => item.status === filter);
    return [...items].sort((a, b) => new Date(a.due_at).getTime() - new Date(b.due_at).getTime());
  }, [filter, reminders]);

  async function createReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!personId || !title.trim() || !dueAt) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await postJSON("/reminders", {
        person_id: personId,
        title: title.trim(),
        note: note.trim() || null,
        due_at: new Date(dueAt).toISOString(),
        assigned_to_caregiver_id: assignedTo || undefined,
      });
      await refresh(personId);
      setTitle("");
      setNote("");
      setNotice("Reminder saved. It will appear in this list, and an in-app notification will be added when it is due. Browser push is optional when enabled; SolenOS does not send email.");
    } catch (reason) {
      setError("We couldn’t save this reminder. Your other care information is unchanged. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function reassignReminder(reminder: CareReminder, caregiverId: string) {
    if (!caregiverId || caregiverId === reminder.assigned_to_caregiver_id) return;
    setBusyId(reminder.id);
    setError("");
    setNotice("");
    try {
      await patchJSON(`/reminders/${encodeURIComponent(reminder.id)}/assignment`, {
        assigned_to_caregiver_id: caregiverId,
        expected_version: reminder.version,
      });
      await refresh(personId);
      setNotice("Reminder responsibility updated and saved.");
    } catch {
      setError("We couldn’t change who is responsible. Refresh the reminders and try again.");
      await refresh(personId).catch(() => undefined);
    } finally {
      setBusyId("");
    }
  }

  async function completeReminder(reminder: CareReminder) {
    setBusyId(reminder.id);
    setError("");
    setNotice("");
    try {
      await patchJSON(`/reminders/${encodeURIComponent(reminder.id)}/complete`, {});
      await refresh(personId);
      setNotice("Reminder marked complete.");
    } catch (reason) {
      setError("We couldn’t update this reminder. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  async function snoozeReminder(reminder: CareReminder) {
    setBusyId(reminder.id);
    setError("");
    setNotice("");
    try {
      const snoozeUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      await patchJSON(`/reminders/${encodeURIComponent(reminder.id)}/snooze`, {
        snooze_until: snoozeUntil,
      });
      await refresh(personId);
      setNotice("Reminder moved one hour later. It remains open and will not be marked complete.");
    } catch {
      setError("We couldn’t snooze this reminder. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  async function cancelReminder(reminder: CareReminder) {
    setBusyId(reminder.id);
    setError("");
    setNotice("");
    try {
      await patchJSON(`/reminders/${encodeURIComponent(reminder.id)}/cancel`, {});
      await refresh(personId);
      setNotice("Reminder cancelled. The record keeps its status and attribution.");
    } catch (reason) {
      setError("We couldn’t cancel this reminder. Please try again.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="mobile-screen care-reminders-page">
      <div className="care-reminders-header">
        <Link href="/workspace" className="care-reminders-back">
          <ArrowLeft size={18} aria-hidden /> Back to Care Record
        </Link>
        <p className="care-reminders-eyebrow"><Clock3 size={15} aria-hidden /> FOLLOW-UP</p>
        <h1>Care reminders</h1>
        <p>Save a reminder here so you can come back to it when it is due.</p>
        <p className="care-reminders-delivery">
          SolenOS can show a notification here when a reminder is due. Email alerts are not sent.
        </p>
      </div>

      <form className="care-reminder-form" onSubmit={createReminder}>
        <h2><Plus size={18} aria-hidden /> Add a reminder</h2>
        <label>
          <span>What needs following up?</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={180}
            required
            placeholder="e.g. Review the appointment questions"
          />
        </label>
        <label>
          <span>Due date and time</span>
          <input
            type="datetime-local"
            value={dueAt}
            min={localDateTimeValue(new Date())}
            onChange={(event) => setDueAt(event.target.value)}
            required
          />
        </label>
        <label>
          <span>Who is responsible?</span>
          <select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} disabled={reminderAssignableMembers.length === 0}>
            {reminderAssignableMembers.length === 0 ? <option value="">No caregiver is currently eligible</option> : null}
            {reminderAssignableMembers.map((member) => (
              <option key={member.caregiver_id} value={member.caregiver_id}>{caregiverSafeAssistantText(member.name) || "Caregiver"}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Context (optional)</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What should be checked or clarified?"
          />
        </label>
        {reminderAssignableMembers.length === 0 ? <p role="status">No active caregiver currently has permission to take responsibility for reminders. Update caregiver access before creating one.</p> : null}
        <Button type="submit" variant="primary" disabled={saving || !title.trim() || !dueAt || reminderAssignableMembers.length === 0}>
          {saving ? "Saving…" : "Save reminder"}
        </Button>
      </form>

      {error ? <RecordState kind="error" description={error} onAction={() => { setError(""); if (!hasLoadedRef.current) setLoading(true); void refresh(personId || undefined).catch(() => setError("We couldn’t load your reminders. Check your connection and try again.")).finally(() => setLoading(false)); }} /> : null}
      {notice ? <p className="care-reminder-notice" role="status">{notice}</p> : null}

      <section className="care-reminders-list" aria-labelledby="care-reminders-list-title">
        <div className="care-reminders-list-head">
          <div>
            <h2 id="care-reminders-list-title">Saved reminders</h2>
            <p>{reminders.length} saved {reminders.length === 1 ? "reminder" : "reminders"}</p>
          </div>
          <label className="care-reminders-filter">
            <span>Show</span>
            <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              <option value="open">Open</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        {loading && !hasLoadedRef.current ? (
          <RecordState kind="loading" title="Loading saved reminders" />
        ) : error && !hasLoadedRef.current ? null : visibleReminders.length === 0 ? (
          <RecordState
            kind={reminders.length === 0 ? "first-empty" : "no-results"}
            title={reminders.length === 0 ? "No reminders scheduled" : `No ${filter} reminders`}
            description={reminders.length === 0 ? "Reminders you add will appear here." : "Change the filter to see other saved reminders."}
            onAction={reminders.length > 0 ? () => setFilter("all") : undefined}
          />
        ) : (
          <ul className="care-reminders-items">
            {visibleReminders.map((reminder) => {
              const label = reminderLabel(reminder);
              return (
                <li key={reminder.id} className={`care-reminder-item care-reminder-${reminder.status}`}>
                  <div className="care-reminder-item-top">
                    <span className={`care-reminder-status care-reminder-status-${label.toLowerCase()}`}>{label}</span>
                    <time dateTime={reminder.due_at}>{formatDateTime(reminder.due_at)}</time>
                  </div>
                  <h3>{caregiverSafeAssistantText(reminder.title) || "Care reminder"}</h3>
                  {reminder.note ? <p>{caregiverSafeAssistantText(reminder.note) || "No further note was recorded."}</p> : null}
                  {reminder.status === "completed" && reminder.completed_at ? (
                    <p className="care-reminder-footnote">
                      Completed {formatDateTime(reminder.completed_at)}
                      {reminder.completion_note ? ` · ${caregiverSafeAssistantText(reminder.completion_note) || "No completion note was recorded"}` : ""}
                    </p>
                  ) : null}
                  {reminder.status === "cancelled" && reminder.cancelled_at ? (
                    <p className="care-reminder-footnote">Cancelled {formatDateTime(reminder.cancelled_at)}</p>
                  ) : null}
                  {reminder.status === "open" ? (
                    <div className="care-reminder-actions">
                      <Button variant="primary" disabled={busyId === reminder.id} onClick={() => void completeReminder(reminder)}>
                        <Check size={16} aria-hidden /> Mark complete
                      </Button>
                      {snoozeSupported && <Button variant="secondary" disabled={busyId === reminder.id} onClick={() => void snoozeReminder(reminder)}>
                        <Clock3 size={16} aria-hidden /> Snooze 1 hour
                      </Button>}
                      <Button variant="secondary" disabled={busyId === reminder.id} onClick={() => void cancelReminder(reminder)}>
                        <X size={16} aria-hidden /> Cancel
                      </Button>
                    </div>
                  ) : null}
                  <label className="care-reminder-footnote">
                    <span>Responsible caregiver</span>
                    <select
                      aria-label={`Responsible caregiver for ${caregiverSafeAssistantText(reminder.title) || "Care reminder"}`}
                      value={reminder.assigned_to_caregiver_id || reminder.created_by_caregiver_id}
                      disabled={reminder.status !== "open" || busyId === reminder.id || reminderAssignableMembers.length === 0}
                      onChange={(event) => void reassignReminder(reminder, event.target.value)}
                    >
                      {reminderAssignableMembers.map((member) => (
                        <option key={member.caregiver_id} value={member.caregiver_id}>{member.name}</option>
                      ))}
                    </select>
                  </label>
                  {(reminder.assignment_history?.length > 1 || reminder.lifecycle_history?.length > 0) && (
                    <details className="care-reminder-footnote">
                      <summary>Reminder history</summary>
                      <ol>
                        {reminder.assignment_history.map((entry, index) => (
                          <li key={`assignment-${entry.occurred_at}-${index}`}>
                            {assignableMembers.find((member) => member.caregiver_id === entry.assigned_to_caregiver_id)?.name || "Caregiver"} assigned by {assignableMembers.find((member) => member.caregiver_id === entry.actor_caregiver_id)?.name || "a caregiver"} · {formatDateTime(entry.occurred_at)}
                          </li>
                        ))}
                        {reminder.lifecycle_history.map((entry, index) => (
                          <li key={`lifecycle-${entry.occurred_at}-${index}`}>
                            {entry.action.endsWith(".completed") ? "Completed" : entry.action.endsWith(".cancelled") ? "Cancelled" : "Snoozed"} by {assignableMembers.find((member) => member.caregiver_id === entry.actor_caregiver_id)?.name || "a caregiver"} · {formatDateTime(entry.occurred_at)}
                            {entry.details.new_due_at ? ` · New due date: ${formatDateTime(entry.details.new_due_at)}` : ""}
                          </li>
                        ))}
                      </ol>
                    </details>
                  )}
                  <p className="care-reminder-footnote">Saved in this care record</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
