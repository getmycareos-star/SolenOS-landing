import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/app/workspace/open-loops/page.tsx", "utf8");
const careContinuity = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");

const required: Array<[string, RegExp]> = [
  ["loads the persisted person-scoped follow-ups", /getJSON\("\/open-loops\?limit=100"\)/],
  ["loads the canonical situation-understanding assessment", /getJSON\("\/care-continuity\/situation-understanding"\)/],
  ["keeps partial source failures visible", /Promise\.allSettled\([\s\S]*?if \(!nextLoops && !nextAssessment\)/],
  ["refreshes a missing or stale assessment through the existing endpoint", /status === "not_assessed"[\s\S]*?reassessment_recommended === true[\s\S]*?postJSON\("\/care-continuity\/situation-understanding\/reassess"/],
  ["does not use an assessment belonging to another person", /nextAssessmentResponse\.assessment\.person_id === personId/],
  ["refreshes when a care record is changed or the caregiver returns", /careRecordUpdated[\s\S]*?window\.addEventListener\("focus"/],
  ["records the caregiver response against the existing loop type", /const endpoint = \["awaiting_response", "follow_up"\]\.includes\(loop\.loop_type\)[\s\S]*?"\/open-loops\/" \+ encodeURIComponent\(loop\.id\) \+ "\/responses"[\s\S]*?"\/open-loops\/" \+ encodeURIComponent\(loop\.id\) \+ "\/outcomes"[\s\S]*?await postJSON\(endpoint/],
  ["reuses the same idempotency key when a caregiver update response is uncertain", /pendingUpdateKeys\.current\[loop\.id\][\s\S]*?pending\?\.signature === signature \? pending\.key : crypto\.randomUUID\(\)/],
  ["clears the pending update key only after the saved view refreshes", /await refresh\(\)[\s\S]*?delete pendingUpdateKeys\.current\[loop\.id\]/],
  ["preserves the caregiver report draft after an uncertain save", /onUpdate\(loop, updateText\.trim\(\)\)[\s\S]*?\.catch\(\(\) => \{ \/\* Keep the exact report text available for a safe retry\. \*\//],
  ["states that a caregiver update is not a verified outcome", /Your update was saved as a caregiver report\. SolenOS has not marked the matter resolved\./],
  ["fails closed when the update cannot be confirmed", /The update could not be confirmed\. Nothing has been marked resolved\./],
  ["discloses bounded or incomplete source coverage", /assessmentIsBounded[\s\S]*?Some saved care information is missing or has not been checked/],
  ["renders the four explicit attention classifications", /needs_attention_now[\s\S]*?important_to_address[\s\S]*?can_wait_with_documented_basis[\s\S]*?needs_clarification/],
  ["shows linked notes and documents", /Related notes and documents[\s\S]*?uniqueEvidenceIds/],
  ["passes a linked follow-up review date into its card", /review_at: loop\.review_at/],
  ["labels a due review as requested rather than as a future date", /Review requested/],
  ["does not expose manual task creation or a parallel open-loop writer", /function shareUpdate[\s\S]*?postJSON\("\/open-loops\/"[\s\S]*?\/outcomes/],
];

for (const [label, pattern] of required) {
  assert.match(page, pattern, `Follow-ups contract missing: ${label}`);
}

const openLoopCreateWrites = page.match(/postJSON\("\/open-loops",/g) ?? [];
assert.equal(openLoopCreateWrites.length, 1, "event-derived follow-ups must use one canonical create writer");
assert.match(page, /async function createFollowUp\(item: AttentionDecision\)[\s\S]*?if \(item\.source !== "events" \|\| !item\.record_id\) return;[\s\S]*?postJSON\("\/open-loops",\s*\{[\s\S]*?source_type: item\.source,[\s\S]*?source_id: item\.record_id,[\s\S]*?idempotency_key: idempotencyKey/s, "follow-up creation must remain bound to a saved care event and retry-safe");
assert.doesNotMatch(page, /function createLoop/, "do not add a second general-purpose follow-up writer");
assert.ok(page.includes("Follow-ups"), "Follow-ups must be visible as a named caregiver capability");
assert.ok(page.includes("SolenOS checks the care information you have saved and keeps follow-ups easy to find"), "caregiver copy must explain that SolenOS manages unresolved matters");


assert.match(careContinuity, /Only items that may need your attention appear here[\s\S]*?This is not a diagnosis/, "Care priorities must remain a short, non-diagnostic current summary");
assert.match(careContinuity, /These are changes or things that are still unclear in the saved care history[\s\S]*?not automatically tasks[\s\S]*?Follow-ups screen/, "monitoring signals must remain distinct from the follow-up workflow");
assert.match(careContinuity, /href="\/workspace\/open-loops"[\s\S]*?See follow-ups/, "Care priorities must link to the dedicated Follow-ups screen");
assert.match(careContinuity, /href="\/workspace\/open-loops"[\s\S]*?See follow-ups/, "Changes to keep an eye on must link to the dedicated Follow-ups screen");

console.log("FOLLOW_UPS_UI_CONTRACT=PASS");
console.log(`Assertions=${required.length + 3}`);
console.log("Scope=frontend source contract; not a browser or deployed-system test");
