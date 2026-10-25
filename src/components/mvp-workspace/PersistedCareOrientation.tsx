"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { getAnonymousAccessToken } from "@/api/client";

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
  ok: true;
  care_recipient_display_name?: string;
  total_events: number;
  events: PersistedEvent[];
  has_context_root?: boolean;
  active_care_situation?: { observations?: PersistedObservation[] } | null;
};
type LoadState = "loading" | "ready" | "unavailable";

function formatDate(value?: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date not recorded";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function eventTitle(event: PersistedEvent): string {
  return event.title?.trim() || event.description?.trim() || event.event_type?.trim() || "Event details not returned";
}

export function PersistedCareOrientation() {
  const [state, setState] = useState<LoadState>("loading");
  const [snapshot, setSnapshot] = useState<CareSnapshot | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const token = getAnonymousAccessToken();
      if (!token) throw new Error("The active care-session credential is unavailable. The saved record was not verified.");
      const response = await fetch("/api/situation?offer_return_invite=0", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`The saved care record could not be verified (HTTP ${response.status}).`);
      }
      const data = (await response.json()) as CareSnapshot;
      if (!data || data.ok !== true || !Array.isArray(data.events) || typeof data.total_events !== "number") {
        throw new Error("The backend did not return a verifiable care-record snapshot.");
      }
      setSnapshot(data);
      setState("ready");
    } catch (reason) {
      setSnapshot(null);
      setError(reason instanceof Error ? reason.message : "The saved care record could not be verified.");
      setState("unavailable");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, attempt]);

  if (state === "loading") {
    return (
      <section className="persisted-care-orientation" aria-busy="true" aria-label="Saved care context">
        <p className="persisted-care-orientation-eyebrow">Saved care context</p>
        <h2>Checking the saved care record…</h2>
      </section>
    );
  }

  if (state === "unavailable" || !snapshot) {
    return (
      <section className="persisted-care-orientation" aria-label="Saved care context">
        <div className="persisted-care-orientation-header">
          <div>
            <p className="persisted-care-orientation-eyebrow">Saved care context</p>
            <h2>Current record state could not be confirmed</h2>
          </div>
          <button type="button" aria-label="Retry saved care record check" onClick={() => setAttempt((value) => value + 1)}>
            <RefreshCw size={16} aria-hidden />
          </button>
        </div>
        <p className="persisted-care-orientation-error" role="alert">{error || "The backend did not confirm the saved record."}</p>
        <p>Local display state is not treated as proof that the backend record is available.</p>
      </section>
    );
  }

  const events = snapshot.events ?? [];
  const observations = snapshot.active_care_situation?.observations ?? [];
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const latestObservation = observations.length > 0 ? observations[observations.length - 1] : null;
  const hasServerEntries = snapshot.total_events > 0 || observations.length > 0;

  return (
    <section className="persisted-care-orientation" aria-label="Saved care context">
      <div className="persisted-care-orientation-header">
        <div>
          <p className="persisted-care-orientation-eyebrow">Verified from the care backend</p>
          <h2>{snapshot.care_recipient_display_name?.trim() ? `Care record for ${snapshot.care_recipient_display_name.trim()}` : "Saved care record"}</h2>
        </div>
        <button type="button" aria-label="Refresh saved care context" onClick={() => setAttempt((value) => value + 1)}>
          <RefreshCw size={16} aria-hidden />
        </button>
      </div>

      {hasServerEntries ? (
        <>
          <p>{snapshot.total_events} saved care event{snapshot.total_events === 1 ? "" : "s"} returned by the backend. Evidence entries are shown only where the response includes them.</p>
          {latestEvent ? (
            <div className="persisted-care-orientation-latest">
              <strong>Latest returned event</strong>
              <p>{eventTitle(latestEvent)}</p>
              <p>{formatDate(latestEvent.occurred_at)}</p>
            </div>
          ) : snapshot.total_events > 0 ? (
            <p role="status">The backend reports saved events, but did not return event details in this response.</p>
          ) : null}
          {latestObservation ? (
            <div className="persisted-care-orientation-latest">
              <strong>Latest returned evidence</strong>
              <p>{latestObservation.human_fact?.trim() || latestObservation.raw_text?.trim() || "Evidence exists, but its text was not returned in this response."}</p>
              <p>{formatDate(latestObservation.captured_at)}</p>
            </div>
          ) : null}
        </>
      ) : (
        <p>The backend confirms that no saved care events or evidence are available in this record response yet.</p>
      )}

      <p>Change comparisons, unresolved questions, and action-completion status are not supplied by this record-hydration response; they are not inferred from local display data.</p>
      <div className="persisted-care-orientation-links">
        <Link href="/workspace/timeline">Review timeline</Link>
        <Link href="/workspace/documents">Review documents</Link>
      </div>
    </section>
  );
}
