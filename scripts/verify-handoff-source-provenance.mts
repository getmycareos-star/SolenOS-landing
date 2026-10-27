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
assert.match(handoffPage, /redirect\("\/workspace\/companion"\)/,
  "standalone handoff page must route caregivers into AI Companion");
const companionPage = await readFile(new URL("../src/components/workflows/AICompanion.tsx", import.meta.url), "utf8");
for (const label of ["Create care handoff", "Family caregiver", "Professional", "Taking over today", "Doctor's appointment", "Full care overview"]) {
  assert.ok(companionPage.includes(label), `AI Companion must expose ${label}`);
}
assert.match(companionPage, /postJSON\('\/handoff-drafts\/prepare'/,
  "handoff draft must be prepared by the authorised backend, not fabricated in the browser");
assert.match(companionPage, /audience: handoffAudience/,
  "family and professional audiences must remain distinct in the backend request");
assert.match(companionPage, /source_references/,
  "draft review must expose source references returned by the backend");
assert.match(companionPage, /Information coverage and gaps/,
  "draft review must show source availability and gaps");
assert.match(companionPage, /Handoff receipt and acceptance|Handoff acceptance/,
  "the family and professional templates must include a receipt/acceptance section");
assert.match(companionPage, /No information has been inferred/,
  "fallback template must explicitly state that missing field coverage was not inferred");
const sharingComponent = await readFile(new URL("../src/components/workflows/CareHandoffSharing.tsx", import.meta.url), "utf8");
assert.match(companionPage, /CareHandoffSharing/,
  "sharing, receipt and revocation controls must be embedded inside AI Companion");
assert.match(sharingComponent, /Share reviewed family handoff/,
  "family sharing requires a reviewed summary");
assert.match(sharingComponent, /Professional sharing is unavailable until SolenOS can verify professional identity/,
  "professional sharing must fail closed until recipient identity and role are verified");
assert.match(sharingComponent, /source_record_ids: summaryText\.trim\(\) === originalSummaryText\.trim\(\) \? sourceIds : \[\]/,
  "editing the summary must drop provenance IDs rather than falsely attest edits");
assert.match(sharingComponent, /Accept and record receipt/,
  "receiving caregiver must explicitly review and accept/acknowledge the handoff");
assert.match(sharingComponent, /revoke\(item\)/,
  "sender must have a revocation path");

console.log("PASS: handoff draft provenance tracks only rendered source records, handles missing IDs, rejects empty source data, and respects the 18,000-character cap.");
