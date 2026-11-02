"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ensureAnonymousSession, getJSON, patchJSON, postJSON } from "@/api/client";

type Claim = {
  id: string;
  person_id: string;
  subject_type: string;
  subject_id: string;
  field: string;
  asserted_value: string;
  assertion_status?: string;
};
type Evidence = { id: string; person_id: string; type: string; source_text: string };
type Question = {
  id: string;
  person_id: string;
  question: string;
  subject_type: string;
  subject_id: string;
  claim_id?: string | null;
  intended_answerer_role?: string | null;
  intended_answerer_label?: string | null;
  necessity: string;
  necessity_rationale?: string | null;
  status: string;
  priority: string;
  evidence_ids?: string[] | null;
  context?: Array<Record<string, unknown>> | null;
  answer?: string | null;
  answer_provenance?: string | null;
  answered_at?: string | null;
  answered_by_caregiver_id?: string | null;
};
type AssessmentItem = { id: string; source: string; title: string; status: string; epistemic_status: string; evidence_ids: string[]; recorded_at?: string | null; occurred_at?: string | null };
type LCRAssessment = { missing_information: AssessmentItem[]; uncertainties_and_conflicts: AssessmentItem[] };
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

const panel: CSSProperties = { border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginTop: 12, background: "var(--surface)" };
const field: CSSProperties = { boxSizing: "border-box", width: "100%", padding: "9px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };
const button: CSSProperties = { border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", background: "var(--surface)", color: "var(--text)", cursor: "pointer" };

function assertScopedRows(rows: unknown, personId: string, label: string): asserts rows is Array<{ id: string; person_id: string }> {
  if (!Array.isArray(rows) || rows.some((value: unknown) => {
    if (!value || typeof value !== "object") return true;
    const row = value as Record<string, unknown>;
    return row.person_id !== personId || typeof row.id !== "string";
  })) {
    throw new Error(`Invalid or cross-record ${label} response`);
  }
}

export default function ClarificationWorkflowPanel({ personId, assessment, assessmentError }: { personId?: string; assessment?: LCRAssessment | null; assessmentError?: string | null }) {
  const [scopePersonId, setScopePersonId] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedClaimId, setSelectedClaimId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [priority, setPriority] = useState("informational");
  const [intendedAnswererRole, setIntendedAnswererRole] = useState("");
  const [intendedAnswererLabel, setIntendedAnswererLabel] = useState("");
  const [necessity, setNecessity] = useState("not_assessed");
  const [necessityRationale, setNecessityRationale] = useState("");
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [answerProvenance, setAnswerProvenance] = useState("");
  const [answerEvidenceIds, setAnswerEvidenceIds] = useState<string[]>([]);
  const [history, setHistory] = useState<AnswerEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedQuestion = questions.find((item) => item.id === selectedQuestionId);
  const selectedClaim = claims.find((item) => item.id === selectedClaimId);
  const priorityRank = (value: string) => ({ critical: 0, high: 1, medium: 2, low: 3, informational: 4 }[value.toLowerCase()] ?? 5);
  const openQuestions = questions.filter((item) => ["open", "unresolved"].includes(item.status)).sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
  const answeredQuestions = questions.filter((item) => ["answered", "declined", "closed"].includes(item.status));
  const questionReason = (item: Question) => {
    const context = (item.context ?? []).filter((entry) => entry && typeof entry === "object");
    const linked = context.find((entry) => typeof entry.reason === "string" || typeof entry.purpose === "string");
    return typeof linked?.reason === "string" ? linked.reason : typeof linked?.purpose === "string" ? linked.purpose : item.necessity_rationale || "The saved question is linked to a care-record subject; a more specific reason was not returned.";
  };
  const questionStatusLabel = (status: string) => status === "answered"
    ? "Answer recorded — review outcome not exposed by the current API"
    : status === "declined" ? "Declined with recorded reason"
      : status === "closed" ? "Closed"
        : status === "unresolved" ? "Needs follow-up" : "Open";

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      const sessionPersonId = session.person?.id;
      if (!sessionPersonId || (personId && personId !== sessionPersonId)) {
        throw new Error("Authenticated care-record scope mismatch");
      }
      const [claimRows, questionRows, evidenceRows] = await Promise.all([
        getJSON(`/care-continuity/assertions/${encodeURIComponent(sessionPersonId)}?limit=100`),
        getJSON(`/uncertainty/questions/${encodeURIComponent(sessionPersonId)}`),
        getJSON("/care-continuity/evidence?limit=100"),
      ]);
      assertScopedRows(claimRows, sessionPersonId, "claims");
      assertScopedRows(questionRows, sessionPersonId, "questions");
      assertScopedRows(evidenceRows, sessionPersonId, "evidence");
      setScopePersonId(sessionPersonId);
      setClaims(claimRows as Claim[]);
      setQuestions(questionRows as Question[]);
      setEvidence(evidenceRows as Evidence[]);
      setSelectedClaimId((current) => current && claimRows.some((row) => row.id === current) ? current : claimRows[0]?.id ?? "");
      setSelectedQuestionId((current) => current && questionRows.some((row) => row.id === current) ? current : questionRows[0]?.id ?? "");
    } catch {
      setScopePersonId("");
      setClaims([]);
      setQuestions([]);
      setEvidence([]);
      setSelectedClaimId("");
      setSelectedQuestionId("");
      setError("Claims, clarification questions, or evidence could not be loaded from the authenticated care record. A failed read is not treated as an empty record.");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => { void loadAll(); }, [loadAll]);

  const loadHistory = useCallback(async () => {
    if (!selectedQuestionId || !scopePersonId) {
      setHistory([]);
      setHistoryError("");
      return;
    }
    setHistoryError("");
    try {
      const rows = await getJSON(`/uncertainty/questions/${encodeURIComponent(selectedQuestionId)}/answer-history`);
      if (!Array.isArray(rows) || rows.some((row) =>
        row?.question_id !== selectedQuestionId || row?.person_id !== scopePersonId)) {
        throw new Error("Invalid or cross-record answer history");
      }
      setHistory(rows as AnswerEvent[]);
    } catch {
      setHistory([]);
      setHistoryError("Answer history is unavailable. A failed request is not an empty history.");
    }
  }, [scopePersonId, selectedQuestionId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function createQuestion() {
    if (!scopePersonId || !selectedClaim || questionText.trim().length < 5) {
      setError("Select a source-attributed claim and enter a specific clarification question.");
      return;
    }
    if (necessity !== "not_assessed" && necessityRationale.trim().length < 3) {
      setError("A necessary/optional assessment requires a rationale; leave necessity unassessed if you cannot justify it.");
      return;
    }
    if (intendedAnswererLabel.trim() && (!intendedAnswererRole || intendedAnswererRole === "not_known")) {
      setError("A named answerer label requires a compatible, explicitly selected answerer role.");
      return;
    }
    if (evidenceIds.some((id) => !evidence.some((row) => row.id === id && row.person_id === scopePersonId))) {
      setError("Every linked evidence item must belong to this authenticated care record.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const created = await postJSON("/uncertainty/questions", {
        person_id: scopePersonId,
        question: questionText.trim(),
        subject_type: selectedClaim.subject_type,
        subject_id: selectedClaim.subject_id,
        claim_id: selectedClaim.id,
        intended_answerer_role: intendedAnswererRole || null,
        intended_answerer_label: intendedAnswererLabel.trim() || null,
        necessity,
        necessity_rationale: necessityRationale.trim() || null,
        status: "open",
        priority,
        evidence_ids: evidenceIds,
        context: [{
          kind: "claim_clarification",
          claim_id: selectedClaim.id,
          claim_field: selectedClaim.field,
          claim_text: selectedClaim.asserted_value,
          purpose: "Resolve a declared evidence gap; the question itself does not establish the claim.",
        }],
      });
      if (!created || created.person_id !== scopePersonId || typeof created.id !== "string") {
        throw new Error("Question create response not confirmed");
      }
      setQuestionText("");
      setNotice("Clarification question saved with its claim context and selected evidence references.");
      await loadAll();
      setSelectedQuestionId(created.id);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      if (message.toLowerCase().includes("equivalent open clarification question already exists")) {
        setError("An equivalent open question already exists for this claim and subject. Select the existing question and review its answer history before asking again.");
      } else {
        setError("Question persistence was not confirmed. No successful creation is assumed.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateQuestion(status: "answered" | "open" | "declined") {
    if (!selectedQuestion || !scopePersonId) return;
    if (status === "answered" && (answer.trim().length < 2 || answerProvenance.trim().length < 3)) {
      setError("An answer requires the answer text and an explicit source/provenance description.");
      return;
    }
    if (status === "answered" && answerEvidenceIds.length === 0) {
      setError("Select at least one persisted evidence record that supports this answer. Typed text alone cannot answer the question.");
      return;
    }
    if (status === "answered" && answerEvidenceIds.some((id) => !evidence.some((row) => row.id === id && row.person_id === scopePersonId))) {
      setError("Every answer evidence reference must belong to this authenticated care record.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const payload: Record<string, unknown> = { status };
      if (status === "answered") {
        payload.answer = answer.trim();
        payload.answer_provenance = answerProvenance.trim();
        payload.evidence_ids = answerEvidenceIds;
      }
      if (status === "declined") {
        payload.closed_reason = answerProvenance.trim();
      }
      const updated = await patchJSON(`/uncertainty/questions/${encodeURIComponent(selectedQuestion.id)}`, payload);
      if (!updated || updated.id !== selectedQuestion.id || updated.person_id !== scopePersonId || updated.status !== status) {
        throw new Error("Question transition response not confirmed");
      }
      setNotice(status === "answered"
        ? "Answer saved with session-attributed identity and immutable answer history."
        : status === "open" ? "Question reopened; previous answer history is preserved." : "Decline saved with its recorded reason.");
      if (status === "answered") { setAnswer(""); setAnswerProvenance(""); setAnswerEvidenceIds([]); }
      await loadAll();
      await loadHistory();
    } catch {
      setError("Question transition persistence was not confirmed. The current status must not be assumed to have changed.");
    } finally {
      setSaving(false);
    }
  }

  return <section style={panel} aria-label="Evidence-grounded clarification workflow">
    <h3 style={{ fontSize: 18, marginTop: 0 }}>What We Still Need to Understand</h3>
    <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
      Important gaps and unanswered questions are shown first. An answer is a caregiver report, not an automatically verified care fact. Original answers and their attributed history are retained.
    </p>
    <div style={{ margin: "12px 0", padding: 10, border: "1px solid var(--border)", borderRadius: 8 }}>
      <strong style={{ fontSize: 13 }}>Uncertain or incomplete information</strong>
      {assessmentError ? <p role="alert">The situation assessment could not be retrieved. The record cannot be treated as complete. {assessmentError}</p>
        : !assessment ? <p role="status">No persisted situation assessment is available. Reassess the record before treating this section as complete.</p>
          : <>
            {assessment.missing_information.length > 0 && <div><strong>Missing information</strong><ul>{assessment.missing_information.slice(0, 8).map((item) => <li key={item.source + ":" + item.id}>{item.title} — {item.status.replaceAll("_", " ")} · {item.epistemic_status.replaceAll("_", " ")}<small style={{ display: "block" }}>Source: {item.source.replaceAll("_", " ")} · Evidence references: {item.evidence_ids.length ? item.evidence_ids.join(", ") : "none returned"}</small></li>)}</ul></div>}
            {assessment.uncertainties_and_conflicts.length > 0 && <div><strong>Uncertain or conflicting information</strong><ul>{assessment.uncertainties_and_conflicts.slice(0, 8).map((item) => <li key={item.source + ":" + item.id}>{item.title} — {item.status.replaceAll("_", " ")} · {item.epistemic_status.replaceAll("_", " ")}<small style={{ display: "block" }}>Source: {item.source.replaceAll("_", " ")} · Evidence references: {item.evidence_ids.length ? item.evidence_ids.join(", ") : "none returned"}</small></li>)}</ul></div>}
            {assessment.missing_information.length === 0 && assessment.uncertainties_and_conflicts.length === 0 && <p>No missing-information or unresolved-uncertainty items were returned by the saved assessment.</p>}
          </>}
    </div>
    {loading && <p role="status">Loading persisted claims, questions, and evidence…</p>}
    {error && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{error} <button type="button" style={button} onClick={() => void loadAll()} disabled={loading}>Retry load</button></p>}
    {!loading && !error && <>
      <div style={{ margin: "12px 0" }}>
        <strong style={{ fontSize: 13 }}>Important unanswered questions</strong>
        {openQuestions.length === 0
          ? assessment && assessment.missing_information.length === 0 && assessment.uncertainties_and_conflicts.length === 0
            ? <p>No important unanswered questions identified from the available record.</p>
            : <p>No persisted open clarification questions were returned. Review the information gaps above; an assessment gap without a linked question is not treated as resolved.</p>
          : <>
            <ul style={{ paddingLeft: 18 }}>{openQuestions.slice(0, 5).map((item) => <li key={item.id} style={{ marginBottom: 10 }}>
              <strong>{item.question}</strong>
              <p style={{ margin: "4px 0" }}>Why it matters: {questionReason(item)}</p>
              <small>{item.priority.replaceAll("_", " ")} · {item.subject_type.replaceAll("_", " ")} · {questionStatusLabel(item.status)}</small>
              <div><button type="button" style={button} onClick={() => { setSelectedQuestionId(item.id); setError(""); setAnswer(""); setAnswerProvenance(""); setAnswerEvidenceIds([]); }}>Open and respond</button></div>
            </li>)}</ul>
            {openQuestions.length > 5 && <details><summary>More outstanding questions ({openQuestions.length - 5})</summary><ul>{openQuestions.slice(5).map((item) => <li key={item.id}>{item.question} — {item.priority} <button type="button" style={button} onClick={() => setSelectedQuestionId(item.id)}>Open</button></li>)}</ul></details>}
          </>}
      </div>
      {claims.length > 0 && <details style={{ marginBottom: 12 }}><summary>Create a targeted clarification question (only when a source-linked gap requires one)</summary><fieldset style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 10, minWidth: 0 }}>
        <legend style={{ fontSize: 12 }}>Create a targeted clarification</legend>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Claim
          <select style={field} value={selectedClaimId} onChange={(event) => setSelectedClaimId(event.target.value)}>
            {claims.map((claim) => <option key={claim.id} value={claim.id}>{claim.field}: {claim.asserted_value.slice(0, 100)}</option>)}
          </select>
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Question
          <textarea style={{ ...field, minHeight: 65 }} value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder="What specific missing detail needs clarification?" />
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Priority
          <select style={field} value={priority} onChange={(event) => setPriority(event.target.value)}>
            {["informational", "low", "medium", "high", "critical"].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Intended answerer
          <select style={field} value={intendedAnswererRole} onChange={(event) => setIntendedAnswererRole(event.target.value)}>
            <option value="">Not assessed</option>
            {["person_receiving_care", "reporting_caregiver", "other_caregiver", "professional", "not_known"].map((value) =>
              <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Answerer label (optional, only when known)
          <input style={field} value={intendedAnswererLabel} onChange={(event) => setIntendedAnswererLabel(event.target.value)} disabled={!intendedAnswererRole || intendedAnswererRole === "not_known"} placeholder="Name/role stated by the caregiver" />
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Is this clarification necessary?
          <select style={field} value={necessity} onChange={(event) => setNecessity(event.target.value)}>
            <option value="not_assessed">Not assessed</option>
            <option value="necessary">Necessary</option>
            <option value="optional">Optional</option>
          </select>
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Necessity rationale
          <textarea style={{ ...field, minHeight: 55 }} value={necessityRationale} onChange={(event) => setNecessityRationale(event.target.value)} placeholder="Required when necessary/optional is selected" />
        </label>
        <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Related evidence (multi-select)
          <select multiple style={{ ...field, minHeight: 86 }} value={evidenceIds} onChange={(event) => setEvidenceIds(Array.from(event.target.selectedOptions, (option) => option.value))}>
            {evidence.map((item) => <option key={item.id} value={item.id}>{item.type} · {item.id} · {item.source_text.slice(0, 65)}</option>)}
          </select>
        </label>
        <button type="button" style={button} onClick={() => void createQuestion()} disabled={saving || !selectedClaim}>
          {saving ? "Saving…" : "Create clarification question"}
        </button>
      </fieldset></details>}
      {claims.length === 0 && <p>No source-attributed claims were returned. Existing questions can still be reviewed, but a new claim-linked question cannot be created until a claim exists.</p>}
      <div style={{ marginTop: 14 }}>
        <strong style={{ fontSize: 13 }}>All persisted questions</strong>
        {questions.length === 0 && <p style={{ fontSize: 12 }}>No clarification questions were returned for this care record.</p>}
        {questions.length > 0 && <>
          <label style={{ display: "block", fontSize: 12, margin: "8px 0" }}>Question
            <select
              style={field}
              value={selectedQuestionId}
              onChange={(event) => {
                setSelectedQuestionId(event.target.value);
                setAnswerEvidenceIds([]);
                setAnswer("");
                setAnswerProvenance("");
                setError("");
              }}
            >
              {questions.map((item) => <option key={item.id} value={item.id}>{item.status} · {item.question.slice(0, 120)}</option>)}
            </select>
          </label>
          {selectedQuestion && <div style={{ fontSize: 12, border: "1px solid var(--border)", borderRadius: 7, padding: 10 }}>
            <p><strong>Subject:</strong> {selectedQuestion.subject_type} / {selectedQuestion.subject_id} · <strong>Priority:</strong> {selectedQuestion.priority} · <strong>Status:</strong> {questionStatusLabel(selectedQuestion.status)}</p>
            <p><strong>Why this question was raised:</strong> {questionReason(selectedQuestion)}</p>
            <p><strong>Linked claim:</strong> {selectedQuestion.claim_id || "Legacy question without a normalized claim link"}</p>
            <p><strong>Intended answerer:</strong> {selectedQuestion.intended_answerer_role || "Not recorded"}{selectedQuestion.intended_answerer_label ? ` · ${selectedQuestion.intended_answerer_label}` : ""}</p>
            <p><strong>Necessity:</strong> {selectedQuestion.necessity.replaceAll("_", " ")}{selectedQuestion.necessity_rationale ? ` · ${selectedQuestion.necessity_rationale}` : ""}</p>
            <p>{selectedQuestion.question}</p>
            <p><strong>Evidence IDs:</strong> {selectedQuestion.evidence_ids?.length ? selectedQuestion.evidence_ids.join(", ") : "None linked"}</p>
            {selectedQuestion.answer && <p><strong>Current answer:</strong> {selectedQuestion.answer}<br />Source: {selectedQuestion.answer_provenance || "Not recorded"}<br />Answered by: {selectedQuestion.answered_by_caregiver_id || "Legacy answer without recorded actor"}</p>}
            {selectedQuestion.status !== "answered" && <>
              <label style={{ display: "block", marginBottom: 8 }}>Answer
                <textarea style={{ ...field, minHeight: 65 }} value={answer} onChange={(event) => setAnswer(event.target.value)} />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>Answer source / provenance
                <textarea style={{ ...field, minHeight: 55 }} value={answerProvenance} onChange={(event) => setAnswerProvenance(event.target.value)} placeholder="Who answered, and what source or firsthand knowledge supports it?" />
              </label>
              <label style={{ display: "block", marginBottom: 8 }}>Persisted evidence supporting this answer (required)
                <select
                  multiple
                  style={{ ...field, minHeight: 86 }}
                  value={answerEvidenceIds}
                  onChange={(event) => setAnswerEvidenceIds(Array.from(event.target.selectedOptions, (option) => option.value))}
                >
                  {evidence.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.type} · {item.id} · {item.source_text.slice(0, 65)}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" style={button} onClick={() => void updateQuestion("answered")} disabled={saving || answerEvidenceIds.length === 0}>Record answer</button>{" "}
              <button type="button" style={button} onClick={() => void updateQuestion("declined")} disabled={saving}>Decline (use provenance field for reason)</button>
            </>}
            {selectedQuestion.status !== "open" && <button type="button" style={button} onClick={() => void updateQuestion("open")} disabled={saving}>Reopen without deleting prior answers</button>}
          </div>}
          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 13 }}>Immutable answer history</strong>
            {historyError && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{historyError}</p>}
            {!historyError && history.length === 0 && <p style={{ fontSize: 12 }}>No answer events are recorded yet.</p>}
            <ol style={{ fontSize: 12, paddingLeft: 18 }}>
              {history.map((item) => <li key={item.id}>
                <p>{item.answer}</p><p>Source: {item.answer_provenance}</p>
                <p>Answer version {item.answer_version} · Evidence IDs: {item.evidence_ids.length ? item.evidence_ids.join(", ") : "not recorded"}</p>
                <p>Answered by {item.answered_by_caregiver_id} · {item.created_at}</p>
              </li>)}
            </ol>
          </div>
        </>}
      </div>
      {answeredQuestions.length > 0 && <details style={{ marginTop: 14 }}><summary>Resolved or answered question history ({answeredQuestions.length})</summary><ul>{answeredQuestions.map((item) => <li key={item.id} style={{ marginBottom: 8 }}><strong>{item.question}</strong><p>{questionStatusLabel(item.status)}</p>{item.answer && <p>Recorded answer: {item.answer}</p>}{item.answer_provenance && <small>Source: {item.answer_provenance}</small>}{item.answered_at && <small style={{ display: "block" }}>Submitted: {item.answered_at}</small>}<small style={{ display: "block" }}>The current API does not expose an acceptance/rejection reconciliation decision for this answer; it is not presented as verified.</small></li>)}</ul></details>}
    </>}
    {notice && <p role="status" style={{ fontSize: 12 }}>{notice}</p>}
  </section>;
}
