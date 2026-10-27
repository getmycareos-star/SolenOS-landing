import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildReviewedHandoffDraft } from "../src/lib/handoffs/reviewed-draft";

const base = {
  decisions: [{ id: "decision-1", decision_text: "Family agreed to confirm the appointment date." }],
  questions: [{ id: "question-1", question: "Is the visit on Monday or Tuesday?" }],
  gaps: [{ id: "gap-1", description: "Appointment date is not confirmed." }],
  timeline: [{ id: "timeline-1", summary: "Caregiver reported reduced appetite at breakfast." }],
  preparedAt: "2026-10-27T12:00:00Z",
};

const ordinary = buildReviewedHandoffDraft({
  facts: [{ id: "fact-1", fact_value: "Caregiver-reported observation." }],
  ...base,
});
assert.match(ordinary.text, /SOLENOS CARE HANDOFF SUMMARY/);
assert.match(ordinary.text, /CARE FACTS/);
assert.match(ordinary.text, /Caregiver-reported observation/);
assert.deepEqual(ordinary.sourceRecordIds, [
  "fact-1", "decision-1", "question-1", "gap-1", "timeline-1",
]);

const noId = buildReviewedHandoffDraft({
  facts: [{ fact_value: "A saved record without an exposed ID." }],
  decisions: [], questions: [], gaps: [], timeline: [],
  preparedAt: "fixed",
});
assert.deepEqual(noId.sourceRecordIds, []);
assert.ok(noId.text.length <= 18000);

const longFacts = Array.from({ length: 12 }, (_, index) => ({
  id: `fact-${index}`,
  fact_value: `FACT_MARKER_${index}_` + "x".repeat(700),
}));
const longDecisions = Array.from({ length: 8 }, (_, index) => ({
  id: `decision-${index}`,
  decision_text: `DECISION_MARKER_${index}_` + "y".repeat(700),
}));
const longQuestions = Array.from({ length: 8 }, (_, index) => ({
  id: `question-${index}`,
  question: `QUESTION_MARKER_${index}_` + "q".repeat(700),
}));
const longGaps = Array.from({ length: 8 }, (_, index) => ({
  id: `gap-${index}`,
  description: `GAP_MARKER_${index}_` + "g".repeat(700),
}));
const longTimeline = Array.from({ length: 8 }, (_, index) => ({
  id: `timeline-${index}`,
  summary: `TIMELINE_MARKER_${index}_` + "t".repeat(700),
}));
const longRows = [...longFacts, ...longDecisions, ...longQuestions, ...longGaps, ...longTimeline];
const bounded = buildReviewedHandoffDraft({
  facts: longFacts,
  decisions: longDecisions,
  questions: longQuestions,
  gaps: longGaps,
  timeline: longTimeline,
  preparedAt: "fixed",
});
assert.ok(bounded.text.length <= 18000, `summary exceeded limit: ${bounded.text.length}`);
assert.match(bounded.text, /LIMITATIONS/,
  "long summaries must preserve the caregiver-review and provenance limitation text");
assert.ok(bounded.sourceRecordIds.length < longRows.length,
  "truncated rows must not be listed as included source IDs");
for (const row of longRows) {
  const marker = "fact_value" in row ? row.fact_value
    : "decision_text" in row ? row.decision_text
    : "question" in row ? row.question
    : "description" in row ? row.description
    : row.summary;
  assert.equal(
    bounded.sourceRecordIds.includes(row.id),
    bounded.text.includes(marker.slice(0, 40)),
    `source ID inclusion does not match rendered content for ${row.id}`,
  );
}

assert.throws(() => buildReviewedHandoffDraft({
  facts: [], decisions: [], questions: [], gaps: [], timeline: [],
  preparedAt: "fixed",
}), /no saved care facts/);

const handoffPage = await readFile(new URL("../src/app/workspace/handoffs/page.tsx", import.meta.url), "utf8");
assert.match(handoffPage, /if \(!draftReviewConfirmed\)/,
  "sharing must fail closed until the sender explicitly confirms review");
assert.match(handoffPage, /setDraft\(event\.target\.value\); setDraftReviewConfirmed\(false\)/,
  "editing the summary must invalidate the previous review confirmation");
assert.match(handoffPage, /!draftReviewConfirmed/,
  "the share button must remain disabled until the review confirmation is checked");

console.log("PASS: handoff draft provenance tracks only rendered source records, handles missing IDs, rejects empty source data, and respects the 18,000-character cap.");
