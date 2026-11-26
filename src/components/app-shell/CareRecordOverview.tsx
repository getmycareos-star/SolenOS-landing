"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { ensureAnonymousSession, getJSON, getPersonId } from "@/api/client";
import { caregiverInformationLabel, caregiverSourceText, caregiverSafeChangeText, caregiverSafeGeneratedText, caregiverSituationStateLabel, caregiverStatusLabel } from "@/lib/caregiver-language";
import { RecordState } from "@/components/ui/RecordState";

type CareItem = {
  id: string;
  title?: string;
  description?: string;
  kind?: string;
  status?: string;
  epistemic_status?: string;
  source_label?: string;
  recorded_at?: string | null;
  occurred_at?: string | null;
  time_provenance?: string | null;
};

type ChangeItem = {
  id: string;
  change_type?: string;
  change_direction?: string;
  previous_state?: string | null;
  current_state?: string | null;
  created_at?: string | null;
};

function when(value?: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date not recorded" : date.toLocaleString();
}

function happenedWhen(item: CareItem): string {
  if (item.time_provenance === "server_recorded_at" || item.time_provenance === "entry_time_defaulted") return "Not provided";
  return when(item.occurred_at);
}

function plainStatus(value?: string | null): string {
  if (!value) return "Not recorded";
  if (value === "active") return "Current";
  return caregiverStatusLabel(value)
    || caregiverInformationLabel(value)
    || caregiverSituationStateLabel(value)
    || "Not available";
}

export function CareRecordOverview() {
  const router = useRouter();
  const [items, setItems] = useState<CareItem[]>([]);
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"error" | "forbidden" | "unavailable">("error");
  const [historyNote, setHistoryNote] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const hasLoadedRef = useRef(false);
  const loadedPersonIdRef = useRef<string | null>(null);

  const load = useCallback(async (manual = false) => {
    const storedPersonId = getPersonId();
    if (loadedPersonIdRef.current && loadedPersonIdRef.current !== storedPersonId) {
      setItems([]);
      setChanges([]);
      hasLoadedRef.current = false;
      setHasLoaded(false);
      loadedPersonIdRef.current = null;
    }
    if (manual) setRefreshing(true);
    else if (!hasLoadedRef.current) setLoading(true);
    setError(null);
    setErrorKind("error");
    setHistoryNote(null);
    try {
      const session = await ensureAnonymousSession();
      const personId = session.person?.id;
      if (!personId) {
        setItems([]);
        setChanges([]);
        hasLoadedRef.current = false;
        setHasLoaded(false);
        loadedPersonIdRef.current = null;
        throw new Error("The care record could not be opened.");
      }
      if (loadedPersonIdRef.current && loadedPersonIdRef.current !== personId) {
        setItems([]);
        setChanges([]);
        hasLoadedRef.current = false;
        setHasLoaded(false);
        setLoading(true);
      }
      loadedPersonIdRef.current = personId;
      const response = await getJSON("/care-continuity/current-care?limit_per_source=12") as {
        person_id?: string;
        items?: CareItem[];
        read_only?: boolean;
      };
      if (response.person_id !== personId || !Array.isArray(response.items)) {
        throw new Error("The saved care information could not be verified for this session.");
      }
      setItems(response.items);
      hasLoadedRef.current = true;
      setHasLoaded(true);
      setHistoryLoading(true);
      try {
        const history = await getJSON("/change/changes/" + encodeURIComponent(personId));
        if (!Array.isArray(history)) throw new Error("History was unavailable.");
        setChanges(history as ChangeItem[]);
      } catch {
        setHistoryNote("The saved change history could not be loaded. Other saved information is still shown.");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const responseStatus =
        cause && typeof cause === "object" && "status" in cause &&
        typeof (cause as { status?: unknown }).status === "number"
          ? (cause as { status: number }).status
          : null;
      const accessDenied = responseStatus === 401 || responseStatus === 403 ||
        /401|403|unauthori[sz]ed|forbidden|access denied|not authenticated|not authorized|session.*required|authentication/i.test(message);
      const unavailable = (responseStatus !== null && responseStatus >= 500) ||
        /502|503|504|network|fetch failed|failed to fetch|timeout|timed out|ECONN/i.test(message);
      setErrorKind(accessDenied ? "forbidden" : unavailable ? "unavailable" : "error");
      if (accessDenied) {
        setItems([]);
        setChanges([]);
        hasLoadedRef.current = false;
        setHasLoaded(false);
        loadedPersonIdRef.current = null;
      }
      setError(accessDenied
        ? "You may not have access to this care information. Check your account and try again."
        : "We couldn’t load your saved care information. Please try again.");
    } finally {
      setHistoryLoading(false);
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section className="care-record-overview" aria-labelledby="care-record-overview-title">
      <header className="care-record-overview__header">
        <div>
          <p className="care-record-overview__eyebrow">YOUR CARE INFORMATION</p>
          <h2 id="care-record-overview-title" className="care-record-overview__title">Your Care Record</h2>
          <p className="care-record-overview__intro">See what has been saved, who shared it and what may still need checking.</p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="care-record-overview__refresh">
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      {error && <RecordState kind={errorKind} description={error} onAction={() => void load(true)} />}
      {loading && !hasLoaded ? <RecordState kind="loading" /> : (hasLoaded || !error) && (
        <>
          <section className="care-record-overview__section">
            <h3 className="care-record-overview__section-title">What is saved</h3>
            <p className="care-record-overview__section-note">These are saved care details. A report is not automatically a confirmed fact.</p>
            {items.length === 0 ? (
              <RecordState kind="first-empty" title="No care information recorded yet" description="Add a care update to begin building this record." onAction={() => router.push("/workspace/daily-care")} />
            ) : (
              <div className="care-record-overview__items">
                {items.map((item) => (
                  <article key={item.id} className="care-record-overview__item">
                    <div className="care-record-overview__item-heading">
                      <strong className="care-record-overview__item-title">{caregiverSourceText(item.title) || "Care update"}</strong>
                      <span className="care-record-overview__status">{plainStatus(item.epistemic_status || item.status)}</span>
                    </div>
                    {caregiverSourceText(item.description) && <p className="care-record-overview__description">{caregiverSourceText(item.description)}</p>}
                    <p className="care-record-overview__meta">Shared by: {caregiverSafeGeneratedText(item.source_label) || "Not recorded"} · Happened: {happenedWhen(item)} · Saved: {when(item.recorded_at)}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="care-record-overview__section">
            <h3 className="care-record-overview__section-title">Changes in care over time</h3>
            {historyLoading ? <RecordState kind="loading" title="Loading change history" /> : historyNote ? <RecordState kind="error" title="Change history could not be loaded" description={historyNote} /> : null}
            {!historyLoading && !historyNote && changes.length === 0 ? (
              <RecordState kind="period-empty" title="No changes recorded" description="Recorded changes will appear here when they are available." />
            ) : (
              <div className="care-record-overview__changes">
                {changes.map((change) => (
                  <article key={change.id} className="care-record-overview__change">
                    <strong className="care-record-overview__change-title">{plainStatus(change.change_type)}{change.change_direction ? " · " + plainStatus(change.change_direction) : ""}</strong>
                    <p className="care-record-overview__change-description">{caregiverSafeChangeText(change.previous_state) || "Earlier details not recorded"} → {caregiverSafeChangeText(change.current_state) || "Latest details not recorded"}</p>
                    <small className="care-record-overview__change-date">Recorded: {when(change.created_at)}</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <p className="care-record-overview__disclaimer">This view shows the information saved here. It does not diagnose, choose between reports that do not match, or assume nothing happened just because information is missing.</p>
        </>
      )}
    </section>
  );
}
