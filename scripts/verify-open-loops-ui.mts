import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/app/workspace/open-loops/page.tsx", "utf8");

const required: Array<[string, RegExp]> = [
  ["loads the persisted person-scoped follow-ups", /getJSON\("\/open-loops\?limit=100"\)/],
  ["loads the canonical situation-understanding assessment", /getJSON\("\/care-continuity\/situation-understanding"\)/],
  ["keeps partial source failures visible", /Promise\.allSettled\([\s\S]*?if \(!nextLoops && !nextAssessment\)/],
  ["refreshes a missing or stale assessment through the existing endpoint", /status === "not_assessed"[\s\S]*?reassessment_recommended === true[\s\S]*?postJSON\("\/care-continuity\/situation-understanding\/reassess"/],
  ["does not use an assessment belonging to another person", /nextAssessmentResponse\.assessment\.person_id === personId/],
  ["refreshes when a care record is changed or the caregiver returns", /careRecordUpdated[\s\S]*?window\.addEventListener\("focus"/],
  ["records caregiver updates against the existing open loop", /postJSON\("\/open-loops\/" \+ encodeURIComponent\(loop\.id\) \+ "\/outcomes"/],
  ["uses an idempotency key for caregiver updates", /idempotency_key: crypto\.randomUUID\(\)/],
  ["states that a caregiver update is not a verified outcome", /Your update was saved as a caregiver report\. SolenOS has not marked the matter resolved\./],
  ["fails closed when the update cannot be confirmed", /The update could not be confirmed\. Nothing has been marked resolved\./],
  ["discloses bounded or incomplete source coverage", /assessmentIsBounded[\s\S]*?Some saved care information is incomplete or outside the current review/],
  ["renders the four explicit attention classifications", /needs_attention_now[\s\S]*?important_to_address[\s\S]*?can_wait_with_documented_basis[\s\S]*?needs_clarification/],
  ["shows linked source records and evidence references", /Evidence references[\s\S]*?uniqueEvidenceIds/],
  ["does not expose manual task creation or a parallel open-loop writer", /function shareUpdate[\s\S]*?postJSON\("\/open-loops\/"[\s\S]*?\/outcomes/],
];

for (const [label, pattern] of required) {
  assert.match(page, pattern, `Follow-ups contract missing: ${label}`);
}

assert.doesNotMatch(page, /function createLoop|postJSON\("\/open-loops",/, "caregivers must report changes to existing care matters; SolenOS manages the unresolved follow-up lifecycle");
assert.ok(page.includes("Follow-ups"), "Follow-ups must be visible as a named caregiver capability");
assert.ok(page.includes("SolenOS keeps track") || page.includes("SolenOS manages"), "caregiver copy must explain that SolenOS manages unresolved matters");

console.log("FOLLOW_UPS_UI_CONTRACT=PASS");
console.log(`Assertions=${required.length + 3}`);
console.log("Scope=frontend source contract; not a browser or deployed-system test");
