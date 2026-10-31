"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ensureAnonymousSession, postJSON } from "@/api/client";

type PersistedEvent = {
  id: string;
  event_type?: string;
  title?: string;
  description?: string | null;
  occurred_at?: string | null;
  evidence_ids?: string[];
};
type PersistedObservation = {
  id: string;
  raw_text?: string;
  human_fact?: string;
  captured_at?: string;
};
type CareSnapshot = {
  ok?: boolean;
  care_recipient_display_name?: string;
  total_events?: number;
  events?: PersistedEvent[];
  has_context_root?: boolean;
  what_i_understood?: string | { summary?: string; text?: string } | null;
  ui_situations?: Array<{ id?: string; title?: string; context_summary?: string; status?: string; updated_at?: string }>;
  active_care_situation?: {
    observations?: PersistedObservation[];
    summary?: string;
    current_situation?: string;
  } | null;
};
type SituationTrajectoryEntry = {
  source: string;
  record_id: string;
  title: string;
  epistemic_status: string;
  event_time?: string | null;
  recorded_at?: string | null;
  temporal_basis: string;
  interpretation_limit: string;
};
type SituationAssessment = {
  status?: string;
  assessment_id?: string;
  assessment?: {
    situation_trajectory?: { entries?: SituationTrajectoryEntry[]; count?: number; has_more?: boolean; causal_inference?: string };
    observation_coverage?: { items?: Array<{ id: string; subject_type: string; window_start: string; window_end: string; coverage_status: string; rationale: string }>; count?: number; has_more?: boolean; status?: string; absence_rule?: string };
    baseline_assessment?: { status?: string; count?: number; limitation?: string };
    open_loops?: { items?: Array<{ id: string; title: string; loop_type: string; recorded_status: string; description?: string; owner?: string | null; due_at?: string | null }>; count?: number; has_more?: boolean };
    confidence_assessment?: { overall?: string; limitations?: string[] };
    coverage?: { is_complete?: boolean; records_examined?: number };
  } | null;
};
type LoadState = "loading" | "ready" | "unavailable";

function formatDate(value?: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function eventTitle(event: PersistedEvent): string {
  return event.title?.trim() || event.description?.trim() || event.event_type?.trim() || "Care update details unavailable";
}

type EntryState = "loading" | "new" | "returning" | "unavailable";

export function PersistedCareOrientation({
  onEntryStateChange,
}: {
  onEntryStateChange?: (state: EntryState) => void;
}) {
  const [state, setState] = useState<LoadState>("loading");
  const [snapshot, setSnapshot] = useState<CareSnapshot | null>(null);
  const [situationAssessment, setSituationAssessment] = useState<SituationAssessment | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const session = await ensureAnonymousSession();
      const storedCareSessionId = window.localStorage.getItem("solenos_care_session_id");
      const params = new URLSearchParams({ caregiver_id: session.caregiver.id, offer_return_invite: "0" });
      if (storedCareSessionId) params.set("care_session_id", storedCareSessionId);
      const response = await fetch(`/api/situation?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Your saved care information isn't available right now.`);
      }
      const data = (await response.json()) as CareSnapshot;
      // A successful response with no entries is a normal first-visit state,
      // not a failed load. Render the empty-record guidance instead of an error.
      if (!data || typeof data !== "object" || data.ok === false) {
        throw new Error("Your saved care information isn't available right now.");
      }
      const events = data.events ?? [];
      const situations = data.ui_situations ?? [];
      const observations = data.active_care_situation?.observations ?? [];
      const understanding = typeof data.what_i_understood === "string"
        ? data.what_i_understood
        : data.what_i_understood?.summary || data.what_i_understood?.text || "";
      const hasPersistedEntries = (data.total_events ?? 0) > 0 || events.length > 0 || situations.length > 0 || observations.length > 0 || Boolean(understanding.trim()) || Boolean(data.active_care_situation?.summary || data.active_care_situation?.current_situation);
      setSnapshot(data);
      onEntryStateChange?.(hasPersistedEntries ? "returning" : "new");
      // Use the shared API client for base URL, authorization, timeout and retry behaviour.
      // Reassess on entry; the backend deduplicates semantically unchanged snapshots.
      try {
        const assessmentData = await postJSON("care-continuity/situation-understanding/reassess", {});
        setSituationAssessment(assessmentData as SituationAssessment);
      } catch {
        setSituationAssessment(null);
      }
      setState("ready");
    } catch {
      setSnapshot(null);
      setSituationAssessment(null);
      setError("Your care information isn't available right now. Check your connection and try again.");
      onEntryStateChange?.("unavailable");
      setState("unavailable");
    }
  }, [onEntryStateChange]);

  useEffect(() => {
    void load();
  }, [load, attempt]);

  if (state === "loading") {
    return (
      <section className="persisted-care-orientation" aria-busy="true" aria-label="Your care record">
        <p className="persisted-care-orientation-eyebrow">Your care record</p>
        <h2>Loading your care information…</h2>
      </section>
    );
  }

  if (state === "unavailable" || !snapshot) {
    return (
      <section className="persisted-care-orientation" aria-label="Your care record">
        <div className="persisted-care-orientation-header">
          <div>
            <p className="persisted-care-orientation-eyebrow">Your care record</p>
            <h2>We couldn't load your care information</h2>
          </div>
          <button type="button" aria-label="Retry saved care record check" onClick={() => setAttempt((value) => value + 1)}>
            <RefreshCw size={16} aria-hidden />
            <span>Try again</span>
          </button>
        </div>
        <p className="persisted-care-orientation-error" role="alert">{error || "Your saved care information isn't available right now."}</p>
      </section>
    );
  }

  const events = snapshot.events ?? [];
  const situations = snapshot.ui_situations ?? [];
  const observations = snapshot.active_care_situation?.observations ?? [];
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const latestObservation = observations.length > 0 ? observations[observations.length - 1] : null;
  const understanding = typeof snapshot.what_i_understood === "string"
    ? snapshot.what_i_understood
    : snapshot.what_i_understood?.summary || snapshot.what_i_understood?.text || "";
  const hasServerEntries = (snapshot.total_events ?? 0) > 0 || events.length > 0 || situations.length > 0 || observations.length > 0 || Boolean(understanding.trim()) || Boolean(snapshot.active_care_situation?.summary || snapshot.active_care_situation?.current_situation);

  return (
    <section
      className={`persisted-care-orientation ${hasServerEntries ? "is-returning-caregiver" : "is-new-caregiver"}`}
      aria-label={hasServerEntries ? "Your saved care record" : "Start your care record"}
    >
      {hasServerEntries ? (
        <>
          <div className="care-entry-heading">
            <div>
              <p className="persisted-care-orientation-eyebrow">YOUR LIVING CARE RECORD</p>
              <h2>{snapshot.care_recipient_display_name?.trim()
                ? `Care for ${snapshot.care_recipient_display_name.trim()}`
                : "Pick up where you left off"}</h2>
              <p className="care-entry-intro">Your saved information is here. You do not need to start again.</p>
            </div>
            <button type="button" className="care-entry-refresh" aria-label="Refresh saved care context" onClick={() => setAttempt((value) => value + 1)}>
              <RefreshCw size={16} aria-hidden />
              <span>Refresh</span>
            </button>
          </div>
          <div className="care-entry-summary">
            <div>
              <span className="care-entry-label">SAVED UPDATES</span>
              <strong>{snapshot.total_events ?? (events.length || situations.length)}</strong>
            </div>
            <div>
              <span className="care-entry-label">CARE THREADS</span>
              <strong>{situations.length}</strong>
            </div>
            {situationAssessment?.assessment?.open_loops?.count !== undefined && (
              <div>
                <span className="care-entry-label">OPEN ITEMS</span>
                <strong>{situationAssessment.assessment.open_loops.count}</strong>
              </div>
            )}
          </div>
          {understanding.trim() && (
            <div className="care-entry-current">
              <span className="care-entry-label">CURRENT UNDERSTANDING</span>
              <p>{understanding}</p>
            </div>
          )}
          {latestEvent ? (
            <div className="care-entry-latest">
              <span className="care-entry-label">LATEST SAVED UPDATE</span>
              <p>{eventTitle(latestEvent)}</p>
              <small>{formatDate(latestEvent.occurred_at)}</small>
            </div>
          ) : latestObservation ? (
            <div className="care-entry-latest">
              <span className="care-entry-label">LATEST SUPPORTING INFORMATION</span>
              <p>{latestObservation.human_fact?.trim() || latestObservation.raw_text?.trim() || "Supporting information is saved, but its details are unavailable."}</p>
              <small>{formatDate(latestObservation.captured_at)}</small>
            </div>
          ) : situations.length > 0 ? (
            <div className="care-entry-latest">
              <span className="care-entry-label">RECENT CARE THREAD</span>
              <p>{situations[0].title?.trim() || "Saved care information"}</p>
              {situations[0].updated_at && <small>{formatDate(situations[0].updated_at)}</small>}
            </div>
          ) : (
            <p className="care-entry-note">Your saved record is available. Some details could not be displayed in this view.</p>
          )}
          <div className="care-entry-actions">
            <Link href="/workspace?prompt=I%20want%20to%20add%20a%20care%20update.%20Help%20me%20capture%20what%20has%20changed%20and%20what%20is%20still%20uncertain." className="care-entry-primary">Add a care update <span aria-hidden="true">→</span></Link>
            <Link href="/workspace/daily-care" className="care-entry-secondary">Open daily care</Link>
          </div>
        </>
      ) : (
        <>
          <p className="persisted-care-orientation-eyebrow">A PLACE TO KEEP THE STORY TOGETHER</p>
          <h2>You can start with what you remember.</h2>
          <p className="care-entry-intro">You do not need a complete history or the right words. Add one detail, a message, or something that happened today. SolenOS will keep the information connected as your care story develops.</p>
          <div className="care-entry-actions">
            <Link href="/workspace?prompt=I%20want%20to%20share%20one%20detail%20about%20care.%20Help%20me%20capture%20it%20accurately." className="care-entry-primary">Start with one detail <span aria-hidden="true">→</span></Link>
            <Link href="/workspace/daily-care" className="care-entry-secondary">Record how today is going</Link>
          </div>
          <p className="care-entry-note">Nothing has been added to this care record yet.</p>
        </>
      )}
      {situationAssessment?.assessment && hasServerEntries && (
        <div className="care-entry-open-items">
          <span className="care-entry-label">STILL TO FOLLOW UP</span>
          {(situationAssessment.assessment.open_loops?.items ?? []).slice(0, 3).map((loop) => (
            <div key={loop.id}>
              <strong>{loop.title || loop.loop_type.replace(/_/g, " ")}</strong>
              <span>{loop.recorded_status.replace(/_/g, " ")}</span>
            </div>
          ))}
          {(situationAssessment.assessment.open_loops?.count ?? 0) === 0 && (
            <p>No open follow-up items were returned in this assessment. This does not establish that every aspect of care is resolved.</p>
          )}
          {situationAssessment.assessment.open_loops?.has_more && <p>More follow-up items are available in the full record.</p>}
        </div>
      )}
      <div className="persisted-care-orientation-links">
        <Link href="/workspace/timeline">Review timeline</Link>
        <Link href="/workspace/documents">Review documents</Link>
      </div>
    </section>
  );

}
