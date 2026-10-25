"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Check, Clock3, Plus, X } from "lucide-react";
import { ensureAnonymousSession, getJSON, patchJSON, postJSON } from "@/api/client";
import { Button } from "@/components/ui/Button";
import { BrandLoading } from "@/components/brand";

type ReminderStatus = "open" | "completed" | "cancelled";

type CareReminder = {
  id: string;
  person_id: string;
  title: string;
  note: string | null;
  due_at: string;
  status: ReminderStatus;
  completed_at: string | null;
  completed_by_caregiver_id: string | null;
  completion_note: string | null;
  cancelled_at: string | null;
  cancelled_by_caregiver_id: string | null;
  created_at: string;
  delivery_mode: "in_app_list_only";
  notification_delivery_status: "not_sent";
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
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueAt, setDueAt] = useState(() => localDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [filter, setFilter] = useState<"open" | "completed" | "cancelled" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (knownPersonId?: string) => {
    const session = await ensureAnonymousSession();
    const id = knownPersonId || session.person.id;
    setPersonId(id);
    const data = await getJSON(`/reminders/${encodeURIComponent(id)}`);
    if (!Array.isArray(data)) throw new Error("The reminders response was not a list.");
    setReminders(data as CareReminder[]);
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
      });
      await refresh(personId);
      setTitle("");
      setNote("");
      setNotice("Reminder saved to this care record. It will appear in this in-app list; no notification was sent.");
    } catch (reason) {
      setError("We couldn’t save this reminder. Your other care information is unchanged. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function completeReminder(reminder: CareReminder) {
    setBusyId(reminder.id);
    setError("");
    setNotice("");
    try {
      await patchJSON(`/reminders/${encodeURIComponent(reminder.id)}/complete`, {});
      await refresh(personId);
      setNotice("Reminder marked complete. No notification was sent.");
    } catch (reason) {
      setError("We couldn’t update this reminder. Please try again.");
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
          <ArrowLeft size={18} aria-hidden /> Back to Living Care Record
        </Link>
        <p className="care-reminders-eyebrow"><Clock3 size={15} aria-hidden /> CARE CONTINUITY</p>
        <h1>Care reminders</h1>
        <p>Keep a dated follow-up in the care record. These reminders are stored and shown in SolenOS when you open this list.</p>
        <p className="care-reminders-delivery">
          In-app list only · no push/email notification is sent, and delivery is not reported as confirmed.
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
          <span>Context (optional)</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="What should be checked or clarified?"
          />
        </label>
        <Button type="submit" variant="primary" disabled={saving || !title.trim() || !dueAt}>
          {saving ? "Saving…" : "Save reminder"}
        </Button>
      </form>

      {error ? <p className="care-reminder-alert" role="alert">{error}</p> : null}
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

        {loading ? (
          <BrandLoading message="Loading saved reminders…" />
        ) : visibleReminders.length === 0 ? (
          <div className="care-reminders-empty">
            <Clock3 size={24} aria-hidden />
            <h3>No {filter === "all" ? "" : filter + " "}reminders saved</h3>
            <p>Reminders you create will appear here. SolenOS does not invent sample reminders.</p>
          </div>
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
                  <h3>{reminder.title}</h3>
                  {reminder.note ? <p>{reminder.note}</p> : null}
                  {reminder.status === "completed" && reminder.completed_at ? (
                    <p className="care-reminder-footnote">
                      Completed {formatDateTime(reminder.completed_at)}
                      {reminder.completion_note ? ` · ${reminder.completion_note}` : ""}
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
                      <Button variant="secondary" disabled={busyId === reminder.id} onClick={() => void cancelReminder(reminder)}>
                        <X size={16} aria-hidden /> Cancel
                      </Button>
                    </div>
                  ) : null}
                  <p className="care-reminder-footnote">Saved in this care record · notification status: not sent</p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
