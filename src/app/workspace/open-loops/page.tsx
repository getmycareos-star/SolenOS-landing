"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock3,
  FileText,
  MessageCircle,
  RefreshCw,
  Sparkles,
} from "lucide-react";
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
  source_type: string | null;
  source_id: string | null;
  created_at: string;
  updated_at: string;
};

type AttentionEvidenceRef = {
  source: string;
  record_id: string;
  title: string;
  occurred_at?: string | null;
  recorded_at?: string | null;
  evidence_ids: string[];
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
  records?: AttentionEvidenceRef[];
};

type CareAttentionAssessment = {
  schema_version: string;
  status: string;
  needs_attention_now: AttentionDecision[];
  important_to_address: AttentionDecision[];
  can_wait_with_documented_basis: AttentionDecision[];
  needs_clarification: AttentionDecision[];
  counts: Record<string, number>;
  source_coverage: Record<string, unknown>;
  limitations: string[];
};

type AssessmentOpenLoop = {
  id: string;
  source: string;
  title: string;
  status: string;
  loop_type: string;
  description?: string;
  owner?: string | null;
  due_at?: string | null;
  recorded_status: string;
  status_confidence: string;
  epistemic_status: string;
  occurred_at?: string | null;
  recorded_at?: string | null;
  evidence_ids: string[];
  priority?: string | null;
  priority_reasons?: string[];
  deferred_reason?: string | null;
  review_at?: string | null;
  deadline_source?: string | null;
  consequence_of_delay?: string | null;
  request_text?: string | null;
  verification_rule?: string | null;
  outcome_status?: string | null;
};

type SituationAssessment = {
  person_id: string;
  as_of?: string | null;
  schema_status: string;
  history_coverage: string;
  care_attention?: CareAttentionAssessment;
  open_loops?: {
    items: AssessmentOpenLoop[];
    count: number;
    has_more: boolean;
    notice: string;
  };
  uncertainties_and_conflicts?: AttentionDecision[];
  missing_information?: AttentionDecision[];
  confidence_assessment?: { overall: string; limitations: string[] };
  notice: string;
};

type SituationAssessmentResponse = {
  person_id: string;
  status: "available" | "not_assessed" | "created" | "unchanged";
  assessment_id?: string;
  assessment: SituationAssessment | null;
  source_freshness?: {
    status: string;
    reassessment_recommended: boolean;
    limitation?: string;
  };
};

type LoadState = "loading" | "ready" | "partial" | "error";

const OPEN_STATES = new Set([
  "open",
  "waiting",
  "deferred",
  "blocked",
  "review_abandoned",
  "pending_closure_verification",
]);

function safeText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? caregiverSafeAssistantText(value) || fallback : fallback;
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusLabel(value: string): string {
  return caregiverStatusLabel(value) || value.replaceAll("_", " ");
}

function decisionKey(item: AttentionDecision): string {
  return String(item.source || "unknown") + ":" + String(item.record_id || item.id || item.title);
}

function findLinkedLoop(item: AttentionDecision, loops: OpenLoop[]): OpenLoop | undefined {
  return loops.find((loop) => loop.id === item.record_id);
}

function uniqueDecisions(items: AttentionDecision[]): AttentionDecision[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = decisionKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function AttentionCard({
  item,
  loop,
  onUpdate,
  busy,
}: {
  item: AttentionDecision;
  loop?: OpenLoop;
  onUpdate: (loop: OpenLoop, text: string) => Promise<void>;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [updateText, setUpdateText] = useState("");
  const [showUpdate, setShowUpdate] = useState(false);
  const reasonLines = [
    ...(item.priority_basis || []),
    ...(item.reason ? [item.reason] : []),
  ].filter(Boolean);
  const evidenceIds = [
    ...(item.evidence_ids || []),
    ...((item.records || []).flatMap((record) => record.evidence_ids || [])),
  ];
  const uniqueEvidenceIds = [...new Set(evidenceIds)];
  const prompt = [
    "Help me understand this item in the person's Living Care Record.",
    "Use only saved evidence. Keep reports, inferences, missing information and verified outcomes distinct.",
    "Do not invent a deadline, owner, outcome or urgency.",
    "Item: " + item.title,
    "Why it was surfaced: " + reasonLines.join("; "),
    "Evidence references: " + uniqueEvidenceIds.join(", "),
  ].join("\n");

  return (
    <article className="followup-card">
      <div className="followup-card-heading">
        <div>
          <p className="followup-eyebrow">{safeText(item.category, "Care matter").replaceAll("_", " ")}</p>
          <h3>{safeText(item.title, "Care information needs review")}</h3>
        </div>
        <span className={"followup-status" + (item.category === "needs_attention_now" ? " is-warning" : "")}>
          {item.category === "needs_attention_now" ? "Needs attention now" : item.category === "important_to_address" ? "Important to address" : item.category === "can_wait_with_documented_basis" ? "Can wait" : "Needs clarification"}
        </span>
      </div>
      {reasonLines.length > 0 && <p className="followup-reason"><AlertCircle size={14} /> {reasonLines.map((line) => safeText(line)).join(" · ")}</p>}
      <div className="followup-meta">
        <span><Clock3 size={14} /> {dateLabel(item.occurred_at || item.recorded_at)}</span>
        <span><FileText size={14} /> {uniqueEvidenceIds.length} linked source(s)</span>
        {item.due_at && <span>Recorded date: {dateLabel(item.due_at)}</span>}
      </div>
      {expanded && (
        <div className="followup-detail">
          <p><strong>What SolenOS identified</strong><br />{safeText(item.title, "A care matter in the saved record.")}</p>
          <p><strong>Why it appeared here</strong><br />{reasonLines.length ? reasonLines.map((line) => safeText(line)).join("; ") : "The assessment did not return a separate explanation."}</p>
          {item.records?.map((record) => (
            <p key={record.source + ":" + record.record_id}>
              <strong>{safeText(record.title, "Related care record")}</strong><br />
              {safeText(record.source, "Source not recorded")} · Recorded {dateLabel(record.recorded_at || record.occurred_at)}
              {record.evidence_ids?.length ? " · " + record.evidence_ids.length + " linked evidence item(s)" : ""}
            </p>
          ))}
          <p><strong>Evidence references</strong><br />{uniqueEvidenceIds.length ? uniqueEvidenceIds.join(", ") : "No linked evidence references were returned."}</p>
          {item.review_at && <p><strong>Next recorded review</strong><br />{dateLabel(item.review_at)}</p>}
        </div>
      )}
      {loop && !["closed", "cancelled"].includes(loop.status) && (
        <div className="followup-update-area">
          {showUpdate ? (
            <form onSubmit={(event) => {
              event.preventDefault();
              if (updateText.trim()) void onUpdate(loop, updateText.trim()).then(() => {
                setUpdateText("");
                setShowUpdate(false);
              });
            }}>
              <label htmlFor={"followup-update-" + loop.id}>Share what has changed. SolenOS will save this as your report, not as a verified outcome.</label>
              <textarea id={"followup-update-" + loop.id} rows={3} value={updateText} onChange={(event) => setUpdateText(event.target.value)} maxLength={12000} placeholder="Tell SolenOS in your own words…" />
              <div className="followup-card-actions">
                <button type="button" className="followup-text-button" onClick={() => setShowUpdate(false)}>Cancel</button>
                <button type="submit" className="followup-primary-button" disabled={busy || !updateText.trim()}>{busy ? "Saving…" : "Share update"}</button>
              </div>
            </form>
          ) : (
            <button type="button" className="followup-text-button" onClick={() => setShowUpdate(true)}>Share an update</button>
          )}
        </div>
      )}
      <div className="followup-card-actions">
        <button type="button" className="followup-text-button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? "Hide details" : "See why this appeared"} {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
        <Link className="followup-secondary-button" href={"/workspace/companion?prompt=" + encodeURIComponent(prompt)}>
          <MessageCircle size={15} /> Ask SolenOS
        </Link>
      </div>
    </article>
  );
}

function LoopHistoryCard({ loop }: { loop: OpenLoop }) {
  return (
    <article className="followup-card">
      <div className="followup-card-heading">
        <div>
          <p className="followup-eyebrow">{safeText(loop.loop_type, "Care follow-up").replaceAll("_", " ")} · {statusLabel(loop.status)}</p>
          <h3>{safeText(loop.title, "Care matter")}</h3>
        </div>
        <span className="followup-status">{loop.status === "closed" ? "Closed" : "Stopped"}</span>
      </div>
      <p className="followup-description">{safeText(loop.description, "No further details are available.")}</p>
      <div className="followup-meta">
        <span><Clock3 size={14} /> First recorded {dateLabel(loop.created_at)}</span>
        <span><FileText size={14} /> {(loop.evidence || []).length + (loop.outcome_evidence || []).length} linked update(s)</span>
      </div>
      <p className="followup-muted">Outcome status: {statusLabel(loop.outcome_status)}. A stopped item is not represented as resolved.</p>
    </article>
  );
}

export default function FollowUpsPage() {
  const [loops, setLoops] = useState<OpenLoop[]>([]);
  const [assessment, setAssessment] = useState<SituationAssessment | null>(null);
  const [sourceFreshness, setSourceFreshness] = useState<SituationAssessmentResponse["source_freshness"]>(undefined);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const session = await ensureAnonymousSession();
      const personId = session.person?.id;
      if (!personId) throw new Error("The active care record could not be confirmed.");
      const [loopResult, assessmentResult] = await Promise.allSettled([
        getJSON("/open-loops?limit=100"),
        getJSON("/care-continuity/situation-understanding"),
      ]);
      const nextLoops = loopResult.status === "fulfilled"
        && Array.isArray((loopResult.value as { items?: unknown }).items)
        ? (loopResult.value as { items: OpenLoop[] }).items
        : null;
      let nextAssessmentResponse = assessmentResult.status === "fulfilled"
        ? assessmentResult.value as SituationAssessmentResponse
        : null;
      let reassessmentWarning = "";

      if (nextAssessmentResponse && (
        nextAssessmentResponse.status === "not_assessed"
        || nextAssessmentResponse.source_freshness?.reassessment_recommended === true
      )) {
        try {
          nextAssessmentResponse = await postJSON("/care-continuity/situation-understanding/reassess", {}) as SituationAssessmentResponse;
        } catch {
          reassessmentWarning = "New care information was found, but SolenOS could not finish refreshing its attention assessment. The previous assessment is retained where available.";
        }
      }

      const nextAssessment = nextAssessmentResponse?.assessment
        && nextAssessmentResponse.assessment.person_id === personId
        ? nextAssessmentResponse.assessment
        : null;
      if (!nextLoops && !nextAssessment) {
        throw new Error("Neither saved follow-ups nor the care assessment could be loaded.");
      }
      setLoops(nextLoops || []);
      setAssessment(nextAssessment);
      setSourceFreshness(nextAssessmentResponse?.source_freshness);
      setLoadState(nextLoops && nextAssessment ? "ready" : "partial");
      if (!nextLoops || !nextAssessment || reassessmentWarning) {
        setError(reassessmentWarning || "Some care information could not be loaded. This view is incomplete; unavailable information is not treated as empty or resolved.");
      }
    } catch {
      setLoadState("error");
      setError("Follow-ups could not be loaded from the care record. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const refreshAfterCareWrite = () => { void refresh(); };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("careRecordUpdated", refreshAfterCareWrite);
    window.addEventListener("focus", refreshAfterCareWrite);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("careRecordUpdated", refreshAfterCareWrite);
      window.removeEventListener("focus", refreshAfterCareWrite);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  const categorized = useMemo(() => {
    const careAttention = assessment?.care_attention;
    const needsAttention = uniqueDecisions([
      ...(careAttention?.needs_attention_now || []),
      ...(careAttention?.important_to_address || []),
    ]);
    const needsClarification = uniqueDecisions(careAttention?.needs_clarification || []);
    const canWait = uniqueDecisions(careAttention?.can_wait_with_documented_basis || []);
    const classifiedKeys = new Set([
      ...needsAttention,
      ...needsClarification,
      ...canWait,
    ].map(decisionKey));
    const openAssessmentItems = assessment?.open_loops?.items || [];
    const unclassifiedOpenLoops = openAssessmentItems
      .filter((item) => !classifiedKeys.has(item.source + ":" + item.id))
      .map((item) => ({
        source: item.source,
        record_id: item.id,
        title: item.title,
        category: "being_monitored",
        reason: item.priority_reasons?.join("; ") || "This item remains open in the saved care record.",
        priority_basis: item.priority_reasons || [],
        evidence_ids: item.evidence_ids || [],
        occurred_at: item.occurred_at,
        recorded_at: item.recorded_at,
        due_at: item.due_at,
        review_at: item.review_at,
      } satisfies AttentionDecision));
    const monitored = uniqueDecisions([...canWait, ...unclassifiedOpenLoops]);
    const classifiedRecordKeys = new Set([
      ...needsAttention,
      ...needsClarification,
      ...monitored,
    ].map(decisionKey));
    const directOpenLoops = loops.filter((loop) => OPEN_STATES.has(loop.status));
    const additionalDirectLoops = directOpenLoops.filter((loop) =>
      !classifiedRecordKeys.has("open_loop_records:" + loop.id)
      && ![...needsAttention, ...needsClarification, ...monitored].some((item) => item.record_id === loop.id),
    ).map((loop) => ({
      source: "open_loop_records",
      record_id: loop.id,
      title: loop.title,
      category: "being_monitored",
      reason: "This item remains open in the saved care record.",
      priority_basis: loop.priority_reasons || [],
      evidence_ids: [],
      recorded_at: loop.updated_at,
    } satisfies AttentionDecision));
    return {
      needsAttention,
      monitored: uniqueDecisions([...monitored, ...additionalDirectLoops]),
      needsClarification,
      resolved: loops.filter((loop) => loop.status === "closed"),
      stopped: loops.filter((loop) => loop.status === "cancelled"),
    };
  }, [assessment, loops]);

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

  const attentionAvailable = Boolean(assessment?.care_attention);
  const assessmentIsBounded = Boolean(assessment && (
    assessment.history_coverage !== "complete"
    || assessment.schema_status !== "complete"
    || assessment.open_loops?.has_more
    || assessment.care_attention?.limitations?.length
  ));
  const staleAssessment = sourceFreshness?.reassessment_recommended === true;

  return (
    <main className="mobile-screen followups-page">
      <header className="followups-header">
        <Link href="/workspace" className="followups-back"><ArrowLeft size={17} /> Living Care Record</Link>
        <div className="followups-kicker"><Sparkles size={15} /> SOLENOS CARE CONTINUITY</div>
        <div className="followups-title-row">
          <div>
            <h1>Follow-ups</h1>
            <p>SolenOS reviews the saved care history and keeps unresolved matters visible. You only need to step in when your knowledge or action is needed.</p>
          </div>
          <button type="button" className="followups-refresh" onClick={() => void refresh()} disabled={loading} aria-label="Refresh follow-ups">
            <RefreshCw size={17} className={loading ? "followups-spin" : ""} />
          </button>
        </div>
      </header>

      {error && <p className="followups-alert" role="alert">{error}</p>}
      {notice && <p className="followups-notice" role="status">{notice}</p>}
      {assessmentIsBounded && (
        <p className="followups-limitation" role="note">
          SolenOS is reviewing a bounded view of the saved care history. Some older records or unavailable sources may not be included. An empty section does not prove that nothing remains unresolved.
        </p>
      )}
      {staleAssessment && (
        <p className="followups-limitation" role="note">The latest care changes have not yet been fully reflected in this assessment.</p>
      )}

      {loadState === "loading" ? (
        <section className="followups-empty" aria-live="polite">Reviewing the saved care history…</section>
      ) : loadState === "error" ? (
        <section className="followups-empty">
          <AlertCircle size={22} />
          <h2>Care history is unavailable</h2>
          <p>SolenOS cannot safely determine what remains unresolved until the saved care information can be loaded.</p>
          <button type="button" className="followup-primary-button" onClick={() => void refresh()}>Try again</button>
        </section>
      ) : (
        <>
          <section className="followups-section">
            <div className="followups-section-heading">
              <div><h2>Needs attention</h2><p>Matters with a recorded reason to address them now or soon.</p></div>
              <span>{categorized.needsAttention.length}</span>
            </div>
            {categorized.needsAttention.map((item) => (
              <AttentionCard key={decisionKey(item)} item={item} loop={findLinkedLoop(item, loops)} onUpdate={shareUpdate} busy={busyId === item.record_id} />
            ))}
            {categorized.needsAttention.length === 0 && <p className="followups-empty-inline">{attentionAvailable ? "No matters were classified as needing attention in the latest assessment." : "SolenOS could not load its attention assessment. Open records remain visible below, but priority is not established."}</p>}
          </section>

          <section className="followups-section">
            <div className="followups-section-heading">
              <div><h2>Being monitored</h2><p>Open matters that can wait on the basis of the saved record, or have no stronger priority basis.</p></div>
              <span>{categorized.monitored.length}</span>
            </div>
            {categorized.monitored.map((item) => (
              <AttentionCard key={decisionKey(item)} item={item} loop={findLinkedLoop(item, loops)} onUpdate={shareUpdate} busy={busyId === item.record_id} />
            ))}
            {categorized.monitored.length === 0 && <p className="followups-empty-inline">No other open matters were returned by the available assessment.</p>}
          </section>

          <section className="followups-section">
            <div className="followups-section-heading">
              <div><h2>Needs clarification</h2><p>Missing, uncertain or conflicting information. SolenOS will not guess which account is correct.</p></div>
              <span>{categorized.needsClarification.length}</span>
            </div>
            {categorized.needsClarification.map((item) => (
              <AttentionCard key={decisionKey(item)} item={item} loop={findLinkedLoop(item, loops)} onUpdate={shareUpdate} busy={busyId === item.record_id} />
            ))}
            {categorized.needsClarification.length === 0 && <p className="followups-empty-inline">No clarification items were returned by the latest assessment.</p>}
          </section>

          <section className="followups-section">
            <div className="followups-section-heading">
              <div><h2>Resolved</h2><p>Items with a closed status in the saved follow-up record.</p></div>
              <span>{categorized.resolved.length}</span>
            </div>
            {categorized.resolved.map((loop) => <LoopHistoryCard key={loop.id} loop={loop} />)}
            {categorized.stopped.length > 0 && (
              <div className="followups-stopped-note"><strong>Stopped, not resolved</strong><p>{categorized.stopped.length} item(s) were stopped. They are not represented as verified outcomes.</p></div>
            )}
            {categorized.resolved.length === 0 && <p className="followups-empty-inline">No closed follow-ups are recorded here.</p>}
          </section>
        </>
      )}
      <style jsx>{`
        .followups-page { max-width: 900px; margin: 0 auto; padding: 24px 18px 64px; color: var(--text, #1f2a22); }
        .followups-header { margin-bottom: 24px; }
        .followups-back { display: inline-flex; align-items: center; gap: 7px; margin-bottom: 22px; color: var(--text-secondary, #536157); text-decoration: none; font-size: 14px; }
        .followups-kicker { display: flex; align-items: center; gap: 7px; color: var(--text-secondary, #657568); font-size: 11px; font-weight: 750; letter-spacing: .12em; }
        .followups-title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-top: 8px; }
        .followups-title-row h1 { margin: 0; font-size: clamp(32px, 6vw, 42px); line-height: 1.1; letter-spacing: -.035em; }
        .followups-title-row p { max-width: 650px; margin: 9px 0 0; color: var(--text-secondary, #5b665d); line-height: 1.6; }
        .followups-refresh { flex: 0 0 auto; width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--border, #d9dfd8); border-radius: 12px; background: var(--surface, #fff); color: var(--text, #1f2a22); }
        .followups-spin { animation: followups-spin 1s linear infinite; }
        @keyframes followups-spin { to { transform: rotate(360deg); } }
        .followups-alert, .followups-notice, .followups-limitation { border-radius: 12px; padding: 12px 14px; font-size: 13px; line-height: 1.5; margin: 0 0 16px; }
        .followups-alert { border: 1px solid #c78d78; background: #fff8f5; color: #713d2b; }
        .followups-notice { border: 1px solid #a8c1a5; background: #f4f8f2; color: #29452d; }
        .followups-limitation { border: 1px solid var(--border, #d9dfd8); background: var(--surface-muted, #f6f8f5); color: var(--text-secondary, #5b665d); }
        .followups-section { display: grid; gap: 12px; margin-top: 28px; }
        .followups-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
        .followups-section-heading h2 { margin: 0; font-size: 20px; }
        .followups-section-heading p { margin: 4px 0 0; color: var(--text-secondary, #647067); font-size: 13px; line-height: 1.45; }
        .followups-section-heading > span { display: grid; place-items: center; min-width: 30px; height: 30px; padding: 0 8px; border-radius: 999px; background: var(--surface-muted, #edf2eb); font-size: 13px; font-weight: 700; }
        .followup-card { border: 1px solid var(--border, #d9dfd8); border-radius: 15px; background: var(--surface, #fff); padding: 16px; display: grid; gap: 10px; }
        .followup-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .followup-eyebrow { margin: 0 0 5px; color: var(--text-secondary, #667269); font-size: 11px; text-transform: uppercase; letter-spacing: .055em; }
        .followup-card h3 { margin: 0; font-size: 17px; line-height: 1.35; }
        .followup-status { flex: 0 0 auto; max-width: 145px; padding: 5px 8px; border-radius: 999px; background: var(--surface-muted, #edf2eb); color: var(--text-secondary, #4f5d51); font-size: 11px; font-weight: 700; text-align: center; }
        .followup-status.is-warning { background: #fff2e9; color: #874b2d; }
        .followup-description { margin: 0; white-space: pre-wrap; line-height: 1.55; font-size: 14px; }
        .followup-meta { display: flex; flex-wrap: wrap; gap: 12px; color: var(--text-secondary, #647067); font-size: 12px; }
        .followup-meta span, .followup-reason { display: inline-flex; align-items: center; gap: 6px; }
        .followup-reason { margin: 0; color: #81502f; font-size: 13px; line-height: 1.45; }
        .followup-muted { margin: 0; color: var(--text-secondary, #647067); font-size: 13px; }
        .followup-detail { border-top: 1px solid var(--border, #e1e5df); padding-top: 10px; display: grid; gap: 8px; }
        .followup-detail p { margin: 0; font-size: 13px; line-height: 1.55; overflow-wrap: anywhere; }
        .followup-card-actions { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .followup-text-button, .followup-secondary-button, .followup-primary-button { min-height: 40px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 9px; padding: 8px 12px; font-size: 13px; font-weight: 650; cursor: pointer; text-decoration: none; }
        .followup-text-button { border: 0; background: transparent; color: var(--text, #263329); }
        .followup-secondary-button { border: 1px solid var(--border, #d9dfd8); background: var(--surface, #fff); color: var(--text, #263329); }
        .followup-primary-button { border: 1px solid #8eae8a; background: #b9d5b5; color: #17251c; }
        .followup-primary-button:disabled { opacity: .55; cursor: not-allowed; }
        .followup-update-area { border-top: 1px solid var(--border, #e1e5df); padding-top: 12px; }
        .followup-update-area form { display: grid; gap: 9px; }
        .followup-update-area label { font-size: 12px; color: var(--text-secondary, #5b665d); line-height: 1.5; }
        .followup-update-area textarea { width: 100%; box-sizing: border-box; border: 1px solid var(--border, #cfd8cf); border-radius: 9px; padding: 10px; background: var(--surface, #fff); color: var(--text, #1f2a22); font: inherit; resize: vertical; }
        .followups-empty, .followups-empty-inline { border: 1px dashed var(--border, #d9dfd8); border-radius: 13px; padding: 20px; color: var(--text-secondary, #647067); line-height: 1.55; }
        .followups-empty { display: grid; justify-items: start; gap: 8px; }
        .followups-empty h2 { margin: 0; color: var(--text, #263329); font-size: 18px; }
        .followups-empty p { margin: 0 0 6px; }
        .followups-empty-inline { margin: 0; font-size: 13px; padding: 14px; }
        .followups-stopped-note { border: 1px solid var(--border, #d9dfd8); border-radius: 12px; padding: 12px 14px; }
        .followups-stopped-note p { margin: 4px 0 0; font-size: 13px; color: var(--text-secondary, #647067); }
        @media (max-width: 560px) {
          .followups-page { padding: 18px 13px 48px; }
          .followup-card { padding: 13px; }
          .followup-card-heading { display: grid; }
          .followup-status { justify-self: start; }
        }
      `}</style>
    </main>
  );
}
