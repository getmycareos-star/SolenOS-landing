"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { ensureAnonymousSession, getJSON } from "@/api/client";

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
    confirmed: "Confirmed by a source",
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
  return labels[value] || value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function CareRecordOverview() {
  const [items, setItems] = useState<CareItem[]>([]);
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyNote, setHistoryNote] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setHistoryNote(null);
    try {
      const session = await ensureAnonymousSession();
      const personId = session.person?.id;
      if (!personId) throw new Error("The care record could not be opened.");
      const response = await getJSON("/care-continuity/current-care?limit_per_source=12") as {
        person_id?: string;
        items?: CareItem[];
        read_only?: boolean;
      };
      if (response.person_id !== personId || !Array.isArray(response.items)) {
        throw new Error("The saved care information could not be verified for this session.");
      }
      setItems(response.items);
      try {
        const history = await getJSON("/change/changes/" + encodeURIComponent(personId));
        if (!Array.isArray(history)) throw new Error("History was unavailable.");
        setChanges(history as ChangeItem[]);
      } catch {
        setChanges([]);
        setHistoryNote("The saved change history could not be loaded. Other saved information is still shown.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Saved care information could not be loaded.");
      setItems([]);
      setChanges([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <section aria-labelledby="care-record-overview-title" style={{ display: "grid", gap: 18, color: "#26392c" }}>
      <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: "0 0 5px", color: "#66816a", fontSize: 11, fontWeight: 800, letterSpacing: ".08em" }}>SAVED CARE INFORMATION</p>
          <h2 id="care-record-overview-title" style={{ margin: 0, fontSize: 22 }}>Care record details</h2>
          <p style={{ margin: "7px 0 0", color: "#69796c", fontSize: 14, lineHeight: 1.6 }}>A clear view of what has been saved, where it came from, and what may still need checking.</p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} style={{ display: "inline-flex", alignItems: "center", gap: 7, minHeight: 42, padding: "8px 12px", border: "1px solid #dce6da", borderRadius: 10, background: "#f8fbf7", color: "#39533d", fontWeight: 700 }}>
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      {error && <p role="alert" style={{ margin: 0, padding: 13, borderRadius: 10, background: "#fff7f2", color: "#80523b", lineHeight: 1.55 }}>{error}</p>}
      {loading ? <p role="status" style={{ color: "#69796c" }}>Loading saved care information…</p> : !error && (
        <>
          <section style={{ border: "1px solid #e1e9df", borderRadius: 14, padding: 15, background: "#fff" }}>
            <h3 style={{ margin: "0 0 5px", fontSize: 16 }}>What is saved</h3>
            <p style={{ margin: "0 0 12px", color: "#758276", fontSize: 12 }}>These are entries returned from the saved care record. A report is not automatically a confirmed fact.</p>
            {items.length === 0 ? (
              <p style={{ margin: 0, color: "#69796c", fontSize: 14, lineHeight: 1.6 }}>No care entries were returned from the available record sources. This does not mean there are no care needs or concerns.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {items.map((item) => (
                  <article key={item.id} style={{ padding: 12, border: "1px solid #e8eee6", borderRadius: 11, background: "#fbfdfb" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                      <strong style={{ fontSize: 14 }}>{item.title || item.kind || "Care update"}</strong>
                      <span style={{ padding: "3px 7px", borderRadius: 7, background: "#eef4ec", color: "#536e55", fontSize: 11 }}>{plainStatus(item.epistemic_status || item.status)}</span>
                    </div>
                    {item.description && <p style={{ margin: "7px 0 0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{item.description}</p>}
                    <p style={{ margin: "8px 0 0", color: "#758276", fontSize: 11 }}>From: {item.source_label || "Source not recorded"} · Saved: {when(item.recorded_at || item.occurred_at)}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section style={{ border: "1px solid #e1e9df", borderRadius: 14, padding: 15, background: "#fff" }}>
            <h3 style={{ margin: "0 0 5px", fontSize: 16 }}>Changes recorded over time</h3>
            {historyNote && <p role="status" style={{ color: "#805d3c", fontSize: 13 }}>{historyNote}</p>}
            {!historyNote && changes.length === 0 ? (
              <p style={{ margin: 0, color: "#69796c", fontSize: 14, lineHeight: 1.6 }}>No saved changes were returned. SolenOS will not invent a change when there is no record of one.</p>
            ) : (
              <div style={{ display: "grid", gap: 9 }}>
                {changes.map((change) => (
                  <article key={change.id} style={{ padding: 11, border: "1px solid #e8eee6", borderRadius: 10 }}>
                    <strong style={{ fontSize: 13 }}>{plainStatus(change.change_type)}{change.change_direction ? " · " + plainStatus(change.change_direction) : ""}</strong>
                    <p style={{ margin: "5px 0 0", color: "#596b5d", fontSize: 13, lineHeight: 1.5 }}>{change.previous_state || "Earlier state not recorded"} → {change.current_state || "Latest state not recorded"}</p>
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
