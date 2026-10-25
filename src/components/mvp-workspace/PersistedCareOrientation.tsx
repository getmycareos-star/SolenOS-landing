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
  return event.title?.trim() || event.description?.trim() || event.event_type?.trim() || "Care update details unavailable";
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
      if (!token) throw new Error("Your saved care information isn't available right now.");
      const response = await fetch("/api/situation?offer_return_invite=0", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Your saved care information isn't available right now.`);
      }
      const data = (await response.json()) as CareSnapshot;
      if (!data || data.ok !== true || !Array.isArray(data.events) || typeof data.total_events !== "number") {
        throw new Error("Your saved care information isn't available right now.");
      }
      setSnapshot(data);
      setState("ready");
    } catch (reason) {
      setSnapshot(null);
      setError(reason instanceof Error ? reason.message : "Your saved care information isn't available right now.");
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
          </button>
        </div>
        <p className="persisted-care-orientation-error" role="alert">{error || "Your saved care information isn't available right now."}</p>
        <p></p>
      </section>
    );
  }

  const events = snapshot.events ?? [];
  const observations = snapshot.active_care_situation?.observations ?? [];
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;
  const latestObservation = observations.length > 0 ? observations[observations.length - 1] : null;
  const hasServerEntries = snapshot.total_events > 0 || observations.length > 0;

  return (
    <section className="persisted-care-orientation" aria-label="Your care record">
      <div className="persisted-care-orientation-header">
        <div>
          <p className="persisted-care-orientation-eyebrow">Your care record</p>
          <h2>{snapshot.care_recipient_display_name?.trim() ? `Care record for ${snapshot.care_recipient_display_name.trim()}` : "Saved care record"}</h2>
        </div>
        <button type="button" aria-label="Refresh saved care context" onClick={() => setAttempt((value) => value + 1)}>
          <RefreshCw size={16} aria-hidden />
        </button>
      </div>

      {hasServerEntries ? (
        <>
          <p>{snapshot.total_events} saved care update{snapshot.total_events === 1 ? "" : "s"} in your record.</p>
          {latestEvent ? (
            <div className="persisted-care-orientation-latest">
              <strong>Latest care update</strong>
              <p>{eventTitle(latestEvent)}</p>
              <p>{formatDate(latestEvent.occurred_at)}</p>
            </div>
          ) : snapshot.total_events > 0 ? (
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

      <p></p>
      <div className="persisted-care-orientation-links">
        <Link href="/workspace/timeline">Review timeline</Link>
        <Link href="/workspace/documents">Review documents</Link>
      </div>
    </section>
  );
}
