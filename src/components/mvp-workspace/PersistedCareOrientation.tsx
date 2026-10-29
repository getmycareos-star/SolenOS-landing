"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ensureAnonymousSession } from "@/api/client";

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
    open_loops?: { items?: Array<{ id: string; title: string; loop_type: string; recorded_status: string }>; count?: number; has_more?: boolean };
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

export function PersistedCareOrientation() {
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
      setSnapshot(data);
      // This assessment is loaded independently so an unavailable assessment never hides the saved care record.
      try {
        const assessmentResponse = await fetch("/api/v1/care-continuity/situation-understanding", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          cache: "no-store",
        });
        if (assessmentResponse.ok) {
          let assessmentData = (await assessmentResponse.json()) as SituationAssessment;
          if (assessmentData.status === "not_assessed") {
            const reassessResponse = await fetch("/api/v1/care-continuity/situation-understanding/reassess", {
              method: "POST",
              headers: { Authorization: `Bearer ${session.access_token}` },
              cache: "no-store",
            });
            if (reassessResponse.ok) assessmentData = (await reassessResponse.json()) as SituationAssessment;
          }
          setSituationAssessment(assessmentData);
        } else {
          setSituationAssessment(null);
        }
      } catch {
        setSituationAssessment(null);
      }
      setState("ready");
    } catch {
      setSnapshot(null);
      setSituationAssessment(null);
      setError("Your care information isn't available right now. Check your connection and try again.");
      setState("unavailable");
    }
  }, []);

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
    <section className="persisted-care-orientation" aria-label="Your care record">
      <div className="persisted-care-orientation-header">
        <div>
          <p className="persisted-care-orientation-eyebrow">Your care record</p>
          <h2>{snapshot.care_recipient_display_name?.trim() ? `Care record for ${snapshot.care_recipient_display_name.trim()}` : "Saved care record"}</h2>
        </div>
        <button type="button" aria-label="Refresh saved care context" onClick={() => setAttempt((value) => value + 1)}>
          <RefreshCw size={16} aria-hidden />
          <span>Refresh</span>
        </button>
      </div>

      {hasServerEntries ? (
        <>
          <p>{snapshot.total_events ?? (events.length || situations.length)} saved care update{(snapshot.total_events ?? (events.length || situations.length)) === 1 ? "" : "s"} in your record.</p>
          {understanding.trim() && <div className="persisted-care-orientation-latest"><strong>Current understanding</strong><p>{understanding}</p></div>}
          {situations.map((situation, index) => (
            <div className="persisted-care-orientation-latest" key={situation.id || `situation-${index}`}>
              <strong>{situation.title?.trim() || "Care update"}</strong>
              {situation.context_summary && <p>{situation.context_summary}</p>}
              {situation.status && <p>{situation.status.replace(/_/g, " ")}</p>}
              {situation.updated_at && <p>{formatDate(situation.updated_at)}</p>}
            </div>
          ))}
          {latestEvent ? (
            <div className="persisted-care-orientation-latest">
              <strong>Latest care update</strong>
              <p>{eventTitle(latestEvent)}</p>
              <p>{formatDate(latestEvent.occurred_at)}</p>
            </div>
          ) : (snapshot.total_events ?? 0) > 0 ? (
            <p role="status">Some saved updates are unavailable to display right now. Try refreshing your record.</p>
          ) : null}
          {latestObservation ? (
            <div className="persisted-care-orientation-latest">
              <strong>Latest supporting information</strong>
              <p>{latestObservation.human_fact?.trim() || latestObservation.raw_text?.trim() || "Supporting information is saved, but its details are not available to display right now."}</p>
              <p>{formatDate(latestObservation.captured_at)}</p>
            </div>
          ) : null}
        </>
      ) : (
        <p>Your care record is ready to build. Add a note, daily update, or document to keep important care information in one place.</p>
      )}

      {situationAssessment?.assessment ? (
        <div className="persisted-care-orientation-latest" aria-label="Evidence-grounded situation understanding">
          <strong>Situation understanding</strong>
          <p>
            {situationAssessment.assessment.coverage?.records_examined ?? 0} persisted record(s) examined.
            {" "}Confidence: {situationAssessment.assessment.confidence_assessment?.overall || "not assessed"}.
          </p>
          <p>What remains unresolved: {situationAssessment.assessment.open_loops?.count ?? 0} open loop(s).</p>
          {(situationAssessment.assessment.situation_trajectory?.entries ?? []).slice(-5).reverse().map((entry) => (
            <div key={entry.source + ":" + entry.record_id} className="persisted-care-orientation-latest">
              <strong>{entry.title || "Recorded care event"}</strong>
              <p>{entry.epistemic_status.replace(/_/g, " ")}</p>
              <p>{formatDate(entry.event_time || entry.recorded_at)}</p>
              <small>{entry.temporal_basis.replace(/_/g, " ")}. Sequence does not establish causation.</small>
            </div>
          ))}
          {situationAssessment.assessment.situation_trajectory?.has_more && <p>Showing the five most recent entries in the bounded situation trajectory.</p>}
          {situationAssessment.assessment.confidence_assessment?.limitations?.length ? (
            <p>Assessment limitations: {situationAssessment.assessment.confidence_assessment.limitations.join(" ")}</p>
          ) : null}
        </div>
      ) : null}

      <div className="persisted-care-orientation-links">
        <Link href="/workspace/timeline">Review timeline</Link>
        <Link href="/workspace/documents">Review documents</Link>
      </div>
    </section>
  );
}
