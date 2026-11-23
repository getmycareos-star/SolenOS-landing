"use client";

import { useCallback, useEffect, useState } from "react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";
import { caregiverSafeAssistantText } from "@/lib/caregiver-language";

type ObservationType = "direct" | "second_hand";
type DementiaObservation = {
  id: string;
  observation_category: string;
  description: string;
  observed_at?: string | null;
  recorded_at?: string | null;
  observation_type?: string | null;
  recorded_by_caregiver_id?: string | null;
};

const CATEGORIES = [
  ["memory", "Memory and repeated questions"],
  ["behaviour", "Behavior or distress"],
  ["wandering", "Wandering or getting lost"],
  ["sleep", "Sleep"],
  ["mood", "Mood and emotional wellbeing"],
  ["eating", "Eating and drinking"],
  ["medication", "Medication routine or support"],
  ["mobility", "Moving around and falls"],
  ["communication", "Communication"],
  ["daily_activities", "Everyday activities"],
  ["safety", "Safety"],
  ["other", "Something else"],
] as const;

function formatTime(value?: string | null): string {
  if (!value) return "Time not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Time not recorded" : date.toLocaleString();
}

export default function DementiaObservationPanel({ personId }: { personId: string }) {
  const [observations, setObservations] = useState<DementiaObservation[]>([]);
  const [caregiverId, setCaregiverId] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [observationType, setObservationType] = useState<ObservationType | "">("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      if (session.person?.id !== personId) {
        throw new Error("The selected care record does not match the secure session.");
      }
      setCaregiverId(session.caregiver.id);
      const rows = await getJSON("/care-continuity/caregiver-observations?limit=100");
      if (!Array.isArray(rows)) throw new Error("The observation history could not be read.");
      setObservations((rows as DementiaObservation[]).filter(
        (row) => typeof row.observation_category === "string" && row.observation_category.startsWith("dementia."),
      ));
    } catch {
      setError("We couldn’t load your saved notes. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveObservation() {
    const text = description.trim();
    if (!category || !text || !observationType) {
      setError("Choose a topic, describe what happened, and say whether you saw it yourself.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const session = await ensureAnonymousSession();
      if (session.person?.id !== personId || session.caregiver?.id !== caregiverId) {
        throw new Error("The selected care record does not match the secure session.");
      }
      await postJSON("/care-continuity/caregiver-observations", {
        observation_category: "dementia." + category,
        description: text,
        observation_type: observationType,
        epistemic_status: observationType === "direct" ? "observed" : "reported",
        ...(observedAt ? { observed_at: new Date(observedAt).toISOString() } : {}),
      });
      setDescription("");
      setObservedAt("");
      setCategory("");
      setObservationType("");
      setNotice("Your note was saved to your Care Record.");
      window.dispatchEvent(new Event("careRecordUpdated"));
      await load();
    } catch {
      setError("We couldn’t confirm that your note was saved. Refresh your saved notes before trying again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="Notes about memory and daily life" className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-[var(--text)]">Notes about memory and daily life</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Record what happened in your own words. We keep the date it happened separate from the date you saved it.
        </p>
      </div>
      {error ? <p role="alert" className="mb-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="mb-3 text-sm text-[var(--text)]">{notice}</p> : null}
      <div className="grid gap-3">
        <label className="grid gap-1 text-sm font-medium text-[var(--text)]">
          What was this about?
          <select
            value={category}
            disabled={saving}
            onChange={(event) => setCategory(event.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="">Choose a topic</option>
            {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-[var(--text)]">
          What happened?
          <textarea
            value={description}
            disabled={saving}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={8000}
            placeholder="Describe what you noticed, without guessing why it happened."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-[var(--text)]">
          Who saw or heard this?
          <select
            value={observationType}
            disabled={saving}
            onChange={(event) => setObservationType(event.target.value as ObservationType | "")}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="">Choose one</option>
            <option value="direct">I saw it myself</option>
            <option value="second_hand">Someone told me</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-[var(--text)]">
          When did it happen? (optional)
          <input
            type="datetime-local"
            value={observedAt}
            disabled={saving}
            onChange={(event) => setObservedAt(event.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
        </label>
        <div>
          <button
            type="button"
            disabled={saving || loading || !category || !description.trim() || !observationType}
            onClick={() => void saveObservation()}
            className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save note"}
          </button>
        </div>
      </div>
      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="text-sm font-semibold text-[var(--text)]">Recent notes</h4>
          <button type="button" onClick={() => void load()} disabled={loading || saving} className="text-sm underline disabled:opacity-50">
            Refresh
          </button>
        </div>
        {loading ? <p role="status" className="text-sm text-[var(--muted)]">Loading saved notes…</p> : null}
        {!loading && observations.length === 0 ? <p className="text-sm text-[var(--muted)]">No notes about memory or daily life have been saved yet.</p> : null}
        <ul className="space-y-3">
          {observations.map((item) => (
            <li key={item.id} className="rounded-lg border border-[var(--border)] p-3">
              <p className="text-xs font-medium text-[var(--muted)]">
                {CATEGORIES.find(([value]) => "dementia." + value === item.observation_category)?.[1] ?? "Memory or daily-life note"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--text)]">{caregiverSafeAssistantText(item.description) || "The saved note could not be displayed in a readable form."}</p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Happened: {formatTime(item.observed_at)} · Recorded: {formatTime(item.recorded_at)}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {item.observation_type === "DIRECT" || item.observation_type === "direct" ? "Seen directly" : "Reported by someone else"}
                {item.recorded_by_caregiver_id === caregiverId ? " · Recorded by you" : " · Recorded by another caregiver"}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
