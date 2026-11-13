"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ensureAnonymousSession, getJSON, patchJSON, postJSON } from "@/api/client";
import { caregiverInformationLabel, caregiverSafeAssistantText, caregiverStatusLabel } from "@/lib/caregiver-language";

type Claim = {
  id: string;
  person_id: string;
  subject_type: string;
  subject_id: string;
  field: string;
  asserted_value: string;
  epistemic_state?: string;
  assertion_status?: string;
  assertion_kind?: string;
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
type ReviewEvent = {
  id: string;
  question_id: string;
  person_id: string;
  answer_version: number;
  decision: "accepted" | "rejected" | "needs_clarification" | string;
  resulting_claim_id?: string | null;
  care_continuity_execution?: { stages?: Record<string, string> } | null;
};

const panel: CSSProperties = { border: "1px solid var(--border)", borderRadius: 10, padding: 14, marginTop: 12, background: "var(--surface)" };
const field: CSSProperties = { boxSizing: "border-box", width: "100%", padding: "9px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" };
const button: CSSProperties = { border: "1px solid var(--border)", borderRadius: 7, padding: "8px 11px", background: "var(--surface)", color: "var(--text)", cursor: "pointer" };

function questionStatusLabel(status: string, hasLinkedClaim = true): string {
  switch (status) {
    case "open": return "Waiting for an answer";
    case "answered": return hasLinkedClaim ? "Answered — review needed" : "Answer saved";
    case "declined": return "No answer provided";
    case "closed": return "Closed";
    case "unresolved": return "Still unclear";
    default: return "Needs review";
  }
}

function answererLabel(role?: string | null): string {
  const labels: Record<string, string> = {
    person_receiving_care: "Person receiving care",
    reporting_caregiver: "Caregiver who shared the report",
    other_caregiver: "Another caregiver",
    professional: "Care professional",
    not_known: "Not known",
  };
  return role ? labels[role] || "Not recorded" : "Not recorded";
}

function displayDate(value?: string | null): string {
  if (!value) return "Date not recorded";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Date not recorded" : date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}

function evidenceSummary(item: Evidence): string {
  const raw = (item.source_text || "").trim();
  if (!raw) return "Saved care information";
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const content = parsed.original_capture ?? parsed.original_notes ?? parsed.notes ?? parsed.description ?? parsed.text;
    if (typeof content === "string") return caregiverSafeAssistantText(content.slice(0, 100)) || "Saved care information";
    if (content && typeof content === "object" && !Array.isArray(content)) {
      return "Saved care information";
    }
    return "Saved care information";
  } catch {
    return caregiverSafeAssistantText(raw.slice(0, 100)) || "Saved care information";
  }
}

function questionHasLinkedSource(item: Question): boolean {
  return Boolean(
    item.claim_id ||
    item.evidence_ids?.length ||
    item.context?.some((entry) =>
      (typeof entry.source_id === "string" && entry.source_id.length > 0) ||
      (Array.isArray(entry.source_ids) && entry.source_ids.length > 0) ||
      (Array.isArray(entry.source_record_refs) && entry.source_record_refs.length > 0)
    )
  );
}

function assertScopedRows(rows: unknown, personId: string, label: string): asserts rows is Array<{ id: string; person_id: string }> {
  if (!Array.isArray(rows) || rows.some((value: unknown) => {
    if (!value || typeof value !== "object") return true;
    const row = value as Record<string, unknown>;
    return row.person_id !== personId || typeof row.id !== "string";
  })) {
    throw new Error(`Invalid or cross-record ${label} response`);
  }
}

export default function ClarificationWorkflowPanel({ personId, prefillQuestion, prefillEvidenceIds }: { personId?: string; prefillQuestion?: string; prefillEvidenceIds?: string[] }) {
  const [scopePersonId, setScopePersonId] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [eligibleQuestionIds, setEligibleQuestionIds] = useState<string[]>([]);
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
  const [history, setHistory] = useState<AnswerEvent[]>([]);
  const [reviewEvents, setReviewEvents] = useState<ReviewEvent[]>([]);
  const [reviewRationale, setReviewRationale] = useState("I reviewed this caregiver answer and accept it as a source-attributed report, not as independent verification.");
  const [reviewAfterDays, setReviewAfterDays] = useState("30");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [notice, setNotice] = useState("");

  const isCaregiverNecessaryQuestion = (item: Question) =>
    item.necessity === "necessary" && Boolean(item.necessity_rationale?.trim());
  const eligibleQuestionIdSet = new Set(eligibleQuestionIds);
  const caregiverOpenQuestions = questions
    .filter((item) =>
      (item.status === "open" || item.status === "unresolved") &&
      eligibleQuestionIdSet.has(item.id) &&
      isCaregiverNecessaryQuestion(item)
    )
    .sort((a, b) => {
      const rank: Record<string, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        informational: 4,
      };
      return (rank[a.priority] ?? 5) - (rank[b.priority] ?? 5);
    });
  // Critical items bypass the ordinary attention limit. Other questions are
  // kept available on demand rather than becoming a long visible task list.
  const visibleCaregiverQuestions = [
    ...caregiverOpenQuestions.filter((item) => item.priority === "critical"),
    ...caregiverOpenQuestions.filter((item) => item.priority !== "critical").slice(0, 2),
  ];
  const visibleQuestionIds = new Set(visibleCaregiverQuestions.map((item) => item.id));
  const additionalCaregiverQuestions = caregiverOpenQuestions.filter(
    (item) => !visibleQuestionIds.has(item.id),
  );
  const selectedQuestion = questions.find((item) =>
    item.id === selectedQuestionId &&
    (!(item.status === "open" || item.status === "unresolved") || isCaregiverNecessaryQuestion(item))
  );
  const selectedClaim = claims.find((item) => item.id === (selectedQuestion?.claim_id || selectedClaimId));
  const latestAnswer = history[history.length - 1];
  const latestReview = latestAnswer
    ? reviewEvents.find((item) => item.answer_version === latestAnswer.answer_version)
    : undefined;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const session = await ensureAnonymousSession();
      const sessionPersonId = session.person?.id;
      if (!sessionPersonId || (personId && personId !== sessionPersonId)) {
        throw new Error("Authenticated care-record scope mismatch");
      }
      const [claimRows, questionRows, recommendation, evidenceRows] = await Promise.all([
        getJSON(`/care-continuity/assertions/${encodeURIComponent(sessionPersonId)}?limit=100`),
        getJSON(`/uncertainty/questions/${encodeURIComponent(sessionPersonId)}`),
        getJSON(`/uncertainty/questions/recommended/${encodeURIComponent(sessionPersonId)}`),
        getJSON("/care-continuity/evidence?limit=100"),
      ]);
      assertScopedRows(claimRows, sessionPersonId, "claims");
      assertScopedRows(questionRows, sessionPersonId, "questions");
      assertScopedRows(evidenceRows, sessionPersonId, "evidence");
      if (!recommendation || recommendation.person_id !== sessionPersonId ||
          !Array.isArray(recommendation.eligible_question_ids) ||
          recommendation.eligible_question_ids.some((id: unknown) => typeof id !== "string") ||
          !Array.isArray(recommendation.recommended_question_ids) ||
          recommendation.recommended_question_ids.some((id: unknown) =>
            typeof id !== "string" || !recommendation.eligible_question_ids.includes(id)
          )) {
        throw new Error("Invalid or cross-record recommended question response");
      }
      const loadedClaims = claimRows as Claim[];
      const loadedQuestions = questionRows as Question[];
      const loadedEvidence = evidenceRows as Evidence[];
      setScopePersonId(sessionPersonId);
      setClaims(loadedClaims);
      setQuestions(loadedQuestions);
      setEligibleQuestionIds(recommendation.eligible_question_ids as string[]);
      setEvidence(loadedEvidence);
      setSelectedClaimId((current) => current && loadedClaims.some((row) => row.id === current) ? current : loadedClaims[0]?.id ?? "");
      setSelectedQuestionId((current) => {
        const eligibleIds = new Set(recommendation.eligible_question_ids as string[]);
        const necessaryOpen = loadedQuestions.filter((row) =>
          (row.status === "open" || row.status === "unresolved") &&
          eligibleIds.has(row.id) &&
          row.necessity === "necessary" &&
          Boolean(row.necessity_rationale?.trim())
        );
        const currentQuestion = loadedQuestions.find((row) => row.id === current);
        if (currentQuestion && (
          (currentQuestion.status !== "open" && currentQuestion.status !== "unresolved") ||
          (eligibleIds.has(currentQuestion.id) && currentQuestion.necessity === "necessary" && Boolean(currentQuestion.necessity_rationale?.trim()))
        )) return current;
        const recommendedIds = recommendation.recommended_question_ids as string[];
        const recommendedDefault = recommendedIds.find((id) =>
          necessaryOpen.some((row) => row.id === id)
        );
        return recommendedDefault
          ?? necessaryOpen[0]?.id
          ?? loadedQuestions.find((row) => row.status !== "open" && row.status !== "unresolved")?.id
          ?? "";
      });
    } catch {
      setScopePersonId("");
      setClaims([]);
      setQuestions([]);
      setEligibleQuestionIds([]);
      setEvidence([]);
      setSelectedClaimId("");
      setSelectedQuestionId("");
      setError("Care questions could not be loaded. Your saved information has not been changed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [personId]);

  useEffect(() => {
    void loadAll();
    const refreshAfterCareRecordWrite = () => { void loadAll(); };
    window.addEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
    return () => window.removeEventListener("careRecordUpdated", refreshAfterCareRecordWrite);
  }, [loadAll]);

  useEffect(() => {
    if (prefillQuestion) setQuestionText(prefillQuestion);
    if (prefillEvidenceIds?.length) {
      setEvidenceIds(prefillEvidenceIds);
    }
  }, [prefillQuestion, prefillEvidenceIds]);

  const loadHistory = useCallback(async () => {
    if (!selectedQuestionId || !scopePersonId) {
      setHistory([]);
      setHistoryError("");
      return;
    }
    setHistoryError("");
    try {
      const [rows, reviews] = await Promise.all([
        getJSON(`/uncertainty/questions/${encodeURIComponent(selectedQuestionId)}/answer-history`),
        getJSON(`/uncertainty/questions/${encodeURIComponent(selectedQuestionId)}/review-history`),
      ]);
      if (!Array.isArray(rows) || rows.some((row) =>
        row?.question_id !== selectedQuestionId || row?.person_id !== scopePersonId)) {
        throw new Error("Invalid or cross-record answer history");
      }
      if (!Array.isArray(reviews) || reviews.some((row) =>
        row?.question_id !== selectedQuestionId || row?.person_id !== scopePersonId)) {
        throw new Error("Invalid or cross-record review history");
      }
      setHistory(rows as AnswerEvent[]);
      setReviewEvents(reviews as ReviewEvent[]);
    } catch {
      setHistory([]);
      setReviewEvents([]);
      setHistoryError("Earlier answers or their review history could not be loaded. Please try again.");
    }
  }, [scopePersonId, selectedQuestionId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

  async function createQuestion() {
    if (!scopePersonId || !selectedClaim || questionText.trim().length < 5) {
      setError("Choose a care detail and write a clear question.");
      return;
    }
    if (necessity !== "not_assessed" && necessityRationale.trim().length < 3) {
      setError("Please explain why this question needs an answer, or leave that choice undecided.");
      return;
    }
    if (intendedAnswererLabel.trim() && (!intendedAnswererRole || intendedAnswererRole === "not_known")) {
      setError("Choose who may know the answer before adding a name.");
      return;
    }
    if (evidenceIds.some((id) => !evidence.some((row) => row.id === id && row.person_id === scopePersonId))) {
      setError("One of the selected saved items is unavailable. Please choose again.");
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
      setNotice("Your question has been saved.");
      await loadAll();
      setSelectedQuestionId(created.id);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "";
      if (message.toLowerCase().includes("equivalent open clarification question already exists")) {
        setError("This question is already open. Choose it above to review or answer it.");
      } else {
        setError("Your question could not be saved. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateQuestion(status: "answered" | "open" | "unresolved") {
    if (!selectedQuestion || !scopePersonId) return;
    if (status === "answered" && (answer.trim().length < 2 || answerProvenance.trim().length < 3)) {
      setError("Please enter the answer and say who provided it or how it is known.");
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
      }
      if (status === "unresolved") {
        payload.closed_reason = "The caregiver does not know the answer yet.";
      }
      const updated = await patchJSON(`/uncertainty/questions/${encodeURIComponent(selectedQuestion.id)}`, payload);
      if (!updated || updated.id !== selectedQuestion.id || updated.person_id !== scopePersonId || updated.status !== status) {
        throw new Error("Question transition response not confirmed");
      }
      setNotice(status === "answered"
        ? "Your answer has been saved. It will remain separate from confirmed care information until reviewed."
        : status === "open" ? "This question has been reopened. Earlier answers are still saved."
        : "No answer was recorded. This question remains open for later.");
      if (status === "answered") { setAnswer(""); setAnswerProvenance(""); }
      await loadAll();
      await loadHistory();
    } catch {
      setError("That change could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function reviewAnswer(decision: "accepted" | "rejected" | "needs_clarification") {
    if (!selectedQuestion || !scopePersonId || !history.length) return;
    if (reviewRationale.trim().length < 3) {
      setError("Please explain why this answer is being reviewed.");
      return;
    }
    const latestAnswer = history[history.length - 1];
    if (!latestAnswer) return;
    if (decision === "accepted" && !latestAnswer.evidence_ids?.length) {
      setError("This answer has no saved supporting evidence and cannot be added to the care record.");
      return;
    }
    const interval = Number(reviewAfterDays);
    if (decision === "accepted" && selectedClaim?.assertion_kind === "current_state" &&
        (!Number.isInteger(interval) || interval < 1 || interval > 3650)) {
      setError("Choose a review interval between 1 and 3,650 days for this current care detail.");
      return;
    }
    setReviewSaving(true);
    setError("");
    setNotice("");
    try {
      const result = await postJSON(
        `/uncertainty/questions/${encodeURIComponent(selectedQuestion.id)}/reviews`,
        {
          decision,
          rationale: reviewRationale.trim(),
          ...(decision === "accepted" && selectedClaim?.assertion_kind === "current_state"
            ? { review_after_days: interval }
            : {}),
        },
      ) as ReviewEvent;
      if (!result?.id || result.question_id !== selectedQuestion.id || result.person_id !== scopePersonId) {
        throw new Error("Review response did not match the selected question.");
      }
      setNotice(
        decision === "accepted"
          ? result.care_continuity_execution?.stages?.reconciliation === "committed" || result.resulting_claim_id
            ? "Answer added to the care record as an unverified caregiver report. The original report remains unchanged."
            : "The answer was reviewed, but its care-record update could not be confirmed."
          : decision === "rejected"
            ? "This answer was not accepted into the care record. Its review history was saved."
            : "More information is needed. The answer was not added to the care record.",
      );
      await loadAll();
      await loadHistory();
    } catch {
      setError("The answer review could not be confirmed as saved. The original answer remains unchanged; retry after refreshing.");
    } finally {
      setReviewSaving(false);
    }
  }

  return <section style={panel} aria-label="Care details that need checking">
    <h3 style={{ fontSize: 16, marginTop: 0 }}>Care details that need checking</h3>
    <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>
SolenOS brings a question to you only when a care detail needs your input. Your answer remains a caregiver report until it has been reviewed.
    </p>
    {loading && <p role="status">Loading care questions…</p>}
    {error && <p role="alert" style={{ color: "var(--error)", fontSize: 13 }}>{error} <button type="button" style={button} onClick={() => void loadAll()} disabled={loading}>Try again</button></p>}
    {!loading && !error && <>
      {caregiverOpenQuestions.length === 0 && <p>Nothing needs your input right now. SolenOS will ask when a care detail genuinely needs confirmation. You can talk through other questions with SolenOS Companion.</p>}
      {(caregiverOpenQuestions.length > 0 || questions.some((item) => item.status !== "open" && item.status !== "unresolved")) && <>
        <div style={{ display: "grid", gap: 10 }}>
          {visibleCaregiverQuestions.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setSelectedQuestionId(item.id);
                setAnswer("");
                setAnswerProvenance("");
                setError("");
              }}
              style={{ ...button, textAlign: "left", display: "grid", gap: 5, borderColor: selectedQuestionId === item.id ? "var(--accent)" : "var(--border)" }}
            >
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{questionStatusLabel(item.status, Boolean(item.claim_id))} · {item.priority === "critical" || item.priority === "high" ? "Important" : "For your information"}</span>
              <strong style={{ fontSize: 14, fontWeight: 600 }}>{item.question}</strong>
              <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{questionHasLinkedSource(item) ? "Linked to saved care information" : "No saved source linked yet"}</span>
            </button>
          ))}
          {additionalCaregiverQuestions.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>
                See {additionalCaregiverQuestions.length} more care question{additionalCaregiverQuestions.length === 1 ? "" : "s"}
              </summary>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {additionalCaregiverQuestions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedQuestionId(item.id);
                      setAnswer("");
                      setAnswerProvenance("");
                      setError("");
                    }}
                    style={{ ...button, textAlign: "left", display: "grid", gap: 5 }}
                  >
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {questionStatusLabel(item.status, Boolean(item.claim_id))} · {item.priority === "critical" || item.priority === "high" ? "Important" : "For your information"}
                    </span>
                    <strong style={{ fontSize: 13, fontWeight: 500 }}>{item.question}</strong>
                  </button>
                ))}
              </div>
            </details>
          )}
          {questions.some((item) => item.status !== "open" && item.status !== "unresolved") && (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 13 }}>View answered and closed questions</summary>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {questions.filter((item) => item.status !== "open" && item.status !== "unresolved").map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedQuestionId(item.id)} style={{ ...button, textAlign: "left" }}>
                    <span style={{ display: "block", fontSize: 11, color: "var(--text-secondary)" }}>{questionStatusLabel(item.status, Boolean(item.claim_id))}</span>
                    <strong style={{ fontSize: 13, fontWeight: 500 }}>{item.question}</strong>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
        {selectedQuestion && <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
          <p style={{ marginTop: 0, fontSize: 11, color: "var(--text-secondary)" }}>{questionStatusLabel(selectedQuestion.status, Boolean(selectedQuestion.claim_id))} · {selectedQuestion.priority === "critical" || selectedQuestion.priority === "high" ? "Important to check" : "Helpful to know"}</p>
          <p style={{ fontSize: 14, fontWeight: 600 }}>{selectedQuestion.question}</p>
          {(() => {
            const linkedEvidence = evidence.filter((item) =>
              (selectedQuestion.evidence_ids || []).includes(item.id)
            ).slice(0, 3);
            return linkedEvidence.length > 0 ? (
              <div style={{ margin: "8px 0 12px", padding: 10, borderRadius: 8, background: "var(--bg)" }}>
                <strong style={{ fontSize: 12 }}>Saved information behind this question</strong>
                {linkedEvidence.map((item) => (
                  <div key={item.id} style={{ marginTop: 7 }}>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {item.type === "document" ? "Saved document" : "Saved care note"}
                    </span>
                    <p style={{ margin: "3px 0 0", fontSize: 12, overflowWrap: "anywhere" }}>
                      {evidenceSummary(item)}
                    </p>
                  </div>
                ))}
                {(selectedQuestion.evidence_ids?.length || 0) > linkedEvidence.length && (
                  <p style={{ margin: "6px 0 0", fontSize: 11, color: "var(--text-secondary)" }}>
                    {selectedQuestion.evidence_ids!.length - linkedEvidence.length} additional source(s) linked
                  </p>
                )}
              </div>
            ) : null;
          })()}
          <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {selectedQuestion.intended_answerer_role === "professional" ? "Best person to ask: " : "Who may know: "}
            {selectedQuestion.intended_answerer_label || answererLabel(selectedQuestion.intended_answerer_role)}
          </p>
          {selectedQuestion.answer && <div style={{ background: "var(--bg)", borderRadius: 7, padding: 10, marginBottom: 10 }}>
            <strong style={{ fontSize: 12 }}>Last answer</strong>
            <p>{caregiverSafeAssistantText(selectedQuestion.answer) || "The saved answer is available for review."}</p>
            <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>Source: {caregiverSafeAssistantText(selectedQuestion.answer_provenance) || "Not recorded"}</p>
            <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>Answered {displayDate(selectedQuestion.answered_at)}</p>
          </div>}
          {(selectedQuestion.status === "open" || selectedQuestion.status === "unresolved") && <>
            <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>
              {selectedQuestion.intended_answerer_role === "professional"
                ? "What did the care professional confirm?"
                : selectedQuestion.intended_answerer_role === "other_caregiver"
                  ? "What did the other caregiver share?"
                  : "What have you found out?"}
              <textarea
                style={{ ...field, minHeight: 70, marginTop: 4 }}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={selectedQuestion.intended_answerer_role === "professional"
                  ? "Add their answer if you have it. It is okay if you have not asked yet."
                  : "Write what you know. It is okay if you are not sure."}
              />
            </label>
            <label style={{ display: "block", fontSize: 13, marginBottom: 8 }}>
              {selectedQuestion.intended_answerer_role === "professional"
                ? "Which professional provided this answer, and when?"
                : "Who provided this answer, and how do they know?"}
              <textarea
                style={{ ...field, minHeight: 55, marginTop: 4 }}
                value={answerProvenance}
                onChange={(event) => setAnswerProvenance(event.target.value)}
                placeholder={selectedQuestion.intended_answerer_role === "professional"
                  ? "For example, the pharmacist confirmed this by phone today."
                  : "For example, I measured it this morning."}
              />
            </label>
            <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>Your answer and its source will be saved as a new caregiver report. The original report will remain unchanged.</p>
            <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>An answer will not be treated as confirmed until it has been reviewed.</p>
            <button type="button" style={button} onClick={() => void updateQuestion("answered")} disabled={saving}>{saving ? "Saving…" : "Save answer"}</button>{" "}
            <button type="button" style={button} onClick={() => void updateQuestion("unresolved")} disabled={saving}>I don't know the answer yet</button>
          </>}
          {selectedQuestion.status === "answered" && latestAnswer && (
            latestReview ? (
              <p role="status" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                Answer review recorded: {caregiverStatusLabel(latestReview.decision) || "Review recorded"}.
                {latestReview.resulting_claim_id ? " The answer remains classified as a caregiver report, not an independently verified fact." : ""}
              </p>
            ) : !selectedQuestion.claim_id ? (
              <p role="status" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                This question is not linked to a specific care detail. Your answer and its source are saved, but the answer remains separate from the care record.
              </p>
            ) : (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 10 }}>
                <strong style={{ fontSize: 13 }}>Review this answer</strong>
                <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Accepting adds the answer as a caregiver report. It does not make the information independently verified.
                </p>
                <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Review reason
                  <textarea style={{ ...field, minHeight: 55, marginTop: 4 }} value={reviewRationale} onChange={(event) => setReviewRationale(event.target.value)} />
                </label>
                {selectedClaim?.assertion_kind === "current_state" && (
                  <label style={{ display: "block", fontSize: 12, marginBottom: 8 }}>Review again after (days)
                    <input type="number" min={1} max={3650} value={reviewAfterDays} onChange={(event) => setReviewAfterDays(event.target.value)} style={{ ...field, marginTop: 4 }} />
                  </label>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button type="button" style={button} onClick={() => void reviewAnswer("accepted")} disabled={reviewSaving}>
                    {reviewSaving ? "Saving…" : "Accept as caregiver report"}
                  </button>
                  <button type="button" style={button} onClick={() => void reviewAnswer("needs_clarification")} disabled={reviewSaving}>Need more information</button>
                  <button type="button" style={button} onClick={() => void reviewAnswer("rejected")} disabled={reviewSaving}>Do not accept</button>
                </div>
              </div>
            )
          )}
          {selectedQuestion.status !== "open" && selectedQuestion.status !== "unresolved" && <button type="button" style={button} onClick={() => void updateQuestion("open")} disabled={saving}>Reopen this question</button>}
          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: 12 }}>Earlier answers</strong>
            {historyError && <p role="alert" style={{ color: "var(--error)", fontSize: 12 }}>{historyError}</p>}
            {!historyError && history.length === 0 && <p style={{ fontSize: 12 }}>No earlier answers have been saved.</p>}
            <ol style={{ fontSize: 12, paddingLeft: 18 }}>
              {history.map((item) => <li key={item.id}>
                <p>{caregiverSafeAssistantText(item.answer) || "The saved answer is available for review."}</p>
                <p>Source: {caregiverSafeAssistantText(item.answer_provenance) || "Not recorded"}</p>
                <p>Saved {displayDate(item.created_at)}</p>
              </li>)}
            </ol>
          </div>
        </div>}
      </>}

    </>}
    {notice && <p role="status" style={{ fontSize: 12 }}>{notice}</p>}
  </section>;
}
