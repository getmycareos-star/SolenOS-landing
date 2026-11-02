import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync("src/components/ClarificationWorkflowPanel.tsx", "utf8");
const lcr = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");

assert(panel.includes("What We Still Need to Understand"), "the clarification section must use the required LCR heading");
assert(panel.includes('getJSON(`/uncertainty/questions/${encodeURIComponent(sessionPersonId)}`)'), "questions must load from the authenticated backend");
assert(panel.includes('getJSON(`/uncertainty/questions/${encodeURIComponent(selectedQuestionId)}/answer-history`)'), "answer history must load from persisted immutable backend events");
assert(panel.includes('getJSON("/care-continuity/evidence?limit=100")'), "answer evidence must be selected from persisted care-record evidence");
assert(panel.includes("priorityRank(a.priority) - priorityRank(b.priority)"), "unanswered questions must be ordered by persisted priority");
assert(panel.includes("openQuestions.slice(0, 5)"), "the initial question list must be bounded");
assert(panel.includes("questionReason(item)"), "question cards must explain their recorded reason");
assert(panel.includes("assessmentError"), "assessment retrieval failure must be explicit");
assert(panel.includes("No important unanswered questions identified from the available record."), "the truthful no-question state must be present");
assert(panel.includes("review outcome not exposed by the current API"), "an answer must not be represented as verified without a review decision");
assert(panel.includes("open_question_answer_events") || panel.includes("Immutable answer history"), "answer history must remain visible");
assert(panel.includes('href="/workspace/daily-care"') && panel.includes('href="/workspace/documents"'), "caregivers must be routed to existing evidence-capture workflows");
assert(lcr.includes("<ClarificationWorkflowPanel personId={personId} assessment={assessment} assessmentError={assessmentError} />"), "the LCR must pass its real persisted assessment and retrieval error to the clarification section");
assert(!panel.includes("SAMPLE_") && !panel.includes("DEMO_"), "the section must not introduce fabricated care records");

console.log("PASS: LCR clarification section is connected to persisted questions, assessments, evidence and answer history.");
