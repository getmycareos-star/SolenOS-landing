"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, AlertCircle, Clock3, FileText, MessageCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";
import { caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

type OpenLoop = {
  id: string;
  loop_type: string;
  title: string;
  description: string;
  status: string;
  outcome_status: string;
  priority: string;
  priority_reasons: string[];
  deadline_at: string | null;
  deadline_source: string | null;
  overdue: boolean;
  missing_information: string[];
  evidence: Array<Record<string, unknown>>;
  response_evidence: Array<Record<string, unknown>>;
  outcome_evidence: Array<Record<string, unknown>>;
  created_at: string;
  updated_at: string;
};

type AttentionDecision = {
  id?: string;
  source?: string;
  record_id?: string;
  title: string;
  category: string;
  reason?: string;
  priority_basis?: string[];
  evidence_ids?: string[];
  occurred_at?: string | null;
  recorded_at?: string | null;
  due_at?: string | null;
  review_at?: string | null;
  records?: Array<{ source: string; record_id: string; title: string; occurred_at?: string | null; recorded_at?: string | null; evidence_ids: string[] }>;
};

type SituationAssessment = {
  person_id: string;
  schema_status: string;
  history_coverage: string;
  care_attention?: {
    needs_attention_now: AttentionDecision[];
    important_to_address: AttentionDecision[];
    can_wait_with_documented_basis: AttentionDecision[];
    needs_clarification: AttentionDecision[];
    limitations: string[];
    source_coverage?: Record<string, unknown>;
  };
  open_loops?: { items: Array<Record<string, unknown>>; count: number; has_more: boolean; notice: string };
  notice?: string;
};

type SituationAssessmentResponse = {
  status: "available" | "not_assessed" | "created" | "unchanged";
  assessment: SituationAssessment | null;
  source_freshness?: { status: string; reassessment_recommended: boolean; limitation?: string };
};

type LoopHistoryEvent = {
  id: string;
  event_type: string;
  evidence: Array<Record<string, unknown>>;
  created_at: string;
};

function dateLabel(value?: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(value: string): string {
  return caregiverStatusLabel(value) || value.replaceAll("_", " ");
}

function decisionKey(item: AttentionDecision): string {
  return String(item.source || "unknown") + ":" + String(item.record_id || item.id || item.title);
}

function uniqueEvidenceIds(item: AttentionDecision): string[] {
  return [...new Set([
    ...(item.evidence_ids || []),
    ...((item.records || []).flatMap((record) => record.evidence_ids || [])),
  ])];
}

function AttentionCard({ item, loops, onUpdate, onHistory, busy, history }: {
  item: AttentionDecision;
  loops: OpenLoop[];
  onUpdate: (loop: OpenLoop, text: string) => Promise<void>;
  onHistory: (loop: OpenLoop) => Promise<void>;
  busy: boolean;
  history?: LoopHistoryEvent[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateText, setUpdateText] = useState("");
  const loop = loops.find((candidate) => candidate.id === item.record_id);
  const evidenceIds = uniqueEvidenceIds(item);
  const reasonLines = [...(item.priority_basis || []), ...(item.reason ? [item.reason] : [])].filter(Boolean);
  const categoryLabel = item.category === "needs_attention_now" ? "Needs attention now"
    : item.category === "important_to_address" ? "Important to address"
    : item.category === "can_wait_with_documented_basis" ? "Being monitored"
    : item.category === "needs_clarification" ? "Needs clarification" : "Care matter";

  return <article className="followup-card">
    <div className="followup-card-heading">
      <div><p className="followup-eyebrow">{categoryLabel}</p><h3>{caregiverSafeAssistantText(item.title) || "Care matter"}</h3></div>
      <span className="followup-status">{categoryLabel}</span>
    </div>
    {reasonLines.length > 0 && <p className="followup-reason"><AlertCircle size={14} /> {reasonLines.map((line) => caregiverSafeAssistantText(line)).filter(Boolean).join(" · ")}</p>}
    <div className="followup-meta">
      <span><Clock3 size={14} /> {dateLabel(item.occurred_at || item.recorded_at)}</span>
      <span><FileText size={14} /> {evidenceIds.length} evidence reference(s)</span>
      {item.due_at && <span>Recorded due date: {dateLabel(item.due_at)}</span>}
    </div>
    {expanded && <div className="followup-detail">
      <p><strong>Why SolenOS surfaced this</strong><br />{reasonLines.length ? reasonLines.map((line) => caregiverSafeAssistantText(line)).filter(Boolean).join("; ") : "The assessment did not return a separate explanation."}</p>
      {(item.records || []).map((record) => <p key={record.source + ":" + record.record_id}><strong>{caregiverSafeAssistantText(record.title) || "Related care record"}</strong><br />{caregiverSafeAssistantText(record.source)} · Recorded {dateLabel(record.recorded_at || record.occurred_at)}</p>)}
      <p><strong>Evidence references</strong><br />{evidenceIds.length ? evidenceIds.join(", ") : "No linked evidence references were returned."}</p>
      {item.review_at && <p><strong>Next recorded review</strong><br />{dateLabel(item.review_at)}</p>}
      {history && <section className="followup-history"><strong>Previous updates</strong>{history.length === 0 ? <p>No previous updates are available.</p> : <ol>{history.map((event) => <li key={event.id}>{statusLabel(event.event_type)} · {dateLabel(event.created_at)}{event.evidence?.length ? " · " + event.evidence.length + " saved evidence item(s)" : ""}</li>)}</ol>}</section>}
    </div>}
    {loop && !["closed", "cancelled"].includes(loop.status) && <div className="followup-update-area">
      {showUpdate ? <form onSubmit={(event) => { event.preventDefault(); if (updateText.trim()) void onUpdate(loop, updateText.trim()).then(() => { setUpdateText(""); setShowUpdate(false); }); }}>
        <label htmlFor={"followup-update-" + loop.id}>Tell SolenOS what has changed. This will be saved as your report, not a verified outcome.</label>
        <textarea id={"followup-update-" + loop.id} rows={3} value={updateText} onChange={(event) => setUpdateText(event.target.value)} maxLength={12000} placeholder="Share an update in your own words…" />
        <div className="followup-actions"><button type="button" className="followup-text-button" onClick={() => setShowUpdate(false)}>Cancel</button><button type="submit" className="followup-primary-button" disabled={busy || !updateText.trim()}>{busy ? "Saving…" : "Share update"}</button></div>
      </form> : <button type="button" className="followup-text-button" onClick={() => setShowUpdate(true)}>Share what changed</button>}
    </div>}
    <div className="followup-actions">
      <button type="button" className="followup-text-button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide details" : "See why this appeared"} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
      {loop && <button type="button" className="followup-text-button" onClick={() => void onHistory(loop)}>View previous updates</button>}
      <Link className="followup-secondary-button" href={"/workspace/companion?prompt=" + encodeURIComponent("Help me understand this follow-up using only saved care evidence: " + item.title + ". Explain what is known, what is uncertain and what remains unresolved.")}><MessageCircle size={15} /> Ask SolenOS</Link>
    </div>
  </article>;
}

export default function FollowUpsPage() {
  const [loops, setLoops] = useState<OpenLoop[]>([]);
  const [assessment, setAssessment] = useState<SituationAssessment | null>(null);
  const [historyById, setHistoryById] = useState<Record<string, LoopHistoryEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attentionWarning, setAttentionWarning] = useState("");

  const refresh = useCallback(async () => {
    const session = await ensureAnonymousSession();
    const personId = session.person?.id;
    if (!personId) throw new Error("The active care record could not be confirmed.");
    const [loopResult, assessmentResult] = await Promise.allSettled([
      getJSON("/open-loops?limit=100"),
      getJSON("/care-continuity/situation-understanding"),
    ]);
    const nextLoops = loopResult.status === "fulfilled" && Array.isArray((loopResult.value as { items?: unknown }).items)
      ? (loopResult.value as { items: OpenLoop[] }).items : null;
    let nextAssessmentResponse = assessmentResult.status === "fulfilled" ? assessmentResult.value as SituationAssessmentResponse : null;
    if (nextAssessmentResponse && (nextAssessmentResponse.status === "not_assessed" || nextAssessmentResponse.source_freshness?.reassessment_recommended === true)) {
      try {
        nextAssessmentResponse = await postJSON("/care-continuity/situation-understanding/reassess", {}) as SituationAssessmentResponse;
      } catch {
        setAttentionWarning("SolenOS could not finish refreshing its attention review. The last available saved view is retained.");
      }
    }
    const nextAssessment = nextAssessmentResponse?.assessment && nextAssessmentResponse.assessment.person_id === personId
      ? nextAssessmentResponse.assessment : null;
    if (!nextLoops && !nextAssessment) throw new Error("Neither saved follow-ups nor the care assessment could be loaded.");
    setLoops(nextLoops || []);
    setAssessment(nextAssessment);
    if (!nextLoops || !nextAssessment) setAttentionWarning("Some care information could not be loaded. This view is incomplete; unavailable information is not treated as empty or resolved.");
    else setAttentionWarning("");
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void refresh().catch(() => { if (active) setError("Follow-ups could not be loaded from the care record. Check your connection and try again."); })
      .finally(() => { if (active) setLoading(false); });
    const refreshAfterCareChange = () => { void refresh().catch(() => setAttentionWarning("SolenOS could not refresh its latest attention review. Saved follow-ups remain visible.")); };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refreshAfterCareChange(); };
    window.addEventListener("careRecordUpdated", refreshAfterCareChange);
    window.addEventListener("focus", refreshAfterCareChange);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener("careRecordUpdated", refreshAfterCareChange);
      window.removeEventListener("focus", refreshAfterCareChange);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  const categorized = useMemo(() => {
    const care = assessment?.care_attention;
    const unique = (items: AttentionDecision[]) => {
      const seen = new Set<string>();
      return items.filter((item) => { const key = decisionKey(item); if (seen.has(key)) return false; seen.add(key); return true; });
    };
    return {
      needsAttention: unique([...(care?.needs_attention_now || []), ...(care?.important_to_address || [])]),
      monitored: unique(care?.can_wait_with_documented_basis || []),
      needsClarification: unique(care?.needs_clarification || []),
    };
  }, [assessment]);

  const assessmentIsBounded = Boolean(assessment && (
    assessment.history_coverage !== "complete" || assessment.schema_status !== "complete"
    || assessment.open_loops?.has_more || assessment.care_attention?.limitations?.length
  ));

  async function shareUpdate(loop: OpenLoop, text: string) {
    setBusyId(loop.id);
    setError("");
    setNotice("");
    try {
      await postJSON("/open-loops/" + encodeURIComponent(loop.id) + "/outcomes", {
        text,
        evidence: [],
        idempotency_key: crypto.randomUUID(),
      });
      await refresh();
      setNotice("Your update was saved as a caregiver report. SolenOS has not marked the matter resolved.");
    } catch {
      setError("The update could not be confirmed. Nothing has been marked resolved.");
    } finally {
      setBusyId("");
    }
  }

  async function loadHistory(loop: OpenLoop) {
    setBusyId(loop.id);
    try {
      const result = await getJSON("/open-loops/" + encodeURIComponent(loop.id) + "/history?limit=100");
      if (!Array.isArray(result)) throw new Error("History response was invalid.");
      setHistoryById((current) => ({ ...current, [loop.id]: result as LoopHistoryEvent[] }));
      setNotice("Previous updates loaded.");
    } catch {
      setError("Previous updates could not be loaded. The saved follow-up itself has not changed.");
    } finally {
      setBusyId("");
    }
  }

  const allAttention = [...categorized.needsAttention, ...categorized.monitored, ...categorized.needsClarification];
  const linkedLoops = loops.filter((loop) => !["closed", "cancelled"].includes(loop.status));
  const linkedKeys = new Set(allAttention.map((item) => String(item.record_id || item.id || "")));
  const unclassifiedLoops = linkedLoops.filter((loop) => !linkedKeys.has(loop.id));

  return <main className="mobile-screen followups-page">
    <header className="followups-header">
      <Link href="/workspace" className="followups-back"><ArrowLeft size={17} /> Living Care Record</Link>
      <p className="followups-kicker">SOLENOS CARE CONTINUITY</p>
      <div className="followups-title-row">
        <div><h1>Follow-ups</h1><p>SolenOS reviews the saved care history and keeps unresolved matters visible. You only need to step in when your knowledge or action is needed.</p></div>
        <button type="button" className="followups-refresh" onClick={() => { setLoading(true); void refresh().catch(() => setError("Follow-ups could not be refreshed. Try again.")).finally(() => setLoading(false)); }} disabled={loading} aria-label="Refresh follow-ups"><RefreshCw size={17} /></button>
      </div>
    </header>
    {error && <p className="followups-alert" role="alert">{error}</p>}
    {notice && <p className="followups-notice" role="status">{notice}</p>}
    {attentionWarning && <p className="followups-limitation" role="note">{attentionWarning}</p>}
    {assessmentIsBounded && <p className="followups-limitation" role="note">Some saved care information is incomplete or outside the current review. An empty section does not prove that nothing remains unresolved.</p>}
    {loading ? <section className="followups-empty" aria-live="polite">Reviewing the saved care history…</section> : error && loops.length === 0 && !assessment ? <section className="followups-empty"><AlertCircle size={22} /><h2>Care history is unavailable</h2><p>SolenOS cannot safely determine what remains unresolved until the saved care information can be loaded.</p></section> : <>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Needs attention</h2><p>Matters with a recorded reason to address them now or soon.</p></div><span>{categorized.needsAttention.length}</span></div>
        {categorized.needsAttention.map((item) => <AttentionCard key={decisionKey(item)} item={item} loops={loops} onUpdate={shareUpdate} onHistory={loadHistory} busy={busyId === item.record_id} history={loops.find((loop) => loop.id === item.record_id) ? historyById[item.record_id || ""] : undefined} />)}
        {categorized.needsAttention.length === 0 && <p className="followups-empty-inline">{assessment?.care_attention ? "No matters were classified as needing attention in the latest assessment." : "SolenOS could not load its attention assessment. Saved open matters remain visible below."}</p>}
      </section>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Being monitored</h2><p>Matters that can wait on the basis of the saved information, or have no stronger priority basis.</p></div><span>{categorized.monitored.length + unclassifiedLoops.length}</span></div>
        {categorized.monitored.map((item) => <AttentionCard key={decisionKey(item)} item={item} loops={loops} onUpdate={shareUpdate} onHistory={loadHistory} busy={busyId === item.record_id} history={item.record_id ? historyById[item.record_id] : undefined} />)}
        {unclassifiedLoops.map((loop) => <article key={loop.id} className="followup-card"><p className="followup-eyebrow">Saved follow-up · {statusLabel(loop.status)}</p><h3>{caregiverSafeAssistantText(loop.title) || "Care matter"}</h3><p>{caregiverSafeAssistantText(loop.description) || "No further details are available."}</p><p className="followup-meta"><span><Clock3 size={14} /> First recorded {dateLabel(loop.created_at)}</span></p><button type="button" className="followup-text-button" onClick={() => void loadHistory(loop)}>View previous updates</button></article>)}
        {categorized.monitored.length === 0 && unclassifiedLoops.length === 0 && <p className="followups-empty-inline">No other open matters were returned by the available assessment.</p>}
      </section>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Needs clarification</h2><p>Missing, uncertain or conflicting information. SolenOS will not guess which account is correct.</p></div><span>{categorized.needsClarification.length}</span></div>
        {categorized.needsClarification.map((item) => <AttentionCard key={decisionKey(item)} item={item} loops={loops} onUpdate={shareUpdate} onHistory={loadHistory} busy={busyId === item.record_id} history={item.record_id ? historyById[item.record_id] : undefined} />)}
        {categorized.needsClarification.length === 0 && <p className="followups-empty-inline">No clarification items were returned by the latest assessment.</p>}
      </section>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Resolved</h2><p>Items closed in the saved follow-up record.</p></div><span>{loops.filter((loop) => loop.status === "closed").length}</span></div>
        {loops.filter((loop) => loop.status === "closed").map((loop) => <article key={loop.id} className="followup-card"><p className="followup-eyebrow">Closed · {statusLabel(loop.outcome_status)}</p><h3>{caregiverSafeAssistantText(loop.title) || "Care matter"}</h3><p>{caregiverSafeAssistantText(loop.description) || "No further details are available."}</p><p className="followup-meta"><span>First recorded {dateLabel(loop.created_at)}</span><span>Updated {dateLabel(loop.updated_at)}</span></p></article>)}
        {loops.some((loop) => loop.status === "cancelled") && <p className="followups-empty-inline">{loops.filter((loop) => loop.status === "cancelled").length} stopped item(s) are not represented as verified outcomes.</p>}
        {loops.filter((loop) => loop.status === "closed").length === 0 && <p className="followups-empty-inline">No closed follow-ups are recorded here.</p>}
      </section>
    </>}
    <style jsx>{`
      .followups-page{max-width:900px;margin:0 auto;padding:24px 18px 64px;color:var(--text,#1f2a22)}
      .followups-header{margin-bottom:24px}.followups-back{display:inline-flex;align-items:center;gap:7px;margin-bottom:22px;color:var(--text-secondary,#536157);text-decoration:none;font-size:14px}
      .followups-kicker{color:var(--text-secondary,#657568);font-size:11px;font-weight:750;letter-spacing:.12em}
      .followups-title-row{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-top:8px}.followups-title-row h1{margin:0;font-size:clamp(32px,6vw,42px);line-height:1.1;letter-spacing:-.035em}.followups-title-row p{max-width:650px;margin:9px 0 0;color:var(--text-secondary,#5b665d);line-height:1.6}
      .followups-refresh{flex:0 0 auto;width:44px;height:44px;display:grid;place-items:center;border:1px solid var(--border,#d9dfd8);border-radius:12px;background:var(--surface,#fff);color:var(--text,#1f2a22)}
      .followups-alert,.followups-notice,.followups-limitation{border-radius:12px;padding:12px 14px;font-size:13px;line-height:1.5;margin:0 0 16px}.followups-alert{border:1px solid #c78d78;background:#fff8f5;color:#713d2b}.followups-notice{border:1px solid #a8c1a5;background:#f4f8f2;color:#29452d}.followups-limitation{border:1px solid var(--border,#d9dfd8);background:var(--surface-muted,#f6f8f5);color:var(--text-secondary,#5b665d)}
      .followups-section{display:grid;gap:12px;margin-top:28px}.followups-section-heading{display:flex;align-items:center;justify-content:space-between;gap:14px}.followups-section-heading h2{margin:0;font-size:20px}.followups-section-heading p{margin:4px 0 0;color:var(--text-secondary,#647067);font-size:13px;line-height:1.45}.followups-section-heading>span{display:grid;place-items:center;min-width:30px;height:30px;padding:0 8px;border-radius:999px;background:var(--surface-muted,#edf2eb);font-size:13px;font-weight:700}
      .followup-card{border:1px solid var(--border,#d9dfd8);border-radius:15px;background:var(--surface,#fff);padding:16px;display:grid;gap:10px}.followup-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.followup-eyebrow{margin:0 0 5px;color:var(--text-secondary,#667269);font-size:11px;text-transform:uppercase;letter-spacing:.055em}.followup-card h3{margin:0;font-size:17px;line-height:1.35}.followup-status{flex:0 0 auto;max-width:145px;padding:5px 8px;border-radius:999px;background:var(--surface-muted,#edf2eb);color:var(--text-secondary,#4f5d51);font-size:11px;font-weight:700;text-align:center}
      .followup-meta{display:flex;flex-wrap:wrap;gap:12px;color:var(--text-secondary,#647067);font-size:12px}.followup-meta span,.followup-reason{display:inline-flex;align-items:center;gap:6px}.followup-reason{margin:0;color:#81502f;font-size:13px;line-height:1.45}.followup-detail{border-top:1px solid var(--border,#e1e5df);padding-top:10px;display:grid;gap:8px}.followup-detail p{margin:0;font-size:13px;line-height:1.55;overflow-wrap:anywhere}.followup-history{border-top:1px solid var(--border,#e1e5df);padding-top:9px;font-size:13px}.followup-history ol{padding-left:20px;line-height:1.6}
      .followup-actions{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}.followup-text-button,.followup-secondary-button,.followup-primary-button{min-height:40px;display:inline-flex;align-items:center;justify-content:center;gap:7px;border-radius:9px;padding:8px 12px;font-size:13px;font-weight:650;cursor:pointer;text-decoration:none}.followup-text-button{border:0;background:transparent;color:var(--text,#263329)}.followup-secondary-button{border:1px solid var(--border,#d9dfd8);background:var(--surface,#fff);color:var(--text,#263329)}.followup-primary-button{border:1px solid #8eae8a;background:#b9d5b5;color:#17251c}.followup-primary-button:disabled{opacity:.55;cursor:not-allowed}
      .followup-update-area{border-top:1px solid var(--border,#e1e5df);padding-top:12px}.followup-update-area form{display:grid;gap:9px}.followup-update-area label{font-size:12px;color:var(--text-secondary,#5b665d);line-height:1.5}.followup-update-area textarea{width:100%;box-sizing:border-box;border:1px solid var(--border,#cfd8cf);border-radius:9px;padding:10px;background:var(--surface,#fff);color:var(--text,#1f2a22);font:inherit;resize:vertical}
      .followups-empty,.followups-empty-inline{border:1px dashed var(--border,#d9dfd8);border-radius:13px;padding:20px;color:var(--text-secondary,#647067);line-height:1.55}.followups-empty{display:grid;justify-items:start;gap:8px}.followups-empty h2{margin:0;color:var(--text,#263329);font-size:18px}.followups-empty p{margin:0 0 6px}.followups-empty-inline{margin:0;font-size:13px;padding:14px}
      @media(max-width:560px){.followups-page{padding:18px 13px 48px}.followup-card{padding:13px}.followup-card-heading{display:grid}.followup-status{justify-self:start}}
    `}</style>
  </main>;
}
