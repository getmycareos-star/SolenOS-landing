"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";

type ProfileStatus = "known" | "unknown" | "not_applicable" | "uncertain" | "needs_clarification";
type ProfileField = {
  key: string;
  label: string;
  section: string;
};
type Assertion = {
  id: string;
  field: string;
  asserted_value: string;
  epistemic_state: string;
  assertion_status: string;
  source_text?: string | null;
  recorded_at: string;
  review_after_days?: number | null;
};

const FIELDS: ProfileField[] = [
  { section: "Background and care", key: "diagnosis_information", label: "Diagnosis, if a healthcare professional has shared one" },
  { section: "Background and care", key: "diagnosis_source_date", label: "Who provided the diagnosis information and when" },
  { section: "Background and care", key: "care_arrangements", label: "Current care arrangements" },
  { section: "Background and care", key: "care_team_contacts", label: "Important people and professional contacts" },
  { section: "Daily abilities and routines", key: "recorded_stage", label: "Dementia stage, if a healthcare professional has shared it" },
  { section: "Daily abilities and routines", key: "memory_orientation", label: "Memory and knowing where you are" },
  { section: "Daily abilities and routines", key: "communication_abilities", label: "Communication and understanding" },
  { section: "Daily abilities and routines", key: "recognition", label: "Recognition of familiar people and places" },
  { section: "Daily abilities and routines", key: "daily_living", label: "Everyday activities and independence" },
  { section: "Daily abilities and routines", key: "mobility_coordination", label: "Moving around and balance" },
  { section: "Daily abilities and routines", key: "usual_sleep", label: "Usual sleep pattern" },
  { section: "Safety and supervision", key: "wandering_getting_lost", label: "Wandering or getting lost" },
  { section: "Safety and supervision", key: "leaving_home", label: "Leaving home and outdoor safety" },
  { section: "Safety and supervision", key: "driving", label: "Driving status and concerns" },
  { section: "Safety and supervision", key: "medication_support", label: "Help needed with medicines" },
  { section: "Safety and supervision", key: "falls_mobility_safety", label: "Falls and mobility safety" },
  { section: "Safety and supervision", key: "home_safety", label: "Kitchen and household safety" },
  { section: "Safety and supervision", key: "financial_safety", label: "Financial safety concerns" },
  { section: "Safety and supervision", key: "supervision_needs", label: "When someone needs to stay nearby" },
  { section: "Behavior and emotional well-being", key: "distress_agitation", label: "Restlessness or distress" },
  { section: "Behavior and emotional well-being", key: "anxiety_fear", label: "Anxiety or fear" },
  { section: "Behavior and emotional well-being", key: "repeated_questions", label: "Repeated questions or repeated concerns" },
  { section: "Behavior and emotional well-being", key: "confusion_disorientation", label: "Confusion or disorientation" },
  { section: "Behavior and emotional well-being", key: "suspicion_unusual_beliefs", label: "Suspicion or unusual beliefs, as reported" },
  { section: "Behavior and emotional well-being", key: "withdrawal_engagement", label: "Spending less time with others or doing fewer activities" },
  { section: "Behavior and emotional well-being", key: "sundowning_observations", label: "Late-day or evening changes" },
  { section: "Behavior and emotional well-being", key: "mood_changes", label: "Mood and emotional changes" },
  { section: "Personal care and preferences", key: "food_eating", label: "Food, appetite and eating preferences" },
  { section: "Personal care and preferences", key: "personal_care", label: "Personal care and hygiene routines" },
  { section: "Personal care and preferences", key: "activities_interests", label: "Activities and interests" },
  { section: "Personal care and preferences", key: "familiar_routines", label: "Familiar routines" },
  { section: "Personal care and preferences", key: "communication_preferences", label: "Preferred ways to communicate" },
  { section: "Personal care and preferences", key: "comfort_supports", label: "What the person finds comforting or helpful" },
  { section: "Personal care and preferences", key: "environment_preferences", label: "Preferred surroundings" },
];

const STATUS_OPTIONS: Array<{ value: ProfileStatus; label: string }> = [
  { value: "known", label: "Known" },
  { value: "unknown", label: "Unknown" },
  { value: "not_applicable", label: "Not applicable" },
  { value: "uncertain", label: "Uncertain" },
  { value: "needs_clarification", label: "Needs clarification" },
];

const STATUS_TEXT: Record<ProfileStatus, string> = {
  known: "Known",
  unknown: "Unknown",
  not_applicable: "Not applicable",
  uncertain: "Uncertain",
  needs_clarification: "Needs clarification",
};

function statusFromAssertion(value: string, epistemicState: string): ProfileStatus {
  const normalized = value.trim().toLowerCase();
  if (normalized === "unknown") return "unknown";
  if (normalized === "not applicable") return "not_applicable";
  if (normalized === "needs clarification") return "needs_clarification";
  if (epistemicState === "uncertain") return "uncertain";
  return "known";
}

function valueFromAssertion(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (["unknown", "not applicable", "needs clarification"].includes(normalized)) return "";
  return value;
}

export default function DementiaCareProfilePanel({ personId }: { personId: string }) {
  const [assertions, setAssertions] = useState<Assertion[]>([]);
  const [statuses, setStatuses] = useState<Record<string, ProfileStatus | "">>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [reviewDays, setReviewDays] = useState<Record<string, number | "">>({});
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      if (!session.person?.id || session.person.id !== personId) {
        throw new Error("The selected care record does not match the secure session.");
      }
      const rows = await getJSON(
        `/care-continuity/assertions/${encodeURIComponent(personId)}?limit=100`,
      );
      if (!Array.isArray(rows)) throw new Error("The saved care profile could not be read.");
      const profileRows = (rows as Assertion[]).filter(
        (row) => typeof row.field === "string" && row.field.startsWith("dementia_profile."),
      );
      const latestByField = new Map<string, Assertion>();
      for (const row of profileRows) {
        if (["superseded", "retracted", "rejected"].includes(row.assertion_status)) continue;
        const key = row.field.slice("dementia_profile.".length);
        const previous = latestByField.get(key);
        if (!previous || Date.parse(row.recorded_at) > Date.parse(previous.recorded_at)) {
          latestByField.set(key, row);
        }
      }
      const nextStatuses: Record<string, ProfileStatus> = {};
      const nextValues: Record<string, string> = {};
      const nextReviewDays: Record<string, number | ""> = {};
      for (const [key, row] of latestByField) {
        nextStatuses[key] = statusFromAssertion(row.asserted_value, row.epistemic_state);
        nextValues[key] = valueFromAssertion(row.asserted_value);
        nextReviewDays[key] = typeof row.review_after_days === "number" ? row.review_after_days : "";
      }
      setAssertions(profileRows);
      setStatuses(nextStatuses);
      setValues(nextValues);
      setReviewDays(nextReviewDays);
    } catch {
      setError("We couldn’t load this care profile. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void load();
  }, [load]);

  const historyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of assertions) {
      const key = row.field.slice("dementia_profile.".length);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
  }, [assertions]);

  async function saveField(field: ProfileField) {
    const selectedStatus = statuses[field.key] ?? "";
    if (!selectedStatus) {
      setError(`Choose a status for “${field.label}” before saving.`);
      return;
    }
    const status: ProfileStatus = selectedStatus;
    const selectedReviewDays = reviewDays[field.key] ?? "";
    if (selectedReviewDays === "" || !Number.isInteger(selectedReviewDays) || selectedReviewDays < 1 || selectedReviewDays > 3650) {
      setError(`Choose when to review “${field.label}” again before saving.`);
      return;
    }
    const value = (values[field.key] ?? "").trim();
    if (status === "known" && !value) {
      setError(`Add the information for “${field.label}” or choose another status.`);
      return;
    }
    setError("");
    setNotice("");
    const assertedValue = status === "known" ? value : STATUS_TEXT[status];
    const epistemicState =
      status === "uncertain" || status === "unknown" || status === "needs_clarification"
        ? "uncertain"
        : "reported";
    const existing = assertions
      .filter((row) => row.field === "dementia_profile." + field.key && !["superseded", "retracted", "rejected"].includes(row.assertion_status))
      .sort((left, right) => Date.parse(right.recorded_at) - Date.parse(left.recorded_at))[0];
    if (existing?.asserted_value === assertedValue && existing.epistemic_state === epistemicState && existing.review_after_days === selectedReviewDays) {
      setNotice("No change to save for " + field.label + ".");
      return;
    }
    setSavingField(field.key);
    const sourceText = status === "known"
      ? value
      : "Caregiver marked this information as " + STATUS_TEXT[status].toLowerCase() + ".";
    try {
      const session = await ensureAnonymousSession();
      if (session.person?.id !== personId) {
        throw new Error("The selected care record does not match the secure session.");
      }
      await postJSON("/care-continuity/assertions", {
        subject_type: "person",
        subject_id: personId,
        field: `dementia_profile.${field.key}`,
        assertion_kind: "current_state",
        epistemic_state: epistemicState,
        asserted_value: assertedValue,
        source_label: "Caregiver-provided care profile",
        source_text: sourceText,
        review_after_days: selectedReviewDays,
      });
      window.dispatchEvent(new Event("careRecordUpdated"));
      setNotice(`Saved: ${field.label}.`);
      await load();
    } catch {
      setError("This information was not confirmed as saved. Please check the record before trying again.");
    } finally {
      setSavingField(null);
    }
  }

  const sections = Array.from(new Set(FIELDS.map((field) => field.section)));

  return (
    <section aria-label="About the person and their care" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-[var(--text)]">About the person and their care</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Add what is known. You can leave information unknown or come back to it later.
          Earlier reports remain in the care history.
        </p>
      </div>
      {loading ? <p role="status" className="text-sm text-[var(--muted)]">Loading saved information…</p> : null}
      {error ? <p role="alert" className="mb-3 text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="mb-3 text-sm text-[var(--text)]">{notice}</p> : null}
      {!loading ? sections.map((section) => (
        <details key={section} className="border-t border-[var(--border)] py-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--text)]">{section}</summary>
          <div className="mt-3 space-y-4">
            {FIELDS.filter((field) => field.section === section).map((field) => {
              const status = statuses[field.key] ?? "";
              const fieldRows = assertions.filter((row) => row.field === "dementia_profile." + field.key);
              const activeFieldRows = fieldRows.filter((row) => !["superseded", "retracted", "rejected"].includes(row.assertion_status));
              const historyCount = historyCounts.get(field.key) ?? 0;
              const hasDifferentReports = new Set(activeFieldRows.map((row) => row.asserted_value.trim().toLowerCase())).size > 1;
              return (
                <div key={field.key} className="grid gap-2">
                  <label htmlFor={`dementia-profile-${field.key}`} className="text-sm font-medium text-[var(--text)]">
                    {field.label}
                  </label>
                  <select
                    aria-label={`${field.label} status`}
                    value={status}
                    disabled={savingField !== null}
                    onChange={(event) => setStatuses((current) => ({ ...current, [field.key]: event.target.value as ProfileStatus }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                  >
                    <option value="">Not recorded</option>
                    {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                  <label htmlFor={`dementia-profile-review-${field.key}`} className="text-xs font-medium text-[var(--muted)]">Review this information again after</label>
                  <select
                    id={`dementia-profile-review-${field.key}`}
                    aria-label={`${field.label} review interval`}
                    value={reviewDays[field.key] ?? ""}
                    disabled={savingField !== null}
                    onChange={(event) => setReviewDays((current) => ({ ...current, [field.key]: event.target.value ? Number(event.target.value) : "" }))}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)]"
                  >
                    <option value="">Choose a review interval</option>
                    <option value="30">30 days</option>
                    <option value="90">90 days</option>
                    <option value="180">6 months</option>
                    <option value="365">1 year</option>
                  </select>
                  <textarea
                    id={`dementia-profile-${field.key}`}
                    value={values[field.key] ?? ""}
                    disabled={savingField !== null || status !== "known"}
                    onChange={(event) => setValues((current) => ({ ...current, [field.key]: event.target.value }))}
                    rows={2}
                    placeholder={status === "known" ? "Add the information in your own words" : "Choose a status first"}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] disabled:opacity-60"
                  />
                  <div className="flex items-center justify-between gap-3">
                    {hasDifferentReports
                      ? <span className="text-xs text-amber-700">Different reports are saved for this item. Check the care history before treating it as settled.</span>
                      : historyCount > 1
                        ? <span className="text-xs text-[var(--muted)]">Earlier reports are also kept in the care history.</span>
                        : <span />}
                    <button
                      type="button"
                      disabled={savingField !== null || !status || reviewDays[field.key] === undefined || reviewDays[field.key] === ""}
                      onClick={() => void saveField(field)}
                      className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--text)] disabled:opacity-50"
                    >
                      {savingField === field.key ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      )) : null}
    </section>
  );
}
