"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, AlertCircle, Clock3, FileText, MessageCircle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { ApiResponseError, ensureAnonymousSession, getCaregiverId, getPersonId, getJSON, postJSON } from "@/api/client";
import { caregiverInformationAreaLabel, caregiverSourceText, caregiverSafeAssistantText, caregiverSafeGeneratedText, caregiverStatusLabel } from "@/lib/caregiver-language";

type OpenLoop = {
  id: string;
  version: number;
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
  appointment_id?: string | null;
  appointment_workspace_id?: string | null;
  owner_label?: string | null;
  cancellation_reason?: string | null;
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
  evidence_status?: string;
  history_completeness?: string;
  action_status?: string;
  linked_follow_up_outcome_status?: string;
  significance_assessment_status?: string;
  care_significance?: string;
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

async function loadAllOpenLoops(): Promise<OpenLoop[]> {
  const pageSize = 100;
  const maximumPages = 100;
  const records: OpenLoop[] = [];
  const seenIds = new Set<string>();
  let offset = 0;
  let expectedCount: number | null = null;

  for (let page = 0; page < maximumPages; page += 1) {
    const response = await getJSON(`/open-loops?limit=${pageSize}&offset=${offset}`) as {
      items?: unknown;
      count?: unknown;
    };
    if (!Array.isArray(response.items) || typeof response.count !== "number" || !Number.isInteger(response.count) || response.count < 0) {
      throw new Error("The saved follow-up history returned an incomplete page.");
    }
    if (expectedCount === null) expectedCount = response.count;
    else if (response.count !== expectedCount) {
      throw new Error("The saved follow-up history changed while it was being loaded. Refresh to try again.");
    }
    const rows = response.items as OpenLoop[];
    if (rows.some((row) => !row || typeof row.id !== "string" || !row.id)) {
      throw new Error("The saved follow-up history contained an invalid record.");
    }
    for (const row of rows) {
      if (seenIds.has(row.id)) {
        throw new Error("The saved follow-up history changed while it was being loaded. Refresh to try again.");
      }
      seenIds.add(row.id);
      records.push(row);
    }
    if (records.length > expectedCount) {
      throw new Error("The saved follow-up history count did not match the records returned. Refresh to try again.");
    }
    if (records.length === expectedCount) return records;
    if (rows.length === 0) {
      throw new Error("The saved follow-up history could not be fully retrieved.");
    }
    offset += rows.length;
  }

  throw new Error("The saved follow-up history is larger than the available page limit. No incomplete list was presented as complete.");
}

async function loadAllLoopRecords<T extends { id: string }>(path: string): Promise<T[]> {
  const pageSize = 100;
  const maximumPages = 100;
  const records: T[] = [];
  const seenIds = new Set<string>();

  for (let page = 0; page < maximumPages; page += 1) {
    const response = await getJSON(`${path}${path.includes("?") ? "&" : "?"}limit=${pageSize}&offset=${page * pageSize}`) as unknown;
    if (!Array.isArray(response)) {
      throw new Error("The saved follow-up history returned an incomplete page.");
    }
    const rows = response as T[];
    if (rows.some((row) => !row || typeof row.id !== "string" || !row.id)) {
      throw new Error("The saved follow-up history contained an invalid record.");
    }
    for (const row of rows) {
      if (seenIds.has(row.id)) {
        throw new Error("The saved follow-up history changed while it was being loaded. Refresh to try again.");
      }
      seenIds.add(row.id);
      records.push(row);
    }
    if (rows.length < pageSize) return records;
  }

  throw new Error("The saved follow-up history is larger than the available page limit. No incomplete history was presented as complete.");
}

function dateLabel(value?: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date unavailable" : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(value: string): string {
  return caregiverStatusLabel(value) || "Update";
}

function lifecycleLabel(loop: OpenLoop | undefined): string {
  if (!loop) return "Status not recorded";
  if (loop.status === "closed") return "Resolved";
  if (loop.status === "cancelled") return "No longer relevant";
  if (loop.status === "deferred") return "Waiting for check-in";
  if (loop.status === "blocked") return "Waiting for another step";
  if (loop.status === "review_abandoned") return "Needs review";
  if (loop.status === "pending_closure_verification") return "Waiting to confirm completion";
  if (loop.status === "open" && (loop.response_evidence.length > 0 || loop.outcome_evidence.length > 0)) {
    return "In progress";
  }
  if (["awaiting_response", "missing_information", "professional_input", "unconfirmed_outcome"].includes(loop.loop_type)) {
    return "Waiting for information";
  }
  if (["pending_action", "follow_up", "pending_decision"].includes(loop.loop_type)) {
    return "Waiting for someone to act";
  }
  if (loop.status === "waiting") return "Waiting for information";
  if (loop.status === "open") return "Needs attention";
  return "Status not recorded";
}

function lifecycleNextStepLabel(loop: OpenLoop | undefined): string {
  if (!loop) return "Check the saved information before deciding what to do next.";
  const status = lifecycleLabel(loop);
  if (status === "Resolved") return "No action is needed unless new information changes this.";
  if (status === "No longer relevant") return "No further action is needed unless the situation changes.";
  if (status === "Waiting for check-in") return loop.review_at ? "Check again on the saved review date." : "Choose a date to check this again.";
  if (status === "Waiting to confirm completion") return "Check the saved information before treating this as resolved.";
  if (status === "Waiting for information") return "Ask the person who may know, or add the information when it becomes available.";
  if (status === "Waiting for someone to act") return "Check who can take the next step and record what happens.";
  if (status === "Waiting for another step") return "Record what is needed before this can move forward.";
  if (status === "In progress") return "Add an update when something changes or another step is taken.";
  if (status === "Needs review") return "Review the saved information before deciding what to do next.";
  if (status === "Needs attention") return "Review this item and decide who should take the next step.";
  return "Check the saved information before deciding what to do next.";
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
  const reasonCandidates = [...new Set([...(loop?.priority_reasons || []), ...(item.priority_basis || []), ...(item.reason ? [item.reason] : [])])];
  const missingInformationCandidates = loop?.missing_information || [];
  const missingInformation = missingInformationCandidates
    .map((detail) => caregiverSafeGeneratedText(detail))
    .filter((detail): detail is string => Boolean(detail));
  const reasonLines = reasonCandidates
    .map((line) => caregiverSafeGeneratedText(line))
    .filter((line): line is string => Boolean(line));
  const categoryLabel = item.category === "needs_attention_now" || item.category === "important_to_address" ? "Needs attention"
    : item.category === "can_wait_with_documented_basis" ? "Being monitored"
    : item.category === "needs_clarification" ? "Needs clarification" : "Follow-up";

  return <article className="followup-card">
    <div className="followup-card-heading">
      <div><p className="followup-eyebrow">{categoryLabel}</p><h3>{(item.source === "open_loop_records" ? caregiverSourceText(item.title) : caregiverSafeGeneratedText(item.title)) || "Follow-up"}</h3></div>
    </div>
    {reasonLines.length > 0
      ? <p className="followup-reason"><AlertCircle size={14} /> {reasonLines.join(" · ")}</p>
      : <p className="followup-reason"><AlertCircle size={14} /> {reasonCandidates.length > 0
          ? "The explanation could not be shown clearly. Check the saved care information before relying on it."
          : "No reason was recorded for this follow-up yet."}</p>}
    {reasonLines.length > 0 && reasonLines.length < reasonCandidates.length && <p className="followup-reason">Some explanation could not be shown clearly. Check the saved care information before relying on it.</p>}
    <div className="followup-meta">
      <span><Clock3 size={14} /> {dateLabel(item.occurred_at || item.recorded_at)}</span>
      <span><FileText size={14} /> {evidenceIds.length} related {evidenceIds.length === 1 ? "note or document" : "notes or documents"}</span>
      <span>Who is following up: {loop?.owner_label ? caregiverSafeAssistantText(loop.owner_label) || "Not recorded" : "No one is assigned yet"}</span>
      <span>Status: {lifecycleLabel(loop)}</span>
      <span>Next step: {lifecycleNextStepLabel(loop)}</span>
      <span>Last updated: {loop?.updated_at ? dateLabel(loop.updated_at) : "Not available yet"}</span>
      {item.due_at && <span>Due: {dateLabel(item.due_at)}</span>}
      {item.evidence_status && <span>What we know so far: {caregiverStatusLabel(item.evidence_status) || "Not confirmed"}</span>}
      {item.history_completeness && item.history_completeness !== "complete" && <span>Some earlier care information may be missing.</span>}
      {item.action_status === "not_recorded" && <span>No follow-up action has been saved yet.</span>}
      {item.action_status && item.action_status !== "not_recorded" && <span>What has been done: {caregiverStatusLabel(item.action_status) || "Not recorded"}</span>}
      {item.linked_follow_up_outcome_status && item.linked_follow_up_outcome_status !== "not_recorded" && <span>Result: {caregiverStatusLabel(item.linked_follow_up_outcome_status) || "Not recorded"}</span>}
      {loop?.appointment_id && <span>Related to a saved appointment</span>}
    </div>
    {expanded && <div className="followup-detail">
      <p><strong>{item.category === "can_wait_with_documented_basis" ? "Why this is being monitored" : item.category === "needs_clarification" ? "What still needs checking" : "Why this needs attention"}</strong><br />{reasonLines.length ? reasonLines.join("; ") : reasonCandidates.length ? "Some explanation could not be shown clearly. Check the saved care information before relying on it." : "The reason is not clear from the saved information yet."}</p>
      {(item.category === "needs_clarification" || missingInformationCandidates.length > 0) && (
        <section>
          <strong>What information is missing</strong>
          {missingInformation.length > 0 ? (
            <ul>{missingInformation.map((detail, index) => <li key={index}>{detail}</li>)}</ul>
          ) : (
            <p>{missingInformationCandidates.length > 0
              ? "Some missing details could not be shown clearly. Check the original care information."
              : "The specific information needed has not been recorded yet."}</p>
          )}
        </section>
      )}
      {(item.records || []).map((record) => <p key={record.source + ":" + record.record_id}><strong>{caregiverSourceText(record.title) || "Related care record"}</strong><br />{caregiverInformationAreaLabel(record.source) || "Care information"} · Recorded {dateLabel(record.recorded_at || record.occurred_at)}</p>)}
      {loop?.appointment_id && <p><strong>Related appointment</strong><br />This follow-up is connected to a saved appointment and its history.</p>}
      <p><strong>Related notes and documents</strong><br />{uniqueEvidenceIds(item).length ? `${uniqueEvidenceIds(item).length} related ${uniqueEvidenceIds(item).length === 1 ? "note or document" : "notes or documents"}` : "No notes or documents are linked here."}</p>
      {item.review_at && <p><strong>{new Date(item.review_at).getTime() <= Date.now() ? "Check-in requested" : "Next check-in"}</strong><br />{dateLabel(item.review_at)}</p>}
      {history && <section className="followup-history"><strong>Previous updates</strong>{history.length === 0 ? <p>No previous updates are available.</p> : <ol>{history.map((event) => <li key={event.id}>{statusLabel(event.event_type)} · {dateLabel(event.created_at)}{event.evidence?.length ? " · " + event.evidence.length + " saved note(s) or document(s)" : ""}</li>)}</ol>}</section>}
      {occurrences && occurrences.length > 0 && <section className="followup-history"><strong>Happened more than once</strong><ol>{occurrences.map((item) => <li key={item.id}>{caregiverInformationAreaLabel(item.source_type) || "Care event"} · {dateLabel(item.occurred_at)}</li>)}</ol></section>}
    </div>}
    {loop && !["closed", "cancelled"].includes(loop.status) && <div className="followup-update-area">
      {showUpdate ? <form onSubmit={(event) => { event.preventDefault(); if (updateText.trim()) void onUpdate(loop, updateText.trim()).then(() => { setUpdateText(""); setShowUpdate(false); }).catch(() => { /* Keep the exact report text available for a safe retry. */ }); }}>
        <label htmlFor={"followup-update-" + loop.id}>Tell us what has changed. We’ll save your update, but it will not be treated as confirmed.</label>
        <textarea id={"followup-update-" + loop.id} rows={3} value={updateText} onChange={(event) => setUpdateText(event.target.value)} maxLength={12000} placeholder="Share an update in your own words…" />
        <div className="followup-actions"><button type="button" className="followup-text-button" onClick={() => setShowUpdate(false)}>Cancel</button><button type="submit" className="followup-primary-button" disabled={busy || !updateText.trim()}>{busy ? "Saving…" : "Share update"}</button></div>
      </form> : <button type="button" className="followup-text-button" onClick={() => setShowUpdate(true)}>Share what changed</button>}
      {showAction ? <form onSubmit={(event) => { event.preventDefault(); if (actionText.trim()) void onAction(loop, actionText.trim()).then(() => { setActionText(""); setShowAction(false); }).catch(() => { /* Keep the caregiver's action report available for retry. */ }); }}>
        <label htmlFor={"followup-action-" + loop.id}>What did you do? This saves what you tell us. It does not mean the concern is resolved.</label>
        <textarea id={"followup-action-" + loop.id} rows={3} value={actionText} onChange={(event) => setActionText(event.target.value)} maxLength={12000} placeholder="Describe the action in your own words…" />
        <div className="followup-actions"><button type="button" className="followup-text-button" onClick={() => setShowAction(false)}>Cancel</button><button type="submit" className="followup-primary-button" disabled={busy || !actionText.trim()}>{busy ? "Saving…" : "Save next step"}</button></div>
      </form> : <button type="button" className="followup-text-button" onClick={() => setShowAction(true)}>Save what you did</button>}
    </div>}
    <div className="followup-actions">
      <button type="button" className="followup-text-button" onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide details" : "Why am I seeing this?"} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
      {loop && <button type="button" className="followup-text-button" onClick={() => void onHistory(loop)}>View previous updates</button>}
      {!loop && (item.source === "events" || item.source === "persisted_change") && item.record_id && (
        <button type="button" className="followup-primary-button" onClick={() => void onCreate(item)} disabled={busy}>
          {busy ? "Adding…" : "Add to Follow-ups"}
        </button>
      )}
      <Link className="followup-secondary-button" href={"/workspace/companion?prompt=" + encodeURIComponent("Help me understand this follow-up using only saved care information: " + ((item.source === "open_loop_records" ? caregiverSourceText(item.title) : caregiverSafeGeneratedText(item.title)) || "this follow-up") + ". Explain what is known, what is not clear yet and what still needs attention.")}><MessageCircle size={15} /> Ask Care Assistant</Link>
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
  const refreshSequence = useRef(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attentionWarning, setAttentionWarning] = useState("");
  const [loopHistoryLoadFailed, setLoopHistoryLoadFailed] = useState(false);

  const refresh = useCallback(async () => {
    const requestSequence = ++refreshSequence.current;
    let personId: string | undefined;
    let caregiverId: string | null = null;
    const isCurrentRequest = () =>
      requestSequence === refreshSequence.current &&
      Boolean(personId) &&
      personId === getPersonId() &&
      caregiverId === getCaregiverId();
    const session = await ensureAnonymousSession();
    personId = session.person?.id;
    caregiverId = session.caregiver?.id || null;
    if (!isCurrentRequest()) return;
    if (!personId || !caregiverId) throw new Error("The active care record could not be confirmed.");
    try {
      await postJSON("/open-loops/reassess", {});
    } catch {
      if (isCurrentRequest()) setAttentionWarning("SolenOS could not refresh the status of every follow-up. Previously saved information is still shown.");
    }
    if (!isCurrentRequest()) return;
    const [loopResult, assessmentResult] = await Promise.allSettled([
      loadAllOpenLoops(),
      getJSON("/care-continuity/situation-understanding"),
    ]);
    const nextLoops = loopResult.status === "fulfilled" && Array.isArray(loopResult.value)
      ? loopResult.value : null;
    let nextAssessmentResponse = assessmentResult.status === "fulfilled" ? assessmentResult.value as SituationAssessmentResponse : null;
    if (!isCurrentRequest()) return;
    let reassessmentFailed = false;
    if (nextAssessmentResponse && (nextAssessmentResponse.status === "not_assessed" || nextAssessmentResponse.source_freshness?.reassessment_recommended === true)) {
      try {
        nextAssessmentResponse = await postJSON("/care-continuity/situation-understanding/reassess", {}) as SituationAssessmentResponse;
      } catch {
        reassessmentFailed = true;
        if (isCurrentRequest()) setAttentionWarning("SolenOS could not finish refreshing its attention review. The last available saved view is retained and may be out of date.");
      }
    }
    if (!isCurrentRequest()) return;
    const nextAssessment = nextAssessmentResponse?.assessment && nextAssessmentResponse.assessment.person_id === personId
      ? nextAssessmentResponse.assessment : null;
    if (!nextLoops && !nextAssessment) throw new Error("We couldn't load your saved follow-ups or care information.");
    if (nextLoops !== null) {
      setLoopHistoryLoadFailed(false);
      // Pages use immutable creation order so edits cannot move
      // records across page boundaries. Restore the caregiver-facing priority
      // order only after the complete list has been retrieved.
      const displayOrdered = [...nextLoops].sort((left, right) => {
        const leftDeadline = left.deadline_at ? Date.parse(left.deadline_at) : Number.POSITIVE_INFINITY;
        const rightDeadline = right.deadline_at ? Date.parse(right.deadline_at) : Number.POSITIVE_INFINITY;
        const safeLeftDeadline = Number.isFinite(leftDeadline) ? leftDeadline : Number.POSITIVE_INFINITY;
        const safeRightDeadline = Number.isFinite(rightDeadline) ? rightDeadline : Number.POSITIVE_INFINITY;
        if (safeLeftDeadline !== safeRightDeadline) return safeLeftDeadline - safeRightDeadline;
        const updatedDifference = Date.parse(right.updated_at) - Date.parse(left.updated_at);
        if (Number.isFinite(updatedDifference) && updatedDifference !== 0) return updatedDifference;
        return left.id.localeCompare(right.id);
      });
      setLoops(displayOrdered);
    }
    if (nextAssessment !== null) setAssessment(nextAssessment);
    if (nextLoops === null) setLoopHistoryLoadFailed(true);
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
    const refreshAfterSessionChange = () => {
      // A new caregiver/recipient session must never inherit the previous
      // person's follow-ups, assessment, action drafts or pending write keys.
      refreshSequence.current += 1;
      setLoops([]);
      setAssessment(null);
      setHistoryById({});
      setOccurrencesById({});
      setBusyId("");
      setError("");
      setNotice("");
      setAttentionWarning("");
      setLoopHistoryLoadFailed(false);
      pendingUpdateKeys.current = {};
      pendingCreateKeys.current = {};
      pendingActionKeys.current = {};
      setLoading(true);
      refreshAfterCareChange();
    };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") refreshAfterCareChange(); };
    window.addEventListener("careRecordUpdated", refreshAfterCareChange);
    window.addEventListener("personIdChanged", refreshAfterSessionChange);
    window.addEventListener("focus", refreshAfterCareChange);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      active = false;
      refreshSequence.current += 1;
      window.removeEventListener("careRecordUpdated", refreshAfterCareChange);
      window.removeEventListener("personIdChanged", refreshAfterSessionChange);
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
      // Keep assessment classification visible even when an Open Loop is linked.
      // AttentionCard resolves the linked loop so the caregiver sees the correct
      // category and the saved action history on the same card.
      needsAttention: unique([...(care?.needs_attention_now || []), ...(care?.important_to_address || [])]),
      monitored: unique(care?.can_wait_with_documented_basis || []),
      needsClarification: unique(care?.needs_clarification || []),
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
      if (!Number.isInteger(loop.version) || loop.version < 1) {
        throw new Error("The current follow-up version could not be confirmed.");
      }
      const updatePayload = {
        text: signature,
        evidence: [],
        response_outcome: "response_received",
        expected_version: loop.version,
        idempotency_key: idempotencyKey,
      };
      if (["awaiting_response", "follow_up"].includes(loop.loop_type)) {
        await postJSON(`/open-loops/${encodeURIComponent(loop.id)}/responses`, updatePayload);
      } else {
        await postJSON(`/open-loops/${encodeURIComponent(loop.id)}/outcomes`, updatePayload);
      }
      await refresh();
      delete pendingUpdateKeys.current[loop.id];
      setNotice("Your update was saved. SolenOS has not marked this as resolved.");
    } catch (error) {
      // Retain the key and the caregiver's text while the result is uncertain.
      // A retry must converge on the original write rather than append a duplicate.
      const staleVersion = error instanceof ApiResponseError
        && error.status === 409
        && typeof error.detail === "string"
        && /changed after it was shown|saved version is required/i.test(error.detail);
      if (staleVersion) {
        try { await refresh(); } catch { /* Keep the stale-decision warning visible. */ }
      }
      setError(staleVersion
        ? "This follow-up changed after it was shown. The list has been refreshed; review the latest details before trying again."
        : "The update could not be confirmed. Nothing has been marked resolved.");
      throw new Error("Caregiver update was not confirmed; preserve the draft for retry.");
    } finally {
      setBusyId("");
    }
  }

  async function createFollowUp(item: AttentionDecision) {
    if ((item.source !== "events" && item.source !== "persisted_change") || !item.record_id) return;
    const sourceKey = item.source + ":" + item.record_id;
    setBusyId(sourceKey);
    setError("");
    setNotice("");
    const idempotencyKey = pendingCreateKeys.current[sourceKey] || crypto.randomUUID();
    pendingCreateKeys.current[sourceKey] = idempotencyKey;
    const rawDescriptionLines = [
      item.reason,
      ...(item.priority_basis || []),
    ].filter((value): value is string => Boolean(value && value.trim()));
    const safeDescriptionLines = rawDescriptionLines
      .map((value) => caregiverSafeGeneratedText(value))
      .filter((value): value is string => Boolean(value));
    // Never persist rejected model wording into a caregiver-created follow-up.
    // If any part cannot be shown safely, preserve the need for review without
    // silently changing the meaning of the remaining explanation.
    const description = safeDescriptionLines.length === rawDescriptionLines.length && safeDescriptionLines.length > 0
      ? safeDescriptionLines.join(" · ")
      : "The reason needs to be checked against the original care information.";
    try {
      await postJSON("/open-loops", {
        loop_type: "follow_up",
        title: caregiverSafeGeneratedText(item.title) || "Care follow-up",
        description,
        source_type: item.source,
        source_id: item.record_id,
        evidence: uniqueEvidenceIds(item).map((evidenceId) => ({ evidence_id: evidenceId })),
        uncertainty: "unknown",
        idempotency_key: idempotencyKey,
      });
      await refresh();
      delete pendingCreateKeys.current[sourceKey];
      setNotice("Added to Follow-ups. The original care information has not changed.");
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
      if (!Number.isInteger(loop.version) || loop.version < 1) {
        throw new Error("The current follow-up version could not be confirmed.");
      }
      await postJSON("/open-loops/" + encodeURIComponent(loop.id) + "/actions", {
        text: signature,
        evidence: [],
        expected_version: loop.version,
        idempotency_key: idempotencyKey,
      });
      await refresh();
      delete pendingActionKeys.current[loop.id];
      setNotice("Your action was saved. The concern has not been marked as resolved.");
    } catch (error) {
      const staleVersion = error instanceof ApiResponseError
        && error.status === 409
        && typeof error.detail === "string"
        && /changed after it was shown|saved version is required/i.test(error.detail);
      if (staleVersion) {
        try { await refresh(); } catch { /* Keep the stale-decision warning visible. */ }
      }
      setError(staleVersion
        ? "This follow-up changed after it was shown. The list has been refreshed; review the latest details before trying again."
        : "The action could not be confirmed. Keep the report available and try again.");
      throw new Error("Caregiver action was not confirmed; preserve the draft for retry.");
    } finally {
      setBusyId("");
    }
  }

  async function loadHistory(loop: OpenLoop) {
    setBusyId(loop.id);
    try {
      const base = "/open-loops/" + encodeURIComponent(loop.id);
      const [result, occurrenceResult] = await Promise.all([
        loadAllLoopRecords<LoopHistoryEvent>(base + "/history"),
        loadAllLoopRecords<LoopOccurrence>(base + "/occurrences"),
      ]);
      setHistoryById((current) => ({ ...current, [loop.id]: result }));
      setOccurrencesById((current) => ({ ...current, [loop.id]: occurrenceResult }));
      setNotice("Previous updates loaded.");
    } catch {
      setError("Previous updates could not be loaded. The saved follow-up itself has not changed.");
    } finally {
      setBusyId("");
    }
  }

  const allAttention = [...categorized.needsAttention, ...categorized.monitored, ...categorized.needsClarification];
  const linkedLoops = loops.filter((loop) => !["closed", "cancelled"].includes(loop.status));
  const unclassifiedLoops = linkedLoops.filter((loop) => !allAttention.some((item) =>
    item.record_id === loop.id
    || (item.source === loop.source_type && item.record_id === loop.source_id)
  ));
  const unclassifiedFollowUpItems: AttentionDecision[] = unclassifiedLoops.map((loop) => ({
    title: loop.title,
    category: "needs_clarification",
    source: "open_loop_records",
    record_id: loop.id,
    reason: "We do not yet have enough information to tell whether this needs action or can wait.",
    review_at: loop.review_at,
    evidence_ids: loop.evidence.flatMap((item) =>
      typeof item.evidence_id === "string" && item.evidence_id.trim() ? [item.evidence_id] : []
    ),
  }));

  return <div className="mobile-screen followups-page">
    <header className="followups-header">
      <Link href="/workspace" className="followups-back"><ArrowLeft size={17} /> Care Record</Link>
      <p className="followups-kicker">YOUR FOLLOW-UPS</p>
      <div className="followups-title-row">
        <div><h1>Follow-ups</h1><p>Follow-ups are based on the care information saved here. You may need to add details or take action when something is unclear.</p></div>
        <button type="button" className="followups-refresh" onClick={() => { setLoading(loops.length === 0 && !assessment); void refresh().catch(() => setError("Follow-ups could not be refreshed. Your previously saved information remains visible.")).finally(() => setLoading(false)); }} disabled={loading} aria-label="Refresh follow-ups"><RefreshCw size={17} /></button>
      </div>
    </header>
    {error && <p className="followups-alert" role="alert">{error}</p>}
    {notice && <p className="followups-notice" role="status">{notice}</p>}
    {attentionWarning && <p className="followups-limitation" role="note">{attentionWarning}</p>}
    {assessmentIsBounded && <p className="followups-limitation" role="note">Some saved care information is missing or has not been checked. There may still be something that needs attention, even if it is not shown here.</p>}
    {loading ? <section className="followups-empty" aria-live="polite">Checking saved care information…</section> : error && loops.length === 0 && !assessment ? <section className="followups-empty"><AlertCircle size={22} /><h2>Saved care information is unavailable</h2><p>We can’t tell what still needs attention until your Care Record loads.</p></section> : <>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Needs attention</h2><p>Things that may need your attention now or soon.</p></div><span>{categorized.needsAttention.length}</span></div>
        {categorized.needsAttention.map((item) => <AttentionCard key={decisionKey(item)} item={item} loops={loops} onUpdate={shareUpdate} onAction={recordAction} onHistory={loadHistory} onCreate={createFollowUp} busy={busyId === item.record_id || busyId === item.source + ":" + item.record_id} history={loops.find((loop) => loop.id === item.record_id) ? historyById[item.record_id || ""] : undefined} occurrences={loops.find((loop) => loop.id === item.record_id) ? occurrencesById[item.record_id || ""] : undefined} />)}
        {categorized.needsAttention.length === 0 && <p className="followups-empty-inline">{assessment?.care_attention ? "Nothing was marked as needing attention the last time we checked. There may still be things your family wants to follow up on." : "We couldn’t check what needs attention just now. Your saved follow-ups are still shown below."}</p>}
      </section>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Being monitored</h2><p>Things that can wait based on the information available.</p></div><span>{categorized.monitored.length}</span></div>
        {categorized.monitored.map((item) => <AttentionCard key={decisionKey(item)} item={item} loops={loops} onUpdate={shareUpdate} onAction={recordAction} onHistory={loadHistory} onCreate={createFollowUp} busy={busyId === item.record_id || busyId === item.source + ":" + item.record_id} history={item.record_id ? historyById[item.record_id] : undefined} occurrences={item.record_id ? occurrencesById[item.record_id] : undefined} />)}
        {categorized.monitored.length === 0 && <p className="followups-empty-inline">{assessment?.care_attention ? "Nothing was marked for a check-in the last time we checked." : "We couldn’t check what can wait or needs a check-in just now. Your saved follow-ups are still shown below."}</p>}
      </section>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Needs clarification</h2><p>Information that is missing, unclear or does not match. SolenOS will not guess which version is right.</p></div><span>{categorized.needsClarification.length + unclassifiedFollowUpItems.length}</span></div>
        {categorized.needsClarification.map((item) => <AttentionCard key={decisionKey(item)} item={item} loops={loops} onUpdate={shareUpdate} onAction={recordAction} onHistory={loadHistory} onCreate={createFollowUp} busy={busyId === item.record_id || busyId === item.source + ":" + item.record_id} history={item.record_id ? historyById[item.record_id] : undefined} occurrences={item.record_id ? occurrencesById[item.record_id] : undefined} />)}
        {unclassifiedFollowUpItems.map((item) => <AttentionCard key={decisionKey(item)} item={item} loops={loops} onUpdate={shareUpdate} onAction={recordAction} onHistory={loadHistory} onCreate={createFollowUp} busy={busyId === item.record_id} history={item.record_id ? historyById[item.record_id] : undefined} occurrences={item.record_id ? occurrencesById[item.record_id] : undefined} />)}
        {categorized.needsClarification.length === 0 && unclassifiedFollowUpItems.length === 0 && <p className="followups-empty-inline">{assessment?.care_attention ? "Nothing was marked as needing clarification the last time we checked." : "We couldn’t check which details need clarification just now. Your saved follow-ups are still shown below."}</p>}
      </section>
      <section className="followups-section">
        <div className="followups-section-heading"><div><h2>Resolved</h2><p>Items marked as resolved.</p></div><span>{loops.filter((loop) => loop.status === "closed").length}</span></div>
        {loops.filter((loop) => loop.status === "closed").map((loop) => <article key={loop.id} className="followup-card"><p className="followup-eyebrow">Closed · {statusLabel(loop.outcome_status)}</p><h3>{caregiverSourceText(loop.title) || "Follow-up"}</h3><p>{caregiverSourceText(loop.description) || "No further details are available."}</p><p className="followup-meta"><span>First recorded {dateLabel(loop.created_at)}</span><span>Updated {dateLabel(loop.updated_at)}</span></p></article>)}
              <section className="followups-section">
        <div className="followups-section-heading"><div><h2>No longer relevant</h2><p>Stopped follow-ups. They are not marked as completed.</p></div><span>{loops.filter((loop) => loop.status === "cancelled").length}</span></div>
        {loops.filter((loop) => loop.status === "cancelled").map((loop) => <article key={loop.id} className="followup-card">
          <p className="followup-eyebrow">No longer relevant</p>
          <h3>{caregiverSourceText(loop.title) || "Follow-up"}</h3>
          <p>{caregiverSourceText(loop.description) || "No further details are available."}</p>
          {loop.cancellation_reason && <p>Why it was stopped: {caregiverSourceText(loop.cancellation_reason) || "No reason was recorded."}</p>}
          <p className="followup-meta"><span>First recorded {dateLabel(loop.created_at)}</span><span>Updated {dateLabel(loop.updated_at)}</span></p>
        </article>)}
        {loops.filter((loop) => loop.status === "cancelled").length === 0 && <p className="followups-empty-inline">No follow-ups have been stopped.</p>}
      </section>
        {loops.filter((loop) => loop.status === "closed").length === 0 && <p className="followups-empty-inline">{loopHistoryLoadFailed ? "We couldn’t check which follow-ups have been resolved just now. Your last saved list remains visible." : "There are no resolved follow-ups here yet."}</p>}
      </section>
    </>}

  </div>;
}
