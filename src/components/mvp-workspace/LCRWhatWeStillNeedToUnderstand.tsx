"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ensureAnonymousSession, getJSON, patchJSON } from "@/api/client";

type Question = {
  id: string;
  person_id: string;
  question: string;
  subject_type: string;
  subject_id: string;
  claim_id?: string | null;
  necessity?: string;
  necessity_rationale?: string | null;
  status: string;
  priority: string;
  evidence_ids?: string[] | null;
  context?: Array<Record<string, unknown>> | null;
  answer?: string | null;
  answer_provenance?: string | null;
  answered_at?: string | null;
  answered_by_caregiver_id?: string | null;
  asked_at?: string | null;
  closed_reason?: string | null;
};

type InformationGap = {
  id: string;
  person_id: string;
  subject_type: string;
  subject_id: string;
  field: string;
  epistemic_state: string;
  gap_reason: string;
  priority: string;
  lifecycle_status: string;
  description?: string | null;
  evidence_ids?: string[] | null;
  context?: Array<Record<string, unknown>> | null;
  created_at?: string | null;
  resolution_date?: string | null;
  resolution_notes?: string | null;
};

type Contradiction = {
  id: string;
  person_id: string;
  subject_type: string;
  subject_id: string;
  field: string;
  description: string;
  resolution_status: string;
  evidence_ids?: string[] | null;
  resolution_notes?: string | null;
  resolution_scope?: string | null;
  unresolved_remainder?: string | null;
  resolved_at?: string | null;
};

type UncertaintyAssessment = {
  id: string;
  person_id: string;
  subject_type: string;
  subject_id: string;
  field: string;
  epistemic_state: string;
  gap_reason?: string | null;
  context?: Array<Record<string, unknown>> | null;
  evidence_ids?: string[] | null;
  assessed_at?: string | null;
  is_active?: boolean;
};

type Evidence = {
  id: string;
  person_id: string;
  type: string;
  source_text: string;
};

type AnswerEvent = {
  id: string;
  question_id: string;
  person_id: string;
  answer: string;
  answer_provenance: string;
  evidence_ids: string[];
  answer_version: number;
  answered_by_caregiver_id: string;
  created_at: string;
};

const priorityRank: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  informational: 4,
};

function priorityLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function contextReason(question: Question): string {
  const context = question.context ?? [];
  const reason = context.find((item) => typeof item.reason === "string" && item.reason.trim());
  if (typeof reason?.reason === "string") return reason.reason;
  const purpose = context.find((item) => typeof item.purpose === "string" && item.purpose.trim());
  if (typeof purpose?.purpose === "string") return purpose.purpose;
  if (question.necessity_rationale?.trim()) return question.necessity_rationale;
  return "This question is linked to an existing care-record subject. The original assessment rationale was not included in the returned question.";
}

function contextAssessment(question: Question): string | null {
  const item = (question.context ?? []).find((value) => typeof value.assessment_id === "string");
  return typeof item?.assessment_id === "string" ? item.assessment_id : null;
}

function isResolved(question: Question): boolean {
  return ["answered", "declined", "closed"].includes(question.status);
}

function formatWhen(value?: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function scopedRows<T extends { id: string; person_id: string }>(value: unknown, personId: string, label: string): T[] {
  if (!Array.isArray(value) || value.some((row) =>
    !row || typeof row !== "object" || row.person_id !== personId || typeof row.id !== "string"
  )) {
    throw new Error(`The ${label} response did not match the active care-record scope.`);
  }
  return value as T[];
}

export default function LCRWhatWeStillNeedToUnderstand({ personId }: { personId: string }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [gaps, setGaps] = useState<InformationGap[]>([]);
  const [contradictions, setContradictions] = useState<Contradiction[]>([]);
  const [assessments, setAssessments] = useState<UncertaintyAssessment[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [questionError, setQuestionError] = useState("");
  const [sourceErrors, setSourceErrors] = useState<string[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [answer, setAnswer] = useState("");
  const [provenance, setProvenance] = useState("");
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [history, setHistory] = useState<AnswerEvent[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [historyQuestionId, setHistoryQuestionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setQuestionError("");
    setSourceErrors([]);
    try {
      const session = await ensureAnonymousSession();
      const activePersonId = session.person?.id;
      if (!session.access_token || !activePersonId || activePersonId !== personId) {
        throw new Error("The active care-record session does not match this LCR.");
      }
      const errors: string[] = [];
      const [questionResult, gapResult, contradictionResult, assessmentResult, evidenceResult] = await Promise.allSettled([
        getJSON(`/uncertainty/questions/${encodeURIComponent(activePersonId)}`),
        getJSON(`/uncertainty/gaps/${encodeURIComponent(activePersonId)}`),
        getJSON(`/uncertainty/contradictions/${encodeURIComponent(activePersonId)}`),
        getJSON(`/uncertainty/assessments/${encodeURIComponent(activePersonId)}`),
        getJSON("/care-continuity/evidence?limit=100"),
      ]);

      if (questionResult.status === "rejected") {
        throw new Error("Clarification questions could not be retrieved from the authenticated care record.");
      }
      setQuestions(scopedRows<Question>(questionResult.value, activePersonId, "clarification questions"));
      if (gapResult.status === "fulfilled") setGaps(scopedRows<InformationGap>(gapResult.value, activePersonId, "information gaps"));
      else { setGaps([]); errors.push("Persisted information gaps are temporarily unavailable."); }
      if (contradictionResult.status === "fulfilled") setContradictions(scopedRows<Contradiction>(contradictionResult.value, activePersonId, "conflicts"));
      else { setContradictions([]); errors.push("Conflict records are temporarily unavailable."); }
      if (assessmentResult.status === "fulfilled") setAssessments(scopedRows<UncertaintyAssessment>(assessmentResult.value, activePersonId, "uncertainty assessments"));
      else { setAssessments([]); errors.push("Uncertainty assessment history is temporarily unavailable."); }
      if (evidenceResult.status === "fulfilled") setEvidence(scopedRows<Evidence>(evidenceResult.value, activePersonId, "supporting evidence"));
      else { setEvidence([]); errors.push("Existing captured evidence could not be loaded. Submit an answer after refreshing the evidence list."); }
      setSourceErrors(errors);
    } catch (cause) {
      setQuestions([]);
      setGaps([]);
      setContradictions([]);
      setAssessments([]);
      setEvidence([]);
      setQuestionError(cause instanceof Error ? cause.message : "Clarification records are unavailable.");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => { void load(); }, [load]);

  const openQuestions = useMemo(
    () => questions.filter((item) => !isResolved(item)).sort((a, b) =>
      (priorityRank[a.priority] ?? 5) - (priorityRank[b.priority] ?? 5) ||
      new Date(a.asked_at ?? 0).getTime() - new Date(b.asked_at ?? 0).getTime()
    ),
    [questions],
  );
  const resolvedQuestions = useMemo(
    () => questions.filter(isResolved).sort((a, b) =>
      new Date(b.answered_at ?? b.asked_at ?? 0).getTime() - new Date(a.answered_at ?? a.asked_at ?? 0).getTime()
    ),
    [questions],
  );

  async function submitAnswer(question: Question) {
    if (!answer.trim() || !provenance.trim()) {
      setActionError("Enter the answer and identify its source or basis.");
      return;
    }
    if (!evidenceIds.length) {
      setActionError("Link at least one persisted evidence record. If the answer has not been captured yet, use the existing Add Record or document-capture workflow first, then refresh this section.");
      return;
    }
    if (evidenceIds.some((id) => !evidence.some((item) => item.id === id && item.person_id === personId))) {
      setActionError("Selected evidence does not belong to the active care record.");
      return;
    }
    setSaving(true);
    setActionError("");
    setNotice("");
    try {
      const updated = await patchJSON(`/uncertainty/questions/${encodeURIComponent(question.id)}`, {
        status: "answered",
        answer: answer.trim(),
        answer_provenance: provenance.trim(),
        evidence_ids: evidenceIds,
      });
      if (!updated || updated.id !== question.id || updated.person_id !== personId || updated.status !== "answered") {
        throw new Error("The server did not confirm the answer transition.");
      }
      setAnswer("");
      setProvenance("");
      setEvidenceIds([]);
      setSelectedQuestionId("");
      setNotice("Answer submitted and retained with its source attribution. It is not treated as verified care information until the relevant evidence and claim are reviewed.");
      await load();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The answer could not be saved. No successful submission is assumed.");
    } finally {
      setSaving(false);
    }
  }

  async function showHistory(question: Question) {
    setHistoryQuestionId(question.id);
    setHistoryError("");
    setHistory([]);
    try {
      const rows = await getJSON(`/uncertainty/questions/${encodeURIComponent(question.id)}/answer-history`);
      if (!Array.isArray(rows) || rows.some((row) => row?.question_id !== question.id || row?.person_id !== personId)) {
        throw new Error("Answer history did not match the selected question and care record.");
      }
      setHistory(rows as AnswerEvent[]);
    } catch (cause) {
      setHistoryError(cause instanceof Error ? cause.message : "Answer history is unavailable.");
    }
  }

  return (
    <section className="lcr-situation-assessment" aria-labelledby="lcr-understanding-gaps-heading">
      <div className="lcr-entry-heading">
        <div>
          <h3 id="lcr-understanding-gaps-heading">What We Still Need to Understand</h3>
          <p>Important gaps and unresolved questions from this care record. An answer adds evidence for review; it does not automatically establish a fact.</p>
        </div>
        <button type="button" className="lcr-text-action" onClick={() => void load()} disabled={loading || saving}>Refresh</button>
      </div>

      {loading && <p role="status">Loading persisted clarification and uncertainty records…</p>}
      {questionError && <div role="alert"><p>{questionError}</p><button type="button" className="lcr-text-action" onClick={() => void load()}>Retry</button></div>}
      {!loading && !questionError && <>
        {sourceErrors.map((message) => <p role="status" key={message}>{message}</p>)}

        <section aria-labelledby="lcr-unanswered-heading">
          <h4 id="lcr-unanswered-heading">Important unanswered questions</h4>
          {openQuestions.length === 0 ? (
            <p>No important unanswered questions identified from the available record.</p>
          ) : (
            <ol className="lcr-current-facts">
              {openQuestions.slice(0, 5).map((question) => {
                const assessmentId = contextAssessment(question);
                return (
                  <li className="lcr-current-fact" key={question.id}>
                    <div className="lcr-entry-heading">
                      <strong>{question.question}</strong>
                      <span>{priorityLabel(question.priority)} · {question.status.replaceAll("_", " ")}</span>
                    </div>
                    <p>{contextReason(question)}</p>
                    <small>Related record: {question.subject_type.replaceAll("_", " ")} · {question.subject_id}</small>
                    <small>Source uncertainty: {assessmentId ? `assessment ${assessmentId}` : question.claim_id ? `claim ${question.claim_id}` : "linked care-record context"}</small>
                    <small>Asked: {formatWhen(question.asked_at)} · {question.necessity === "necessary" ? "Marked necessary" : question.necessity === "optional" ? "Optional clarification" : "Necessity not assessed"}</small>
                    <button type="button" className="lcr-text-action" onClick={() => { setSelectedQuestionId(question.id); setActionError(""); setNotice(""); }}>
                      {selectedQuestionId === question.id ? "Hide answer form" : "Answer this question"}
                    </button>
                    {selectedQuestionId === question.id && (
                      <div className="lcr-current-fact">
                        <label>Answer in your own words
                          <textarea rows={3} maxLength={12000} value={answer} onChange={(event) => setAnswer(event.target.value)} />
                        </label>
                        <label>Who provided this information, and what is it based on?
                          <textarea rows={2} maxLength={4000} value={provenance} onChange={(event) => setProvenance(event.target.value)} placeholder="For example: I observed this directly, or the clinic letter dated…" />
                        </label>
                        <label>Supporting evidence already captured
                          <select multiple value={evidenceIds} onChange={(event) => setEvidenceIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
                            {evidence.map((item) => <option key={item.id} value={item.id}>{item.type} · {item.source_text.slice(0, 100)}</option>)}
                          </select>
                        </label>
                        <small>If the supporting information is not in the record yet, first use Add Record or the existing document-capture workflow. Then refresh this section and link the saved evidence.</small>
                        {actionError && <p role="alert">{actionError}</p>}
                        <button type="button" className="lcr-text-action" disabled={saving} onClick={() => void submitAnswer(question)}>{saving ? "Submitting…" : "Submit answer for review"}</button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {openQuestions.length > 5 && <details><summary>Other outstanding questions ({openQuestions.length - 5})</summary><ul>{openQuestions.slice(5).map((item) => <li key={item.id}>{item.question} · {priorityLabel(item.priority)}</li>)}</ul></details>}
        </section>

        <section aria-labelledby="lcr-uncertain-information-heading">
          <h4 id="lcr-uncertain-information-heading">Uncertain or incomplete information</h4>
          {gaps.length === 0 && contradictions.length === 0 && assessments.filter((item) => item.is_active !== false && item.epistemic_state !== "known").length === 0 ? (
            <p>No persisted uncertainty or information-gap records were returned. This is not a claim that the entire care record is complete.</p>
          ) : (
            <ul className="lcr-current-facts">
              {gaps.filter((item) => !["resolved", "closed"].includes(item.lifecycle_status)).map((gap) => (
                <li className="lcr-current-fact" key={gap.id}>
                  <strong>{gap.field.replaceAll("_", " ")} — {gap.epistemic_state.replaceAll("_", " ")}</strong>
                  <p>{gap.description || gap.gap_reason.replaceAll("_", " ")}</p>
                  <small>Missing information · {gap.priority.replaceAll("_", " ")} · {gap.subject_type.replaceAll("_", " ")} / {gap.subject_id}</small>
                  <small>Gap record: {gap.id} · Evidence references: {gap.evidence_ids?.length ? gap.evidence_ids.join(", ") : "None linked"}</small>
                </li>
              ))}
              {contradictions.filter((item) => item.resolution_status !== "resolved").map((conflict) => (
                <li className="lcr-current-fact" key={conflict.id}>
                  <strong>{conflict.field.replaceAll("_", " ")} — conflicting information</strong>
                  <p>{conflict.description}</p>
                  {conflict.unresolved_remainder && <p>Still unresolved: {conflict.unresolved_remainder}</p>}
                  <small>Conflict · {conflict.subject_type.replaceAll("_", " ")} / {conflict.subject_id} · {conflict.resolution_status.replaceAll("_", " ")}</small>
                  <small>Evidence references: {conflict.evidence_ids?.length ? conflict.evidence_ids.join(", ") : "None linked"}</small>
                </li>
              ))}
              {assessments.filter((item) => item.is_active !== false && item.epistemic_state !== "known").map((item) => (
                <li className="lcr-current-fact" key={item.id}>
                  <strong>{item.field.replaceAll("_", " ")} — {item.epistemic_state.replaceAll("_", " ")}</strong>
                  <p>{item.gap_reason ? item.gap_reason.replaceAll("_", " ") : "The available assessment did not establish this information."}</p>
                  <small>Uncertainty assessment · {item.subject_type.replaceAll("_", " ")} / {item.subject_id} · Assessed {formatWhen(item.assessed_at)}</small>
                  <small>Assessment: {item.id} · Evidence references: {item.evidence_ids?.length ? item.evidence_ids.join(", ") : "None linked"}</small>
                </li>
              ))}
            </ul>
          )}
          <p className="lcr-footer-note">Missing, uncertain and conflicting information remain separate states. Absence of a record is not evidence that an event did not occur.</p>
        </section>

        <section aria-labelledby="lcr-resolved-questions-heading">
          <h4 id="lcr-resolved-questions-heading">Submitted answers, closures and history</h4>
          {resolvedQuestions.length === 0 ? <p>No submitted answers or closed clarification questions are recorded yet.</p> : (
            <ul className="lcr-current-facts">
              {resolvedQuestions.map((question) => (
                <li className="lcr-current-fact" key={question.id}>
                  <strong>{question.question}</strong>
                  <p>{question.answer || question.closed_reason || "No answer or closure reason was retained on the question record."}</p>
                  <small>Status: {question.status.replaceAll("_", " ")} · Answered: {formatWhen(question.answered_at)}</small>
                  <small>Provided by caregiver: {question.answered_by_caregiver_id || "Actor not recorded on this legacy question"}</small>
                  <button type="button" className="lcr-text-action" onClick={() => void showHistory(question)}>View immutable answer history</button>
                  {historyQuestionId === question.id && (
                    <div>
                      {historyError && <p role="alert">{historyError}</p>}
                      {!historyError && history.length === 0 && <p>No append-only answer events were returned for this question.</p>}
                      <ol>{history.map((event) => <li key={event.id}>
                        <p>{event.answer}</p>
                        <small>Version {event.answer_version} · {formatWhen(event.created_at)} · caregiver {event.answered_by_caregiver_id}</small>
                        <small>Source: {event.answer_provenance}</small>
                        <small>Evidence: {event.evidence_ids.length ? event.evidence_ids.join(", ") : "None linked"}</small>
                      </li>)}</ol>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </>}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
