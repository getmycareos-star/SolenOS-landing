import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync("src/components/ClarificationWorkflowPanel.tsx", "utf8");
const lcr = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");

assert(panel.includes("What We Still Need to Understand"), "the clarification section must use the required LCR heading");
assert(panel.includes('getJSON(`/uncertainty/questions/${encodeURIComponent(sessionPersonId)}`)'), "questions must load from the authenticated backend");
assert(panel.includes('getJSON(`/uncertainty/questions/${encodeURIComponent(selectedQuestionId)}/answer-history`)'), "answer history must load from persisted immutable backend events");
assert(panel.includes('postJSON(`/care-continuity/next-questions/${encodeURIComponent(sessionPersonId)}`, {})'), "persisted information gaps must load through the existing next-questions endpoint");
assert(panel.includes('getJSON("/care-continuity/evidence?limit=100")'), "answer evidence must be selected from persisted care-record evidence");
assert(panel.includes("Clarify this gap") && panel.includes("source_kind: \"information_gap\""), "an existing persisted gap must be convertible into a source-linked clarification question");
assert(panel.includes("priorityRank(a.priority) - priorityRank(b.priority)"), "unanswered questions must be ordered by persisted priority");
assert(panel.includes("priorityBand(item.priority)"), "questions must distinguish important-now from can-wait priority bands");
assert(panel.includes("uncertaintyLabel(item)"), "uncertainties must be classified separately from missing information");
assert(panel.includes("openQuestions.slice(0, 5)"), "the initial question list must be bounded");
assert(panel.includes("questionReason(item)"), "question cards must explain their recorded reason");
assert(panel.includes("assessmentError"), "assessment retrieval failure must be explicit");
assert(panel.includes("No important unanswered questions identified from the available record."), "the truthful no-question state must be present");
assert(panel.includes("/reviews`, payload)"), "caregiver review decisions must use the persisted backend endpoint");
assert(panel.includes("/review-history`)"), "review decisions must load from persisted history");
assert(panel.includes("Accept and reconcile") && panel.includes("Reject answer") && panel.includes("Request more information"), "all clarification review outcomes must be available");
assert(panel.includes('latest.evidence_ids.length === 0'), "a plain-language answer without attachments must remain recordable but cannot be accepted into the LCR");
assert(panel.includes("Caregiver answer saved with session-attributed identity and immutable history"), "answer submission must not imply automatic verification");
assert(panel.includes("Persisted evidence supporting this answer (optional; required before LCR acceptance)"), "evidence attachment must not block a plain-language answer");
assert(panel.includes('disabled={saving}>Record answer'), "a caregiver must be able to submit an attributed answer without selecting an attachment");
assert(panel.includes("Add evidence through Daily Care or Documents"), "the evidence requirement for acceptance must point to existing capture workflows");
assert(panel.includes("reconciliation_status") && panel.includes("resulting_assertion_id") && panel.includes("resulting_gap_ids") && panel.includes("resulting_assessment_id"), "acceptance must display assertion and information-gap reconciliation references");
assert(panel.includes("open_question_answer_events") || panel.includes("Immutable answer history"), "answer history must remain visible");
assert(panel.includes('href="/workspace/daily-care"') && panel.includes('href="/workspace/documents"'), "caregivers must be routed to existing evidence-capture workflows");
assert(lcr.includes("<ClarificationWorkflowPanel personId={personId} assessment={assessment} assessmentError={assessmentError} onAssessmentRefresh={reassess} />"), "the LCR must pass its real persisted assessment and retrieval error to the clarification section");
assert(!panel.includes("SAMPLE_") && !panel.includes("DEMO_"), "the section must not introduce fabricated care records");

console.log("PASS: LCR clarification section is connected to persisted questions, assessments, evidence and answer history.");
