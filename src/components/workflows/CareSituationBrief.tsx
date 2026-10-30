"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowUpRight, ChevronDown, ChevronUp, CircleHelp, Clock3, RefreshCw, ShieldCheck } from "lucide-react";
import { ensureAnonymousSession, getJSON } from "@/api/client";

type RecordItem = {
  id: string;
  kind?: string;
  priority?: number;
  title?: string;
  description?: string;
  status?: string;
  epistemic_status?: string;
  source_collection?: string;
  source_type?: string;
  source_label?: string;
  reported_by_label?: string | null;
  occurred_at?: string | null;
  recorded_at?: string | null;
  due_at?: string | null;
  evidence_ids?: string[];
  claim_count?: number;
};

type ChangeItem = {
  id: string;
  change_type?: string;
  change_direction?: string;
  previous_state?: string | null;
  current_state?: string | null;
  created_at?: string | null;
};

type CurrentCareResponse = {
  person_id?: string;
  as_of?: string | null;
  schema_status?: string;
  history_coverage?: string;
  missing_required_sources?: string[];
  missing_optional_sources?: string[];
  source_coverage?: Record<string, { status?: string; returned_count?: number; has_more?: boolean }>;
  items?: RecordItem[];
  has_more?: boolean;
  notice?: string;
};

function dateLabel(value?: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date not recorded" : date.toLocaleString();
}

function isConflict(item: RecordItem): boolean {
  const source = (item.source_collection || "").toLowerCase();
  const kind = (item.kind || "").toLowerCase();
  const status = (item.status || item.epistemic_status || "").toLowerCase();
  return source === "conflicts" || source === "reconciliations" ||
    /conflict|reconciliation review/.test(kind) ||
    /disputed|conflicting|contested/.test(status) ||
    (item.claim_count ?? 0) > 1;
}

function isQuestionOrGap(item: RecordItem): boolean {
  const source = (item.source_collection || "").toLowerCase();
  const kind = (item.kind || "").toLowerCase();
  return ["uncertainties", "information_gaps", "missing_information", "open_questions", "follow_up_links"].includes(source) ||
    /clarification|missing|open question|information gap|follow-up/.test(kind);
}

function isAttention(item: RecordItem): boolean {
  return (typeof item.priority === "number" && item.priority <= 5) ||
    /attention|follow.?up|conflict|clarification|missing/.test((item.kind || "").toLowerCase());
}

function isCurrent(item: RecordItem): boolean {
  return ["events", "facts", "evidence_observations", "assertions", "caregiver_observations", "evidence"].includes((item.source_collection || "").toLowerCase()) &&
    !isConflict(item) && !isQuestionOrGap(item);
}

function CareSection({
  title,
  icon,
  items,
  empty,
  tone = "neutral",
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<RecordItem | ChangeItem>;
  empty: string;
  tone?: "neutral" | "attention";
}) {
  const border = tone === "attention" ? "#ead9c8" : "#e3eae1";
  return (
    <section style={{ minWidth: 0, border: `1px solid ${border}`, borderRadius: 13, padding: 13, background: "#fff" }}>
      <h4 style={{ display: "flex", alignItems: "center", gap: 7, margin: "0 0 9px", color: "#314b37", fontSize: 13, fontWeight: 800 }}>
        {icon}{title}
      </h4>
      {items.length === 0 ? (
        <p style={{ margin: 0, color: "#788579", fontSize: 12, lineHeight: 1.55 }}>{empty}</p>
      ) : (
        <div style={{ display: "grid", gap: 9 }}>
          {items.slice(0, 3).map((raw, index) => {
            const item = raw as RecordItem & ChangeItem;
            const change = "previous_state" in item || "current_state" in item;
            const description = change
              ? `${item.previous_state || "Earlier state not recorded"} → ${item.current_state || "Latest state not recorded"}`
              : item.description || item.title || "Description not recorded";
            const titleText = change
              ? [item.change_type, item.change_direction].filter(Boolean).join(" · ") || "Recorded change"
              : item.title || item.kind || "Care information";
            const sourceText = change ? "Change history" : item.source_label || item.source_type || "Source not recorded";
            const when = change ? item.created_at : item.occurred_at || item.recorded_at;
            return (
              <article key={item.id || `${titleText}-${index}`} style={{ paddingTop: index ? 9 : 0, borderTop: index ? "1px solid #edf1eb" : 0 }}>
                <strong style={{ display: "block", color: "#34483a", fontSize: 12, lineHeight: 1.45 }}>{titleText}</strong>
                <p style={{ margin: "4px 0 0", color: "#596a5c", fontSize: 12, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{description}</p>
                <small style={{ display: "block", marginTop: 5, color: "#7a887b", fontSize: 10, lineHeight: 1.4 }}>{sourceText} · {dateLabel(when)}</small>
                {!change && <small style={{ display: "block", marginTop: 3, color: "#68796a", fontSize: 10, lineHeight: 1.4 }}>Reported by: {item.reported_by_label || "Not recorded"} · Supporting evidence: {item.evidence_ids?.length ?? 0} linked item(s)</small>}
              </article>
            );
          })}
        </div>
      )}
      {items.length > 3 && <p style={{ margin: "8px 0 0", color: "#788579", fontSize: 10 }}>Showing 3 of {items.length} returned items.</p>}
    </section>
  );
}

export default function CareSituationBrief() {
  const [data, setData] = useState<CurrentCareResponse | null>(null);
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyWarning, setHistoryWarning] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError(null);
    setHistoryWarning(null);
    try {
      const session = await ensureAnonymousSession();
      const personId = session.person?.id;
      if (!personId) throw new Error("The care record could not be verified for this session.");
      const current = await getJSON("/care-continuity/current-care?limit_per_source=50") as CurrentCareResponse;
      if (current.person_id !== personId || !Array.isArray(current.items)) {
        throw new Error("The Living Care Record returned an invalid or unverified response.");
      }
      setData(current);
      try {
        const history = await getJSON("/change/changes/" + encodeURIComponent(personId));
        if (!Array.isArray(history)) throw new Error("Change history was not returned in the expected format.");
        setChanges(history as ChangeItem[]);
      } catch {
        setChanges([]);
        setHistoryWarning("Change history is unavailable. Other returned record information remains visible.");
      }
      setLoadedAt(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The care situation could not be loaded.");
      setData(null);
      setChanges([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Refresh when caregivers return to the Companion and periodically while it
  // remains open. The Companion's answer endpoint independently retrieves fresh
  // server-side LCR context for every question.
  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void load(true);
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(true);
    }, 60_000);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(interval);
    };
  }, [load]);

  const items = data?.items ?? [];
  const currentItems = useMemo(() => items.filter(isCurrent), [items]);
  const attentionItems = useMemo(() => items.filter(isAttention), [items]);
  const questionItems = useMemo(() => items.filter(isQuestionOrGap), [items]);
  const conflictItems = useMemo(() => items.filter(isConflict), [items]);
  const decisionItems = useMemo(() => items.filter(item => ["decisions", "decision_outcomes"].includes((item.source_collection || "").toLowerCase())), [items]);
  const openActionItems = useMemo(() => items.filter(item => ["open_loop_records", "follow_up_links"].includes((item.source_collection || "").toLowerCase())), [items]);

  const incomplete = data && (data.schema_status !== "complete" || (data.missing_required_sources?.length ?? 0) > 0 || data.has_more);

  return (
    <section aria-labelledby="care-situation-brief-title" style={{ width: "100%", minWidth: 0, margin: "0 0 16px", border: "1px solid #dce7da", borderRadius: 17, background: "#f7faf6", overflow: "hidden" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "13px 15px" }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#55745a", fontSize: 10, fontWeight: 850, letterSpacing: ".09em", textTransform: "uppercase" }}>
            <ShieldCheck size={14} /> Living Care Record
          </div>
          <h3 id="care-situation-brief-title" style={{ margin: "4px 0 0", color: "#263c2c", fontSize: 17, lineHeight: 1.25 }}>Care Situation Brief</h3>
          <p style={{ margin: "4px 0 0", color: "#718073", fontSize: 11 }}>Evidence-backed context for this Companion session</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} aria-label="Refresh care situation" title="Refresh care situation" style={{ display: "grid", placeItems: "center", width: 36, height: 36, border: "1px solid #dce7da", borderRadius: 10, background: "#fff", color: "#47634b" }}>
            <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} />
          </button>
          <button type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded} aria-controls="care-situation-brief-content" aria-label={expanded ? "Collapse care situation brief" : "Expand care situation brief"} style={{ display: "grid", placeItems: "center", width: 36, height: 36, border: "1px solid #dce7da", borderRadius: 10, background: "#fff", color: "#47634b" }}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </header>
      {expanded && (
        <div id="care-situation-brief-content" style={{ padding: "0 13px 13px" }}>
          {loading ? <p role="status" style={{ margin: 0, padding: 12, color: "#68796a", fontSize: 13 }}>Loading the saved care situation…</p> : error ? (
            <p role="alert" style={{ margin: 0, padding: 12, border: "1px solid #ead9d0", borderRadius: 10, background: "#fff9f6", color: "#7b4e3e", fontSize: 13 }}>{error}</p>
          ) : data ? (
            <>
              {incomplete && <p role="status" style={{ margin: "0 0 10px", padding: 9, borderRadius: 9, background: "#fff8ee", color: "#795d3d", fontSize: 11, lineHeight: 1.5 }}>
                This is a bounded record view. Some required sources may be unavailable or additional entries may exist. Do not interpret an empty section as proof that nothing happened.
              </p>}
              {historyWarning && <p role="status" style={{ margin: "0 0 10px", color: "#795d3d", fontSize: 11 }}>{historyWarning}</p>}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 9 }}>
                <CareSection title="What’s happening now" icon={<Clock3 size={14} />} items={currentItems} empty="No current entries were returned by this record view. This does not establish that no care information exists." />
                <CareSection title="What has changed" icon={<RefreshCw size={14} />} items={changes} empty="No recorded changes were returned for this record view." />
                <CareSection title="What deserves attention" icon={<AlertTriangle size={14} />} items={attentionItems} empty="No attention candidates were returned by this record view." tone="attention" />
                <CareSection title="Questions and missing information" icon={<CircleHelp size={14} />} items={questionItems} empty="No open questions or information gaps were returned." />
                <CareSection title="Conflicting information" icon={<AlertTriangle size={14} />} items={conflictItems} empty="No explicit conflict entries were returned. This is not proof that all accounts agree." />
                <CareSection title="Decisions and outcomes" icon={<ShieldCheck size={14} />} items={decisionItems} empty="No decision or outcome entries were returned by this record view." />
                <CareSection title="Open actions and follow-ups" icon={<Clock3 size={14} />} items={openActionItems} empty="No open care actions or follow-up links were returned by this record view." tone="attention" />
              </div>
              <footer style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2eae0" }}>
                <span style={{ color: "#778579", fontSize: 10 }}>Record view refreshed {dateLabel(loadedAt)}{data.as_of ? ` · source snapshot ${dateLabel(data.as_of)}` : ""}</span>
                <Link href="/workspace/timeline" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#315b39", fontSize: 11, fontWeight: 800, textDecoration: "none" }}>View full record <ArrowUpRight size={13} /></Link>
              </footer>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
