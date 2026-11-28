"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ensureAnonymousSession, getJSON, patchJSON, postJSON } from "@/api/client";
import { caregiverInformationLabel, caregiverSourceText, caregiverSafeAssistantText, caregiverSafeGeneratedText, caregiverStatusLabel } from "@/lib/caregiver-language";

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

function questionStatusLabel(status: string, hasLinkedClaim = true, answererRole?: string | null): string {
  switch (status) {
    case "open":
      if (answererRole === "professional") return "Waiting for care-team confirmation";
      if (answererRole === "other_caregiver") return "Waiting for another caregiver";
      if (answererRole === "person_receiving_care") return "Waiting for the person's response";
      if (!answererRole || answererRole === "not_known") return "Waiting to find out who can answer";
      if (answererRole === "caregiver" || answererRole === "reporting_caregiver") return "Waiting for your observation";
      return "Waiting for an answer";
    case "answered": return hasLinkedClaim ? "Answered — needs review" : "Answer saved";
    case "declined": return "No answer provided";
    case "closed": return "Closed";
    case "unresolved": return "Still unclear";
    default: return "Needs review";
  }
}

function answererLabel(role?: string | null): string {
  const labels: Record<string, string> = {
    caregiver: "You, as the caregiver",
    person_receiving_care: "Person receiving care",
    reporting_caregiver: "Caregiver who shared the report",
    other_caregiver: "Another caregiver",
    professional: "Care professional",
    not_known: "Not known",
  };
  return role ? labels[role] || "Not known" : "Not known";
}

function questionAudienceLabel(role?: string | null): string {
  switch (role) {
    case "professional": return "For the care team";
    case "other_caregiver": return "For another caregiver";
    case "person_receiving_care": return "For the person receiving care";
    case "reporting_caregiver": return "Your observation, if known";
    default: return "Worth clarifying";
  }
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
    if (typeof content === "string") return caregiverSourceText(content.slice(0, 100)) || "Saved care information";
    if (content && typeof content === "object" && !Array.isArray(content)) {
      return "Saved care information";
    }
    return "Saved care information";
  } catch {
    return caregiverSourceText(raw.slice(0, 100)) || "Saved care information";
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

function caregiverQuestionGuidance(item: Question): { why?: string; timingLabel?: string; targetAt?: string } | null {
  const timingPriority: Record<string, number> = {
    before_relying_on_instruction: 4,
    before_next_step: 4,
    recorded_target_date: 3,
    no_deadline_recorded: 2,
    not_established: 1,
  };
  let selected: { why?: string; timingLabel?: string; targetAt?: string; priority: number } | null = null;
  for (const entry of item.context || []) {
    const raw = entry.caregiver_guidance;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const guidance = raw as Record<string, unknown>;
    const timing = typeof guidance.timing === "string" ? guidance.timing : "";
    const timingLabel = typeof guidance.timing_label === "string" ? guidance.timing_label.trim() : "";
    const why = typeof guidance.explanation === "string" ? guidance.explanation.trim() : "";
    const targetAt = typeof guidance.target_at === "string" ? guidance.target_at : undefined;
    if (!timingLabel && !why) continue;
    const candidate = {
      why: why || undefined,
      timingLabel: timingLabel || undefined,
      targetAt,
      priority: timingPriority[timing] ?? 0,
    };
    if (!selected || candidate.priority > selected.priority) selected = candidate;
  }
  if (!selected) return null;
  return { why: selected.why, timingLabel: selected.timingLabel, targetAt: selected.targetAt };
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

export default function ClarificationWorkflowPanel({ personId }: { personId?: string }) {
  const [scopePersonId, setScopePersonId] = useState("");
  const [claims, setClaims] = useState<Claim[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [eligibleQuestionIds, setEligibleQuestionIds] = useState<string[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [answer, setAnswer] = useState("");
  const [answerProvenance, setAnswerProvenance] = useState("");
  const [answerEntryOpen, setAnswerEntryOpen] = useState(false);
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
  const [recommendationUnavailable, setRecommendationUnavailable] = useState(false);
  const [partialLoadWarning, setPartialLoadWarning] = useState<string[]>([]);

  const isCaregiverNecessaryQuestion = (item: Question) =>
    item.necessity === "necessary" && Boolean(item.necessity_rationale?.trim());
  const eligibleQuestionIdSet = new Set(eligibleQuestionIds);
  const eligibleQuestionOrder = new Map<string, number>(eligibleQuestionIds.map((id, index) => [id, index] as const));
  const caregiverOpenQuestions = questions
    .filter((item) =>
      (item.status === "open" || item.status === "unresolved") &&
      eligibleQuestionIdSet.has(item.id) &&
      isCaregiverNecessaryQuestion(item)
    )
    .sort((a, b) => {
      return (eligibleQuestionOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (eligibleQuestionOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER);
    });
  // Stored priority is not proof of urgency. Show one highest-priority
  // question and at most two other necessary questions; keep the rest
  // available on demand so a large record never becomes a caregiver task list.
  const criticalCaregiverQuestions = caregiverOpenQuestions.filter((item) => item.priority === "critical");
  const visibleCaregiverQuestions = [
    ...criticalCaregiverQuestions.slice(0, 1),
    ...caregiverOpenQuestions.filter((item) => item.priority !== "critical").slice(0, 2),
  ];
  const visibleQuestionIds = new Set(visibleCaregiverQuestions.map((item) => item.id));
  const additionalCaregiverQuestions = caregiverOpenQuestions.filter(
    (item) => !visibleQuestionIds.has(item.id),
  );
  const selectedQuestion = questions.find((item) =>
    item.id === selectedQuestionId &&
    (!(item.status === "open" || item.status === "unresolved") ||
      (eligibleQuestionIdSet.has(item.id) && isCaregiverNecessaryQuestion(item)))
  );
  const selectedClaim = claims.find((item) => item.id === selectedQuestion?.claim_id);
  const latestAnswer = history[history.length - 1];
  const latestReview = latestAnswer
    ? reviewEvents.find((item) => item.answer_version === latestAnswer.answer_version)
    : undefined;

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError("");
    setNotice("");
    setRecommendationUnavailable(false);
    setPartialLoadWarning([]);
    try {
      const session = await ensureAnonymousSession();
      const sessionPersonId = session.person?.id;
      if (!sessionPersonId || (personId && personId !== sessionPersonId)) {
        throw new Error("Authenticated care-record scope mismatch");
      }
      const [claimResult, questionResult, answeredResult, declinedResult, closedResult, evidenceResult] = await Promise.allSettled([
        getJSON(`/care-continuity/assertions/${encodeURIComponent(sessionPersonId)}?limit=100`),
        getJSON(`/uncertainty/questions/${encodeURIComponent(sessionPersonId)}`),
        getJSON(`/uncertainty/questions/${encodeURIComponent(sessionPersonId)}?status=answered`),
        getJSON(`/uncertainty/questions/${encodeURIComponent(sessionPersonId)}?status=declined`),
        getJSON(`/uncertainty/questions/${encodeURIComponent(sessionPersonId)}?status=closed`),
        getJSON("/care-continuity/evidence?limit=100"),
      ]);
      const failedSources: string[] = [];
      const readRows = (result: PromiseSettledResult<unknown>, label: string): unknown[] => {
        if (result.status === "rejected") {
          failedSources.push(label);
          return [];
        }
        return result.value as unknown[];
      };
      const claimRows = readRows(claimResult, "care details");
      const questionRows = readRows(questionResult, "open care questions");
      const answeredRows = readRows(answeredResult, "answered questions");
      const declinedRows = readRows(declinedResult, "declined questions");
      const closedRows = readRows(closedResult, "closed questions");
      const evidenceRows = readRows(evidenceResult, "saved source information");
      if (questionResult.status === "rejected") setRecommendationUnavailable(true);
      setPartialLoadWarning(failedSources);
      let recommendation: {
        person_id: string;
        eligible_question_ids: string[];
        recommended_question_ids: string[];
      };
      try {
        recommendation = await getJSON(
          `/uncertainty/questions/recommended/${encodeURIComponent(sessionPersonId)}`
        );
      } catch {
        // Older backend deployments may not yet expose the validated
        // projection. Fail closed for questions without breaking access to
        // the rest of the saved care record.
        recommendation = {
          person_id: sessionPersonId,
          eligible_question_ids: [],
          recommended_question_ids: [],
        };
        setRecommendationUnavailable(true);
      }
      assertScopedRows(claimRows, sessionPersonId, "claims");
      assertScopedRows(questionRows, sessionPersonId, "active questions");
      assertScopedRows(answeredRows, sessionPersonId, "answered questions");
      assertScopedRows(declinedRows, sessionPersonId, "declined questions");
      assertScopedRows(closedRows, sessionPersonId, "closed questions");
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
      // The default endpoint intentionally returns only active caregiver work.
      // Fetch completed states separately so the caregiver can still review the
      // durable answer and provenance archive without expanding the active queue.
      const loadedQuestions = [
        ...(questionRows as Question[]),
        ...(answeredRows as Question[]),
        ...(declinedRows as Question[]),
        ...(closedRows as Question[]),
      ];
      const loadedEvidence = evidenceRows as Evidence[];
      setScopePersonId(sessionPersonId);
      setClaims(loadedClaims);
      setQuestions(loadedQuestions);
      setEligibleQuestionIds(recommendation.eligible_question_ids as string[]);
      setEvidence(loadedEvidence);
      setSelectedQuestionId((current) => {
        const eligibleIds = new Set(recommendation.eligible_question_ids as string[]);
        const currentQuestion = loadedQuestions.find((row) => row.id === current);
        if (currentQuestion && (
          (currentQuestion.status !== "open" && currentQuestion.status !== "unresolved") ||
          (eligibleIds.has(currentQuestion.id) && currentQuestion.necessity === "necessary" && Boolean(currentQuestion.necessity_rationale?.trim()))
        )) return current;
        // Never select a question automatically. Opening the panel must not
        // open an answer form or imply that the caregiver has work to complete.
        return "";
      });
    } catch {
      setScopePersonId("");
      setClaims([]);
      setQuestions([]);
      setEligibleQuestionIds([]);
      setEvidence([]);
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



  const loadHistory = useCallback(async () => {
    if (!selectedQuestionId || !scopePersonId) {
      setHistory([]);
      setHistoryError("");
      return;
    }
    setHistoryError("");
    const [answerResult, reviewResult] = await Promise.allSettled([
      getJSON(`/uncertainty/questions/${encodeURIComponent(selectedQuestionId)}/answer-history`),
      getJSON(`/uncertainty/questions/${encodeURIComponent(selectedQuestionId)}/review-history`),
    ]);
    if (answerResult.status === "fulfilled") {
      const rows = answerResult.value;
      if (!Array.isArray(rows) || rows.some((row) =>
        row?.question_id !== selectedQuestionId || row?.person_id !== scopePersonId)) {
        setHistory([]);
        setReviewEvents([]);
        setHistoryError("Earlier answers could not be verified for this care record. Please try again.");
        return;
      }
      setHistory(rows as AnswerEvent[]);
    } else {
      setHistory([]);
    }
    if (reviewResult.status === "fulfilled") {
      const reviews = reviewResult.value;
      if (!Array.isArray(reviews) || reviews.some((row) =>
        row?.question_id !== selectedQuestionId || row?.person_id !== scopePersonId)) {
        setHistory([]);
        setReviewEvents([]);
        setHistoryError("Review history could not be verified for this care record. Please try again.");
        return;
      }
      setReviewEvents(reviews as ReviewEvent[]);
    } else {
      setReviewEvents([]);
    }
    if (answerResult.status === "rejected" && reviewResult.status === "rejected") {
      setHistoryError("Earlier answers or their review history could not be loaded. Please try again.");
    } else if (answerResult.status === "rejected") {
      setHistoryError("Earlier answers could not be loaded. Please try again.");
    } else if (reviewResult.status === "rejected") {
      setHistoryError("Review history could not be loaded. The saved answers are still shown, but their latest review status may be incomplete.");
    }
  }, [scopePersonId, selectedQuestionId]);

  useEffect(() => { void loadHistory(); }, [loadHistory]);

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
      const successNotice = status === "answered"
        ? "Your answer has been saved. It will remain separate from confirmed care information until reviewed."
        : status === "open" ? "This question has been reopened. Earlier answers are still saved."
        : "No answer was recorded. This question remains open for later.";
      if (status === "answered") { setAnswer(""); setAnswerProvenance(""); setAnswerEntryOpen(false); }
      await loadAll();
      if (status === "answered") {
        // Fetch the durable answer history by the exact question ID. Do not
        // depend on a React state refresh racing the selected-question effect.
        const [answerRows, reviewRows] = await Promise.all([
          getJSON(`/uncertainty/questions/${encodeURIComponent(selectedQuestion.id)}/answer-history`),
          getJSON(`/uncertainty/questions/${encodeURIComponent(selectedQuestion.id)}/review-history`),
        ]);
        if (!Array.isArray(answerRows) || answerRows.some((row) =>
          row?.question_id !== selectedQuestion.id || row?.person_id !== scopePersonId)) {
          throw new Error("Saved answer history did not match the selected care question");
        }
        if (!Array.isArray(reviewRows) || reviewRows.some((row) =>
          row?.question_id !== selectedQuestion.id || row?.person_id !== scopePersonId)) {
          throw new Error("Saved review history did not match the selected care question");
        }
        setHistory(answerRows as AnswerEvent[]);
        setReviewEvents(reviewRows as ReviewEvent[]);
      } else {
        await loadHistory();
      }
      setNotice(successNotice);
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
      setError("There is no saved note or document to support this answer, so it cannot be added to your Care Record.");
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

  return <section style={panel} aria-label="Questions to check">
    <h3 style={{ fontSize: "calc(16px * var(--solenos-text-scale, 1))", marginTop: 0 }}>Questions to check</h3>
    <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
SolenOS only asks when a missing detail could change what happens next. You can leave any question unanswered. Anything you share is saved as your answer until it has been checked.
    </p>
    {loading && <p role="status">Loading questions…</p>}
    {error && <p role="alert" style={{ color: "var(--error)", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>{error} <button type="button" style={button} onClick={() => void loadAll()} disabled={loading}>Try again</button></p>}
    {!loading && !error && partialLoadWarning.length > 0 && (
      <p role="status">We couldn’t load some of your saved care information. What you see here may be incomplete. Try again.</p>
    )}
    {!loading && !error && <>
      {recommendationUnavailable && <p role="status">We couldn’t check for care questions just now. Your saved care information has not changed. Try again later.</p>}
      {caregiverOpenQuestions.length === 0 && !recommendationUnavailable && <p>There are no questions for you to check right now. SolenOS will let you know if something needs your input.</p>}
      {caregiverOpenQuestions.length > visibleCaregiverQuestions.length && (
        <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
          Only a few questions are shown at once. Other saved questions can wait until you choose to review them.
        </p>
      )}
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
                setAnswerEntryOpen(false);
                setError("");
              }}
              style={{ ...button, textAlign: "left", display: "grid", gap: 5, borderColor: selectedQuestionId === item.id ? "var(--accent)" : "var(--border)" }}
            >
              <span style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>{questionAudienceLabel(item.intended_answerer_role)}</span>
              <strong style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", fontWeight: 600 }}>{caregiverSafeGeneratedText(item.question) || "Question details are not available."}</strong>
              <span style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>{questionHasLinkedSource(item) ? "Based on a saved note or document" : "No note or document is linked yet"}</span>
            </button>
          ))}
          {additionalCaregiverQuestions.length > 0 && (
            <details>
              <summary style={{ cursor: "pointer", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>
                See more questions
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
                      setAnswerEntryOpen(false);
                      setError("");
                    }}
                    style={{ ...button, textAlign: "left", display: "grid", gap: 5 }}
                  >
                    <span style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
                      {questionAudienceLabel(item.intended_answerer_role)}
                    </span>
                    <strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", fontWeight: 500 }}>{caregiverSafeGeneratedText(item.question) || "Question details are not available."}</strong>
                  </button>
                ))}
              </div>
            </details>
          )}
          {questions.some((item) => item.status !== "open" && item.status !== "unresolved") && (
            <details>
              <summary style={{ cursor: "pointer", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>See questions already answered</summary>
              <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                {questions.filter((item) => item.status !== "open" && item.status !== "unresolved").map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedQuestionId(item.id)} style={{ ...button, textAlign: "left" }}>
                    <span style={{ display: "block", fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>{questionStatusLabel(item.status, Boolean(item.claim_id))}</span>
                    <strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", fontWeight: 500 }}>{caregiverSafeGeneratedText(item.question) || "Question details are not available."}</strong>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>
        {!selectedQuestion && caregiverOpenQuestions.length > 0 && (
          <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
            Open a question to see why it came up. You can leave it unanswered if you do not know.
          </p>
        )}
        {selectedQuestion && <div style={{ marginTop: 12, border: "1px solid var(--border)", borderRadius: 8, padding: 12 }}>
          <p style={{ marginTop: 0, fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>{questionAudienceLabel(selectedQuestion.intended_answerer_role)}</p>
          <p style={{ fontSize: "calc(14px * var(--solenos-text-scale, 1))", fontWeight: 600 }}>{caregiverSafeGeneratedText(selectedQuestion.question) || "A question needs review."}</p>
          {(() => {
            const guidance = caregiverQuestionGuidance(selectedQuestion);
            const why = guidance?.why
              ? caregiverSafeGeneratedText(guidance.why)
              : caregiverSafeGeneratedText(selectedQuestion.necessity_rationale);
            return (
              <div style={{ margin: "8px 0 12px", padding: 10, borderRadius: 8, background: "var(--bg)" }}>
                <strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Why this came up</strong>
                <p style={{ margin: "5px 0 0", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>
                  {why || "The saved care information shows that this detail affects a care decision."}
                </p>
              </div>
            );
          })()}
          {(() => {
            const guidance = caregiverQuestionGuidance(selectedQuestion);
            if (!guidance?.timingLabel) return null;
            return (
              <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
                <strong>When to ask:</strong> {guidance.timingLabel}
                {guidance.targetAt ? " · " + displayDate(guidance.targetAt) : ""}
              </p>
            );
          })()}
          {(() => {
            const linkedEvidence = evidence.filter((item) =>
              (selectedQuestion.evidence_ids || []).includes(item.id)
            ).slice(0, 3);
            return linkedEvidence.length > 0 ? (
              <div style={{ margin: "8px 0 12px", padding: 10, borderRadius: 8, background: "var(--bg)" }}>
                <strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Why we are asking</strong>
                {linkedEvidence.map((item) => (
                  <div key={item.id} style={{ marginTop: 7 }}>
                    <span style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
                      {item.type === "document" ? "Saved document" : "Saved care note"}
                    </span>
                    <p style={{ margin: "3px 0 0", fontSize: "calc(13px * var(--solenos-text-scale, 1))", overflowWrap: "anywhere" }}>
                      {evidenceSummary(item)}
                    </p>
                  </div>
                ))}
                {(selectedQuestion.evidence_ids?.length || 0) > linkedEvidence.length && (
                  <p style={{ margin: "6px 0 0", fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
                    {selectedQuestion.evidence_ids!.length - linkedEvidence.length} more saved notes or documents
                  </p>
                )}
              </div>
            ) : null;
          })()}
          <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
            {selectedQuestion.intended_answerer_role === "professional" ? "Best person to ask: " : "Who may know: "}
            {selectedQuestion.intended_answerer_label || answererLabel(selectedQuestion.intended_answerer_role)}
          </p>
          {selectedQuestion.answer && <div style={{ background: "var(--bg)", borderRadius: 7, padding: 10, marginBottom: 10 }}>
            <strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Last answer</strong>
            <p>{selectedQuestion.answer?.trim() || "The saved answer is available for review."}</p>
            <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>Who shared this: {selectedQuestion.answer_provenance?.trim() || "Not recorded"}</p>
            <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>Answered {displayDate(selectedQuestion.answered_at)}</p>
          </div>}
          {(selectedQuestion.status === "open" || selectedQuestion.status === "unresolved") && <>
            {!answerEntryOpen ? (
              <div style={{ margin: "10px 0" }}>
                <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
                  You can leave this unanswered if you do not know. SolenOS will keep the saved care information as it is.
                </p>
                <button type="button" style={button} onClick={() => setAnswerEntryOpen(true)}>
                  Add what you know
                </button>
              </div>
            ) : <>
            <label style={{ display: "block", fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>
              {selectedQuestion.intended_answerer_role === "professional"
                ? "What did the care professional confirm?"
                : selectedQuestion.intended_answerer_role === "other_caregiver"
                  ? "What did the other caregiver share?"
                  : selectedQuestion.intended_answerer_role === "person_receiving_care"
                    ? "What did the person receiving care say or show?"
                    : selectedQuestion.intended_answerer_role === "reporting_caregiver"
                      ? "What did you observe or report?"
                      : "Who can confirm this detail?"}
              <textarea
                style={{ ...field, minHeight: 70, marginTop: 4 }}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={selectedQuestion.intended_answerer_role === "professional"
                  ? "Add their answer if you have it. It is okay if you have not asked yet."
                  : selectedQuestion.intended_answerer_role === "person_receiving_care"
                    ? "Record their own words or response if they can share. Do not guess for them."
                    : selectedQuestion.intended_answerer_role === "reporting_caregiver"
                      ? "Record what you personally observed. It is okay if you are not sure."
                      : !selectedQuestion.intended_answerer_role || selectedQuestion.intended_answerer_role === "not_known"
                        ? "If you do not know who can answer, leave this open. Do not guess."
                        : "Write what you know. It is okay if you are not sure."}
              />
            </label>
            <label style={{ display: "block", fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>
              {selectedQuestion.intended_answerer_role === "professional"
                ? "Which professional provided this answer, and when?"
                : selectedQuestion.intended_answerer_role === "person_receiving_care"
                  ? "When did the person say or show this?"
                  : selectedQuestion.intended_answerer_role === "reporting_caregiver"
                    ? "When did you observe this?"
                    : selectedQuestion.intended_answerer_role === "not_known" || !selectedQuestion.intended_answerer_role
                      ? "Who can confirm this detail?"
                      : "Who provided this answer, and how do they know?"}
              <textarea
                style={{ ...field, minHeight: 55, marginTop: 4 }}
                value={answerProvenance}
                onChange={(event) => setAnswerProvenance(event.target.value)}
                placeholder={selectedQuestion.intended_answerer_role === "professional"
                  ? "For example, the pharmacist confirmed this by phone today."
                  : selectedQuestion.intended_answerer_role === "person_receiving_care"
                    ? "For example, they said this during breakfast today."
                    : selectedQuestion.intended_answerer_role === "reporting_caregiver"
                      ? "For example, I noticed this during breakfast today."
                      : selectedQuestion.intended_answerer_role === "not_known" || !selectedQuestion.intended_answerer_role
                      ? "Leave this blank until someone can confirm it."
                      : "For example, the caregiver shared this today."}
              />
            </label>
            <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>Your answer and how you know will be saved. The original note will stay as it is.</p>
            <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>Your answer will not be treated as confirmed until it has been checked.</p>
            <button type="button" style={button} onClick={() => void updateQuestion("answered")} disabled={saving}>{saving ? "Saving…" : "Save answer"}</button>{" "}
            <button type="button" style={button} onClick={() => { setAnswerEntryOpen(false); setAnswer(""); setAnswerProvenance(""); }}>Not now</button>
            </>}
          </>}
          {selectedQuestion.status === "answered" && latestAnswer && (
            latestReview ? (
              <p role="status" style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
                Answer checked: {caregiverStatusLabel(latestReview.decision) || "Saved"}.
                {latestReview.resulting_claim_id ? " It is still saved as something someone shared. It has not been confirmed by a care professional." : ""}
              </p>
            ) : !selectedQuestion.claim_id ? (
              <p role="status" style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
                This question is not about one specific care detail. Your answer is saved, but it has not been added to your Care Record.
              </p>
            ) : (
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 10 }}>
                <strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Review this answer</strong>
                <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", color: "var(--text-secondary)" }}>
                  Accepting saves the answer as something someone shared. It does not mean a care professional has checked that it is correct.
                </p>
                <label style={{ display: "block", fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>Why are you accepting or declining this answer?
                  <textarea style={{ ...field, minHeight: 55, marginTop: 4 }} value={reviewRationale} onChange={(event) => setReviewRationale(event.target.value)} />
                </label>
                {selectedClaim?.assertion_kind === "current_state" && (
                  <label style={{ display: "block", fontSize: "calc(13px * var(--solenos-text-scale, 1))", marginBottom: 8 }}>Check again in how many days?
                    <input type="number" min={1} max={3650} value={reviewAfterDays} onChange={(event) => setReviewAfterDays(event.target.value)} style={{ ...field, marginTop: 4 }} />
                  </label>
                )}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  <button type="button" style={button} onClick={() => void reviewAnswer("accepted")} disabled={reviewSaving}>
                    {reviewSaving ? "Saving…" : "Save this as a care update"}
                  </button>
                  <button type="button" style={button} onClick={() => void reviewAnswer("needs_clarification")} disabled={reviewSaving}>Need more information</button>
                  <button type="button" style={button} onClick={() => void reviewAnswer("rejected")} disabled={reviewSaving}>This answer doesn’t fit</button>
                </div>
              </div>
            )
          )}
          {selectedQuestion.status !== "open" && selectedQuestion.status !== "unresolved" && <button type="button" style={button} onClick={() => void updateQuestion("open")} disabled={saving}>Ask this question again</button>}
          <div style={{ marginTop: 12 }}>
            <strong style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>Previous answers</strong>
            {historyError && <p role="alert" style={{ color: "var(--error)", fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>{historyError}</p>}
            {!historyError && history.length === 0 && <p style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>No earlier answers have been saved.</p>}
            <ol style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))", paddingLeft: 18 }}>
              {history.map((item) => <li key={item.id}>
                <p>{caregiverSourceText(item.answer) || "The saved answer is available for review."}</p>
                <p>Who shared this: {caregiverSourceText(item.answer_provenance) || "Not recorded"}</p>
                <p>Saved {displayDate(item.created_at)}</p>
              </li>)}
            </ol>
          </div>
        </div>}
      </>}

    </>}
    {notice && <p role="status" style={{ fontSize: "calc(13px * var(--solenos-text-scale, 1))" }}>{notice}</p>}
  </section>;
}
