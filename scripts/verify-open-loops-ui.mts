import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/app/workspace/open-loops/page.tsx", "utf8");

const required: Array<[string, RegExp]> = [
  ["create loop posts to the authoritative API", /postJSON\("\/open-loops"/],
  ["create response refreshes persisted records", /await refresh\(\)[\s\S]*?Open loop saved to the care record/],
  ["create retries reuse an idempotency key for the same payload", /pendingCreateKey\.current = \{ signature, key: idempotencyKey \}/],
  ["successful create clears the pending idempotency key", /await refresh\(\)[\s\S]*?pendingCreateKey\.current = null/],
  ["history is loaded from the backend", /getJSON\(\`\/open-loops\/\$\{encodeURIComponent\(loop\.id\)\}\/history/],
  ["history is visibly rendered", /Recorded history[\s\S]*?historyById\[loop\.id\]/],
  ["backend reassessment is requested", /postJSON\("\/open-loops\/reassess"/],
  ["source evidence is fetched from the active person's care record", /getJSON\(\`\/evidence\/\$\{encodeURIComponent\(activeSession\.person\.id\)\}\`\)/],
  ["professional response requires an existing selected source", /action === "response" && loop\.loop_type === "professional_input"[\s\S]*?const selected = sources\.find/],
  ["professional source references carry the actual evidence ID", /kind: action === "verify" \? "outcome_verification_source" : action === "reconcile" \? "contradiction_reconciliation_source" : "care_record_source",[\s\S]*?evidence_id: selectedSourceId/],
  ["outcome verification and contradiction reconciliation both require source selection", /action === "verify" \|\| action === "reconcile"/],
  ["verification and reconciliation explain that descriptive wording is not source evidence", /Outcome verification requires an existing persisted source record[\s\S]*?Contradiction reconciliation requires persisted source evidence/],
  ["missing source evidence blocks the action", /No source evidence is saved in this care record yet/],
  ["mutation retries retain the key for the same pending action", /pending\?\.signature === signature \? pending\.key : crypto\.randomUUID\(\)[\s\S]*?pendingActionKeys\.current\[pendingKey\]/],
  ["action keys are cleared only after a successful refresh", /await refresh\(\)[\s\S]*?if \(pendingActionKeyToClear\) delete pendingActionKeys\.current\[pendingActionKeyToClear\]/],
  ["action errors are shown rather than reported as success", /The requested change was not confirmed/],
  ["no sample Open Loop records are fabricated", /No sample records are shown/],
];

for (const [label, pattern] of required) {
  assert.match(page, pattern, `Open Loop UI contract missing: ${label}`);
}

for (const action of ["responses", "actions", "outcomes", "corroborate-outcome", "reconcile", "close", "reopen", "cancel"]) {
  assert.ok(page.includes(`"${action}"`), `Open Loop action route missing: ${action}`);
}

assert.ok(
  page.includes("Verification means a caregiver reviewed two persisted sources and explicitly assessed their origins as independent. This records a corroboration assessment; it does not automatically establish semantic entailment, truth, or causation."),
  "verified outcomes must disclose the limits of semantic grounding and causation",
);

console.log("OPEN_LOOPS_UI_CONTRACT=PASS");
console.log(`Assertions=${required.length + 8}`);
console.log("Scope=frontend source contract; not a browser or deployed-system test");
