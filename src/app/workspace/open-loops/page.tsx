"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, AlertCircle, Clock3, FileText, MessageCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { ensureAnonymousSession, getJSON, postJSON } from "@/api/client";
import { caregiverInformationAreaLabel, caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

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
  review_at: string | null;
  source_type?: string | null;
  source_id?: string | null;
  owner_label?: string | null;
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
type LoopOccurrence = {
  id: string;
  source_type: string;
  source_id: string;
  occurred_at: string;
  created_at: string;
};

function dateLabel(value?: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(value: string): string {
  return caregiverStatusLabel(value) || "Update";
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

function AttentionCard({ item, loops, onUpdate, onAction, onHistory, onCreate, busy, history, occurrences }: {
  item: AttentionDecision;
  loops: OpenLoop[];
  onUpdate: (loop: OpenLoop, text: string) => Promise<void>;
  onAction: (loop: OpenLoop, text: string) => Promise<void>;
  onHistory: (loop: OpenLoop) => Promise<void>;
  onCreate: (item: AttentionDecision) => Promise<void>;
  busy: boolean;
  history?: LoopHistoryEvent[];
  occurrences?: LoopOccurrence[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [updateText, setUpdateText] = useState("");
  const [showAction, setShowAction] = useState(false);
  const [actionText, setActionText] = useState("");
  const loop = loops.find((candidate) => candidate.id === item.record_id || (candidate.source_type === item.source && candidate.source_id === item.record_id));
  const evidenceIds = uniqueEvidenceIds(item);
  const reasonLines = [...(item.priority_basis || []), ...(item.reason ? [item.reason] : [])].filter(Boolean);
  const categoryLabel = item.category === "needs_attention_now" ? "Needs attention now"
    : item.category === "important_to_address" ? "Important to address"
    : item.category === "can_wait_with_documented_basis" ? "Being monitored"
    : item.category === "needs_clarification" ? "Needs checking" : "Follow-up";

  return <article className="followup-card">
    <div className="followup-card-heading">
      <div><p className="followup-eyebrow">{categoryLabel}</p><h3>{caregiverSafeAssistantText(item.title) || "Follow-up"}</h3></div>
      <span className="followup-status">{categoryLabel}</span>
    </div>
    {reasonLines.length > 0 && <p className="followup-reason"><AlertCircle size={14} /> {reasonLines.map((line) => caregiverSafeAssistantText(line)).filter(Boolean).join(" · ")}</p>}
    <div className="followup-meta">
      <span><Clock3 size={14} /> {dateLabel(item.occurred_at || item.recorded_at)}</span>
      <span><FileText size={14} /> {evidenceIds.length} related {evidenceIds.length === 1 ? "note or document" : "notes or documents"}</span>
      {item.due_at && <span>Due: {dateLabel(item.due_at)}</span>}
    </div>
    {expanded && <div className="followup-detail">
      <p><strong>Why this needs attention</strong><br />{reasonLines.length ? reasonLines.map((line) => caregiverSafeAssistantText(line)).filter(Boolean).join("; ") : "No separate explanation was provided."}</p>
      {(item.records || []).map((record) => <p key={record.source + ":" + record.record_id}><strong>{caregiverSafeAssistantText(record.title) || "Related care record"}</strong><br />{caregiverInformationAreaLabel(record.source) || "Care information"} · Recorded {dateLabel(record.recorded_at || record.occurred_at)}</p>)}
      <p><strong>Related notes and documents</strong><br />{uniqueEvidenceIds(item).length ? `${uniqueEvidenceIds(item).length} related ${uniqueEvidenceIds(item).length === 1 ? "note or document" : "notes or documents"}` : "No notes or documents are linked here."}</p>
      {item.review_at && <p><strong>{new Date(item.review_at).getTime() <= Date.now() ? "Review requested" : "Next review date"}</strong><br />{dateLabel(item.review_at)}</p>}
      {history && <section className="followup-history"><strong>Previous updates</strong>{history.length === 0 ? <p>No previous updates are available.</p> : <ol>{history.map((event) => <li key={event.id}>{statusLabel(event.event_type)} · {dateLabel(event.created_at)}{event.evidence?.length ? " · " + event.evidence.length + " saved note(s) or document(s)" : ""}</li>)}</ol>}</section>}
      {occurrences && occurrences.length > 0 && <section className="followup-history"><strong>Repeated events</strong><ol>{occurrences.map((item) => <li key={item.id}>{caregiverInformationAreaLabel(item.source_type) || "Care event"} · {dateLabel(item.occurred_at)}</li>)}</ol></section>}
    </div>}
    {loop && !["closed", "cancelled"].includes(loop.status) && <div className="followup-update-area">
      {showUpdate ? <form onSubmit={(event) => { event.preventDefault(); if (updateText.trim()) void onUpdate(loop, updateText.trim()).then(() => { setUpdateText(""); setShowUpdate(false); }).catch(() => { /* Keep the exact report text available for a safe retry. */ }); }}>
        <label htmlFor={"followup-update-" + loop.id}>Tell SolenOS what has changed. This will be saved as your report. It will not be treated as confirmed.</label>
        <textarea id={"followup-update-" + loop.id} rows={3} value={updateText} onChange={(event) => setUpdateText(event.target.value)} maxLength={12000} placeholder="Share an update in your own words…" />
        <div className="followup-actions"><button type="button" className="followup-text-button" onClick={() => setShowUpdate(false)}>Cancel</button><button type="submit" className="followup-primary-button" disabled={busy || !updateText.trim()}>{busy ? "Saving…" : "Share update"}</button></div>
      </form> : <button type="button" className="followup-text-button" onClick={() => setShowUpdate(true)}>Share what changed</button>}
      {showAction ? <form onSubmit={(event) => { event.preventDefault(); if (actionText.trim()) void onAction(loop, actionText.trim()).then(() => { setActionText(""); setShowAction(false); }).catch(() => { /* Keep the caregiver's action report available for retry. */ }); }}>
        <label htmlFor={"followup-action-" + loop.id}>What action did you take? This records your report; it does not verify the outcome.</label>
        <textarea id={"followup-action-" + loop.id} rows={3} value={actionText} onChange={(event) => setActionText(event.target.value)} maxLength={12000} placeholder="Describe the action in your own words…" />
        <div className="followup-actions"><button type="button" className="followup-text-button" onClick={() => setShowAction(false)}>Cancel</button><button type="submit" className="followup-primary-button" disabled={busy || !actionText.trim()}>{busy ? "Saving…" : "Record action"}</button></div>
      </form> : <button type="button" className="followup-text-button" onClick={() => setShowAction(true)}>Record action taken</button>}
    </div>}
    <div className="followup-actions">
      <button type="button" className="followup-text-button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide details" : "See why this appeared"} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
      {loop && <button type="button" className="followup-text-button" onClick={() => void onHistory(loop)}>View previous updates</button>}
      {!loop && item.source === "events" && item.record_id && (
        <button type="button" className="followup-primary-button" onClick={() => void onCreate(item)} disabled={busy}>
          {busy ? "Adding…" : "Add to Follow-ups"}
        </button>
      )}
      <Link className="followup-secondary-button" href={"/workspace/companion?prompt=" + encodeURIComponent("Help me understand this follow-up using only saved care information: " + item.title + ". Explain what is known, what is not clear yet and what still needs attention.")}><MessageCircle size={15} /> Ask Care Assistant</Link>
    </div>
  </article>;
}

export default function FollowUpsPage() {
  const [loops, setLoops] = useState<OpenLoop[]>([]);
  const [assessment, setAssessment] = useState<SituationAssessment | null>(null);
  const [historyById, setHistoryById] = useState<Record<string, LoopHistoryEvent[]>>({});
  const [occurrencesById, setOccurrencesById] = useState<Record<string, LoopOccurrence[]>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const pendingUpdateKeys = useRef<Record<string, { signature: string; key: string }>>({});
  const pendingCreateKeys = useRef<Record<string, string>>({});
  const pendingActionKeys = useRef<Record<string, { signature: string; key: string }>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attentionWarning, setAttentionWarning] = useState("");

  const refresh = useCallback(async () => {
    const session = await ensureAnonymousSession();
    const personId = session.person?.id;
    if (!personId) throw new Error("The active care record could not be confirmed.");
    try {
      await postJSON("/open-loops/reassess", {});
    } catch {
      setAttentionWarning("SolenOS could not refresh the status of every follow-up. Previously saved information is still shown.");
    }
    const [loopResult, assessmentResult] = await Promise.allSettled([
      getJSON("/open-loops?limit=100"),
      getJSON("/care-continuity/situation-understanding"),
    ]);
    const nextLoops = loopResult.status === "fulfilled" && Array.isArray((loopResult.value as { items?: unknown }).items)
      ? (loopResult.value as { items: OpenLoop[] }).items : null;
    let nextAssessmentResponse = assessmentResult.status === "fulfilled" ? assessmentResult.value as SituationAssessmentResponse : null;
    let reassessmentFailed = false;
    if (nextAssessmentResponse && (nextAssessmentResponse.status === "not_assessed" || nextAssessmentResponse.source_freshness?.reassessment_recommended === true)) {
      try {
        nextAssessmentResponse = await postJSON("/care-continuity/situation-understanding/reassess", {}) as SituationAssessmentResponse;
      } catch {
        reassessmentFailed = true;
        setAttentionWarning("SolenOS could not finish refreshing its attention review. The last available saved view is retained and may be out of date.");
      }
    }
    const nextAssessment = nextAssessmentResponse?.assessment && nextAssessmentResponse.assessment.person_id === personId
      ? nextAssessmentResponse.assessment : null;
    if (!nextLoops && !nextAssessment) throw new Error("We couldn't load your saved follow-ups or care information.");
    if (nextLoops !== null) setLoops(nextLoops);
    if (nextAssessment !== null) setAssessment(nextAssessment);
    if (!nextLoops || !nextAssessment) setAttentionWarning("Some care information could not be loaded. This view is incomplete; unavailable information is not treated as empty or resolved.");
    else if (!reassessmentFailed) setAttentionWarning("");
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void refresh().catch(() => { if (active) setError("Follow-ups could not be loaded from the care record. Check your connection and try again."); })
      .finally(() => { if (active) setLoading(false); });
    const refreshAfterCareChange = () => { void refresh().catch(() => setAttentionWarning("SolenOS could not check the latest follow-ups. Your saved follow-ups remain visible.")); };
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
    const linkedToSavedFollowUp = (item: AttentionDecision) => loops.some((loop) =>
      loop.source_type === item.source && loop.source_id === item.record_id
    );
    return {
      needsAttention: unique([...(care?.needs_attention_now || []), ...(care?.important_to_address || [])]).filter((item) => !linkedToSavedFollowUp(item)),
      monitored: unique(care?.can_wait_with_documented_basis || []).filter((item) => !linkedToSavedFollowUp(item)),
      needsClarification: unique(care?.needs_clarification || []).filter((item) => !linkedToSavedFollowUp(item)),
    };
  }, [assessment, loops]);

  const assessmentIsBounded = Boolean(assessment && (
    assessment.history_coverage !== "complete" || assessment.schema_status !== "complete"
    || assessment.open_loops?.has_more || assessment.care_attention?.limitations?.length
  ));

  async function shareUpdate(loop: OpenLoop, text: string) {
    setBusyId(loop.id);
    setError("");
    setNotice("");
    const signature = text.trim();
    const pending = pendingUpdateKeys.current[loop.id];
    const idempotencyKey = pending?.signature === signature ? pending.key : crypto.randomUUID();
    pendingUpdateKeys.current[loop.id] = { signature, key: idempotencyKey };
    try {
      const endpoint = ["awaiting_response", "follow_up"].includes(loop.loop_type)
        ? "/open-loops/" + encodeURIComponent(loop.id) + "/responses"
        : "/open-loops/" + encodeURIComponent(loop.id) + "/outcomes";
      await postJSON(endpoint, {
        text: signature,
        evidence: [],
        response_outcome: "response_received",
        idempotency_key: idempotencyKey,
      });
      await refresh();
      delete pendingUpdateKeys.current[loop.id];
      setNotice("Your update was saved as a caregiver report. SolenOS has not marked the matter resolved.");
    } catch {
      // Retain the key and the caregiver's text while the result is uncertain.
      // A retry must converge on the original write rather than append a duplicate.
      setError("The update could not be confirmed. Nothing has been marked resolved.");
      throw new Error("Caregiver update was not confirmed; preserve the draft for retry.");
    } finally {
      setBusyId("");
    }
  }

  async function createFollowUp(item: AttentionDecision) {
    if (item.source !== "events" || !item.record_id) return;
    const sourceKey = item.source + ":" + item.record_id;
    setBusyId(sourceKey);
    setError("");
    setNotice("");
    const idempotencyKey = pendingCreateKeys.current[sourceKey] || crypto.randomUUID();
    pendingCreateKeys.current[sourceKey] = idempotencyKey;
    const description = [
      item.reason,
      ...(item.priority_basis || []),
    ].filter((value): value is string => Boolean(value && value.trim())).join(" · ")
      || "This saved care event was marked for follow-up during the latest review.";
    try {
      await postJSON("/open-loops", {
        loop_type: "follow_up",
        title: caregiverSafeAssistantText(item.title) || "Care follow-up",
        description,
        source_type: item.source,
        source_id: item.record_id,
        evidence: uniqueEvidenceIds(item).map((evidenceId) => ({ evidence_id: evidenceId })),
        uncertainty: "unknown",
        idempotency_key: idempotencyKey,
      });
      await refresh();
      delete pendingCreateKeys.current[sourceKey];
      setNotice("Added to Follow-ups. The original care report remains unchanged.");
    } catch {
      setError("The follow-up could not be confirmed. Keep this item open and try again.");
    } finally {
      setBusyId("");
    }
  }

  async function recordAction(loop: OpenLoop, text: string) {
    setBusyId(loop.id);
    setError("");
    setNotice("");
    const signature = text.trim();
    const pending = pendingActionKeys.current[loop.id];
    const idempotencyKey = pending?.signature === signature ? pending.key : crypto.randomUUID();
    pendingActionKeys.current[loop.id] = { signature, key: idempotencyKey };
    try {
      await postJSON("/open-loops/" + encodeURIComponent(loop.id) + "/actions", {
        text: signature,
        evidence: [],
        idempotency_key: idempotencyKey,
      });
      await refresh();
      delete pendingActionKeys.current[loop.id];
      setNotice("Your action was recorded as a caregiver report. The outcome has not been marked as verified.");
    } catch {
      setError("The action could not be confirmed. Keep the report available and try again.");
      throw new Error("Caregiver action was not confirmed; preserve the draft for retry.");
    } finally {
      setBusyId("");
    }
  }

  async function loadHistory(loop: OpenLoop) {
    setBusyId(loop.id);
    try {
      const [result, occurrenceResult] = await Promise.all([
        getJSON("/open-loops/" + encodeURIComponent(loop.id) + "/history?limit=100"),
        getJSON("/open-loops/" + encodeURIComponent(loop.id) + "/occurrences?limit=100"),
      ]);
      if (!Array.isArray(result) || !Array.isArray(occurrenceResult)) throw new Error("Follow-up history response was invalid.");
      setHistoryById((current) => ({ ...current, [loop.id]: result as LoopHistoryEvent[] }));
      setOccurrencesById((current) => ({ ...current, [loop.id]: occurrenceResult as LoopOccurrence[] }));
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

  return <div className="mobile-screen followups-page">
    <header className="followups-header">
      <Link href="/workspace" className="followups-back"><ArrowLeft size={17} /> Care Record</Link>
      <p className="followups-kicker">CARE FOLLOW-UPS</p>
      <div className="followups-title-row">
        <div><h1>Follow-ups</h1><p>SolenOS checks the care information you have saved and keeps follow-ups easy to find. You only need to step in when we need your knowledge or action.</p></div>
        <button type="button" className="followups-refresh" onClick={() => { setLoading(loops.length === 0 && !assessment); void refresh().catch(() => setError("Follow-ups could not be refreshed. Your previously saved information remains visible.")).finally(() => setLoading(false)); }} disabled={loading} aria-label="Refresh follow-ups"><RefreshCw size={17} /></button>
      </div>
    </header>
    {error && <p className="followups-alert" role="alert">{error}</p>}
    {notice && <p className="followups-notice" role="status">{notice}</p>}
    {attentionWarning && <p className="followups-limitation" role="note">{attentionWarning}</p>}
    {assessmentIsBounded && <p className="followups-limitation" role="note">Some saved care information is missing or has not been checked. An empty section does not mean nothing needs attention.</p>}
    {loading ? <section className="followups-empty" aria-live="polite">Checking saved care information…</section> : error && loops.length === 0 && !assessment ? <section className="followups-empty"><AlertCircle size={22} /><h2>Saved care information is unavailable</h2><p>SolenOS cannot tell what still needs attention until your saved care information can be loaded.</p></section> : <>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Needs attention</h2><p>Things that may need your attention now or soon.</p></div><span>{categorized.needsAttention.length}</span></div>
        {categorized.needsAttention.map((item) => <AttentionCard key={decisionKey(item)} item={item} loops={loops} onUpdate={shareUpdate} onAction={recordAction} onHistory={loadHistory} onCreate={createFollowUp} busy={busyId === item.record_id || busyId === item.source + ":" + item.record_id} history={loops.find((loop) => loop.id === item.record_id) ? historyById[item.record_id || ""] : undefined} occurrences={loops.find((loop) => loop.id === item.record_id) ? occurrencesById[item.record_id || ""] : undefined} />)}
        {categorized.needsAttention.length === 0 && <p className="followups-empty-inline">{assessment?.care_attention ? "Nothing was marked as needing attention in the latest review." : "SolenOS could not check what needs attention. Your saved follow-ups remain visible below."}</p>}
      </section>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Being monitored</h2><p>Things that can wait based on the information available.</p></div><span>{categorized.monitored.length + unclassifiedLoops.length}</span></div>
        {categorized.monitored.map((item) => <AttentionCard key={decisionKey(item)} item={item} loops={loops} onUpdate={shareUpdate} onAction={recordAction} onHistory={loadHistory} onCreate={createFollowUp} busy={busyId === item.record_id || busyId === item.source + ":" + item.record_id} history={item.record_id ? historyById[item.record_id] : undefined} occurrences={item.record_id ? occurrencesById[item.record_id] : undefined} />)}
        {unclassifiedLoops.map((loop) => <AttentionCard key={loop.id} item={{ title: loop.title, category: "unclassified", record_id: loop.id, reason: loop.description, review_at: loop.review_at, evidence_ids: [] }} loops={loops} onUpdate={shareUpdate} onAction={recordAction} onHistory={loadHistory} onCreate={createFollowUp} busy={busyId === loop.id} history={historyById[loop.id]} />)}
        {categorized.monitored.length === 0 && unclassifiedLoops.length === 0 && <p className="followups-empty-inline">There are no other items to show from the information reviewed.</p>}
      </section>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Needs checking</h2><p>Information that is missing, unclear or does not match. SolenOS will not guess which version is right.</p></div><span>{categorized.needsClarification.length}</span></div>
        {categorized.needsClarification.map((item) => <AttentionCard key={decisionKey(item)} item={item} loops={loops} onUpdate={shareUpdate} onAction={recordAction} onHistory={loadHistory} onCreate={createFollowUp} busy={busyId === item.record_id || busyId === item.source + ":" + item.record_id} history={item.record_id ? historyById[item.record_id] : undefined} occurrences={item.record_id ? occurrencesById[item.record_id] : undefined} />)}
        {categorized.needsClarification.length === 0 && <p className="followups-empty-inline">Nothing needs checking based on the information reviewed.</p>}
      </section>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Resolved</h2><p>Items marked as completed or closed.</p></div><span>{loops.filter((loop) => loop.status === "closed").length}</span></div>
        {loops.filter((loop) => loop.status === "closed").map((loop) => <article key={loop.id} className="followup-card"><p className="followup-eyebrow">Closed · {statusLabel(loop.outcome_status)}</p><h3>{caregiverSafeAssistantText(loop.title) || "Follow-up"}</h3><p>{caregiverSafeAssistantText(loop.description) || "No further details are available."}</p><p className="followup-meta"><span>First recorded {dateLabel(loop.created_at)}</span><span>Updated {dateLabel(loop.updated_at)}</span></p></article>)}
        {loops.some((loop) => loop.status === "cancelled") && <p className="followups-empty-inline">{loops.filter((loop) => loop.status === "cancelled").length} stopped {loops.filter((loop) => loop.status === "cancelled").length === 1 ? "follow-up is" : "follow-ups are"} not marked as completed.</p>}
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
  </div>;
}
