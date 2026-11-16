"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { ensureAnonymousSession, getJSON, getPersonId } from "@/api/client";
import { caregiverSafeAssistantText } from "@/lib/caregiver-language";
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

function plainStatus(value?: string | null): string {
  const labels: Record<string, string> = {
    reported: "Reported",
    observed: "Observed",
    confirmed: "Marked as confirmed",
    uncertain: "Still unclear",
    disputed: "Different accounts",
    needs_clarification: "Needs checking",
    active: "Current",
    resolved: "Resolved",
    open: "Still open",
    closed: "Closed",
    not_recorded: "Not recorded",
  };
  if (!value) return "Not recorded";
  return labels[value] || "Not available";
}

export function CareRecordOverview() {
  const router = useRouter();
  const [items, setItems] = useState<CareItem[]>([]);
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      const accessDenied = /401|403|unauthori[sz]ed|forbidden|access denied|not authenticated|not authorized|session.*required|authentication/i.test(message);
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
    <section className="care-record-overview" aria-labelledby="care-record-overview-title" style={{ display: "grid", gap: 18, color: "#26392c" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: "0 0 5px", color: "#66816a", fontSize: 11, fontWeight: 800, letterSpacing: ".08em" }}>YOUR CARE INFORMATION</p>
          <h2 id="care-record-overview-title" style={{ margin: 0, fontSize: 22 }}>Your Care Record</h2>
          <p style={{ margin: "7px 0 0", color: "#69796c", fontSize: 14, lineHeight: 1.6 }}>See what has been saved, who shared it and what may still need checking.</p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 42, padding: "8px 12px", border: "1px solid #dce6da", borderRadius: 10, background: "#f8fbf7", color: "#39533d", fontWeight: 700 }}>
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      {error && <RecordState kind={/\b(401|403|unauthori[sz]ed|forbidden|not authenticated|access denied|permission)\b/i.test(error) ? "forbidden" : /\b(502|503|504|network|fetch failed)\b/i.test(error) ? "unavailable" : "error"} description={error} onAction={() => void load(true)} />}
      {loading && !hasLoaded ? <RecordState kind="loading" /> : (hasLoaded || !error) && (
        <>
          <section style={{ border: "1px solid #e1e9df", borderRadius: 14, padding: 15, background: "#fff" }}>
            <h3 style={{ margin: "0 0 5px", fontSize: 16 }}>What is saved</h3>
            <p style={{ margin: "0 0 12px", color: "#758276", fontSize: 12 }}>These are saved care details. A report is not automatically a confirmed fact.</p>
            {items.length === 0 ? (
              <RecordState kind="first-empty" title="No care information recorded yet" description="Add a care update to begin building this record." onAction={() => router.push("/workspace/daily-care")} />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {items.map((item) => (
                  <article key={item.id} style={{ padding: 12, border: "1px solid #e8eee6", borderRadius: 11, background: "#fbfdfb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 14 }}>{caregiverSafeAssistantText(item.title) || "Care update"}</strong>
                      <span style={{ padding: "3px 7px", borderRadius: 7, background: "#eef4ec", color: "#536e55", fontSize: 11 }}>{plainStatus(item.epistemic_status || item.status)}</span>
                    </div>
                    {caregiverSafeAssistantText(item.description) && <p style={{ margin: "7px 0 0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{caregiverSafeAssistantText(item.description)}</p>}
                    <p style={{ margin: "8px 0 0", color: "#758276", fontSize: 11 }}>Shared by: {caregiverSafeAssistantText(item.source_label) || "Not recorded"} · Saved: {when(item.recorded_at || item.occurred_at)}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section style={{ border: "1px solid #e1e9df", borderRadius: 14, padding: 15, background: "#fff" }}>
            <h3 style={{ margin: "0 0 5px", fontSize: 16 }}>Changes in care over time</h3>
            {historyLoading ? <RecordState kind="loading" title="Loading change history" /> : historyNote ? <RecordState kind="error" title="Change history could not be loaded" description={historyNote} /> : null}
            {!historyLoading && !historyNote && changes.length === 0 ? (
              <RecordState kind="period-empty" title="No changes recorded" description="Recorded changes will appear here when they are available." />
            ) : (
              <div style={{ display: "grid", gap: 9 }}>
                {changes.map((change) => (
                  <article key={change.id} style={{ padding: 11, border: "1px solid #e8eee6", borderRadius: 10 }}>
                    <strong style={{ fontSize: 13 }}>{plainStatus(change.change_type)}{change.change_direction ? " · " + plainStatus(change.change_direction) : ""}</strong>
                    <p style={{ margin: "5px 0 0", color: "#596b5d", fontSize: 13, lineHeight: 1.5 }}>{caregiverSafeAssistantText(change.previous_state) || "Earlier details not recorded"} → {caregiverSafeAssistantText(change.current_state) || "Latest details not recorded"}</p>
                    <small style={{ color: "#7b887d" }}>{when(change.created_at)}</small>
                  </article>
                ))}
              </div>
            )}
          </section>

          <p style={{ margin: 0, color: "#788579", fontSize: 12, lineHeight: 1.6 }}>This view shows saved information only. It does not diagnose, decide which conflicting report is correct, or treat missing information as proof that nothing happened.</p>
        </>
      )}
    </section>
  );
}
