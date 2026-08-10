/**
 * verify-state-diff-engine.mts
 *
 * Runs acceptance criteria for the SolenOS "What Changed" State-Diff Engine.
 *
 * Tests:
 * 1. New state produces change_type = new
 * 2. Same value produces no ChangeRecord
 * 3. Forward change produces change_type = changed
 * 4. Backfill produces change_type = backfilled and does not overwrite current state
 * 5. Contradictory claim does not overwrite current state
 * 6. Inferred claim updates state but remains inferred
 * 7. Unknown claim does not update current state
 * 8. Multi-person multi-domain test
 */

import { StateStore } from "../src/lib/state-diff/store";
import { deterministicPhrase } from "../src/lib/state-diff/phrasing";

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  FAIL: ${message}`);
    failCount++;
  }
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual === expected) {
    console.log(`  PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  FAIL: ${message} — expected ${expected}, got ${actual}`);
    failCount++;
  }
}

function makeInput(overrides: {
  person_id?: string;
  domain?: "medication" | "cognition" | "function" | "behavior" | "safety" | "appointments" | "providers" | "care_setting";
  field?: string;
  incoming_value?: string;
  incoming_event_time?: string;
  incoming_confidence?: "confirmed" | "reported" | "inferred" | "unknown" | "contradictory";
  incoming_claim_id?: string;
} = {}) {
  return {
    person_id: overrides.person_id ?? "person_1",
    domain: overrides.domain ?? "medication",
    field: overrides.field ?? "blood_pressure_med_dosage",
    incoming_value: overrides.incoming_value ?? "10mg",
    incoming_event_time: overrides.incoming_event_time ?? "2026-06-01T00:00:00Z",
    incoming_confidence: overrides.incoming_confidence ?? "confirmed",
    incoming_claim_id: overrides.incoming_claim_id ?? "claim_1",
  };
}

async function runUnitTests(): Promise<void> {
  console.log("\n=== UNIT TESTS ===");

  // TEST 1 — NEW STATE
  console.log("\nTest 1 — New state");
  const store1 = new StateStore();
  const result1 = store1.apply(makeInput({ incoming_value: "10mg", incoming_event_time: "2026-06-01T00:00:00Z" }));
  assert(result1.change !== null, "ChangeRecord created for new state");
  assertEqual(result1.change?.change_type, "new", "change_type is 'new'");
  assert(result1.state !== null, "State created");
  assertEqual(result1.state?.value, "10mg", "State value is 10mg");
  assertEqual(result1.state?.confidence_tag, "confirmed", "State confidence preserved");

  // TEST 2 — SAME VALUE
  console.log("\nTest 2 — Same value");
  const store2 = new StateStore();
  store2.apply(makeInput({ incoming_value: "10mg", incoming_event_time: "2026-06-01T00:00:00Z" }));
  const result2 = store2.apply(makeInput({ incoming_value: "10mg", incoming_event_time: "2026-06-05T00:00:00Z" }));
  assert(result2.change === null, "No ChangeRecord for same value");
  assertEqual(result2.state?.value, "10mg", "State value unchanged");

  // TEST 3 — FORWARD CHANGE
  console.log("\nTest 3 — Forward change");
  const store3 = new StateStore();
  store3.apply(makeInput({ incoming_value: "10mg", incoming_event_time: "2026-06-01T00:00:00Z" }));
  const result3 = store3.apply(makeInput({ incoming_value: "20mg", incoming_event_time: "2026-06-05T00:00:00Z" }));
  assert(result3.change !== null, "ChangeRecord created for forward change");
  assertEqual(result3.change?.change_type, "changed", "change_type is 'changed'");
  assertEqual(result3.change?.previous_value?.value, "10mg", "Previous value preserved");
  assertEqual(result3.change?.new_value.value, "20mg", "New value recorded");
  assertEqual(result3.state?.value, "20mg", "Current state updated to 20mg");
  const history3 = store3.getHistory("person_1", "medication", "blood_pressure_med_dosage");
  assert(history3.length === 1, "History entry created for previous state");
  assertEqual(history3[0]?.value, "10mg", "History preserves old value");

  // TEST 4 — BACKFILL
  console.log("\nTest 4 — Backfill");
  const store4 = new StateStore();
  store4.apply(makeInput({ incoming_value: "20mg", incoming_event_time: "2026-06-05T00:00:00Z" }));
  const result4 = store4.apply(makeInput({ incoming_value: "10mg", incoming_event_time: "2026-06-01T00:00:00Z" }));
  assert(result4.change !== null, "ChangeRecord created for backfill");
  assertEqual(result4.change?.change_type, "backfilled", "change_type is 'backfilled'");
  const currentState4 = store4.getCurrentState("person_1", "medication", "blood_pressure_med_dosage");
  assertEqual(currentState4?.value, "20mg", "Current state NOT overwritten by backfill");
  const history4 = store4.getHistory("person_1", "medication", "blood_pressure_med_dosage");
  assert(history4.length === 1, "History entry created for backfilled value");

  // TEST 5 — CONTRADICTORY
  console.log("\nTest 5 — Contradictory claim");
  const store5 = new StateStore();
  store5.apply(makeInput({ incoming_value: "20mg", incoming_event_time: "2026-06-05T00:00:00Z" }));
  const result5 = store5.apply(makeInput({
    incoming_value: "10mg",
    incoming_event_time: "2026-06-06T00:00:00Z",
    incoming_confidence: "contradictory",
  }));
  assert(result5.change === null, "No ChangeRecord for contradictory claim");
  const currentState5 = store5.getCurrentState("person_1", "medication", "blood_pressure_med_dosage");
  assertEqual(currentState5?.value, "20mg", "Current state NOT overwritten by contradictory claim");
  assertEqual(result5.reason, "contradictory claim preserved in history; current state not overwritten", "Reason recorded");

  // TEST 6 — INFERRED
  console.log("\nTest 6 — Inferred claim");
  const store6 = new StateStore();
  const result6 = store6.apply(makeInput({ incoming_value: "15mg", incoming_confidence: "inferred" }));
  assert(result6.change !== null, "ChangeRecord created for inferred claim");
  assertEqual(result6.change?.change_type, "new", "Inferred new state has change_type new");
  assertEqual(result6.state?.confidence_tag, "inferred", "State confidence remains inferred");
  assert(result6.state?.value !== "confirmed", "State never upgraded to confirmed");

  // TEST 7 — UNKNOWN
  console.log("\nTest 7 — Unknown claim");
  const store7 = new StateStore();
  store7.apply(makeInput({ incoming_value: "10mg", incoming_event_time: "2026-06-01T00:00:00Z" }));
  const result7 = store7.apply(makeInput({
    incoming_value: "20mg",
    incoming_event_time: "2026-06-05T00:00:00Z",
    incoming_confidence: "unknown",
  }));
  assert(result7.change === null, "No ChangeRecord for unknown claim");
  const currentState7 = store7.getCurrentState("person_1", "medication", "blood_pressure_med_dosage");
  assertEqual(currentState7?.value, "10mg", "Current state NOT overwritten by unknown claim");

  // TEST 8 — DETERMINISTIC PHRASING
  console.log("\nTest 8 — Deterministic phrasing");
  const newPhrase = deterministicPhrase({
    field: "blood_pressure_med_dosage",
    previous_value: null,
    new_value: { value: "10mg", as_of: "2026-06-01" },
    confidence_tag: "confirmed",
    change_type: "new",
  });
  assert(newPhrase.includes("10mg"), "Phrasing includes new value");

  const changedPhrase = deterministicPhrase({
    field: "blood_pressure_med_dosage",
    previous_value: { value: "10mg", as_of: "2026-06-01" },
    new_value: { value: "20mg", as_of: "2026-06-05" },
    confidence_tag: "reported",
    change_type: "changed",
  });
  assert(changedPhrase.includes("10mg"), "Phrasing includes previous value");
  assert(changedPhrase.includes("20mg"), "Phrasing includes new value");

  const backfillPhrase = deterministicPhrase({
    field: "medication",
    previous_value: null,
    new_value: { value: "lisinopril", as_of: "2026-05-15" },
    confidence_tag: "reported",
    change_type: "backfilled",
  });
  assert(backfillPhrase.includes("backfilled"), "Backfill phrasing includes 'backfilled'");

  console.log("\n=== UNIT TEST SUMMARY ===");
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
}

async function runMultiPersonTest(): Promise<void> {
  console.log("\n=== MULTI-PERSON TEST ===");

  const store = new StateStore();

  const inputs = [
    { person_id: "person_a", domain: "medication" as const, field: "medication_dosage", incoming_value: "10mg", incoming_event_time: "2026-06-01T00:00:00Z", incoming_confidence: "confirmed" as const, incoming_claim_id: "claim_a1" },
    { person_id: "person_b", domain: "cognition" as const, field: "baseline_cognition", incoming_value: "oriented_x3", incoming_event_time: "2026-06-01T00:00:00Z", incoming_confidence: "reported" as const, incoming_claim_id: "claim_b1" },
    { person_id: "person_a", domain: "medication" as const, field: "medication_dosage", incoming_value: "10mg", incoming_event_time: "2026-06-05T00:00:00Z", incoming_confidence: "confirmed" as const, incoming_claim_id: "claim_a2" },
    { person_id: "person_a", domain: "medication" as const, field: "medication_dosage", incoming_value: "20mg", incoming_event_time: "2026-06-10T00:00:00Z", incoming_confidence: "confirmed" as const, incoming_claim_id: "claim_a3" },
    { person_id: "person_b", domain: "cognition" as const, field: "baseline_cognition", incoming_value: "mildly_confused", incoming_event_time: "2026-05-15T00:00:00Z", incoming_confidence: "inferred" as const, incoming_claim_id: "claim_b2" },
    { person_id: "person_a", domain: "safety" as const, field: "fall_risk", incoming_value: "low", incoming_event_time: "2026-06-15T00:00:00Z", incoming_confidence: "contradictory" as const, incoming_claim_id: "claim_a4" },
    { person_id: "person_b", domain: "function" as const, field: "adl_score", incoming_value: "independent", incoming_event_time: "2026-06-20T00:00:00Z", incoming_confidence: "unknown" as const, incoming_claim_id: "claim_b3" },
  ];

  const results = inputs.map((input) => store.apply(input));

  // person_a medication: new (10mg), same (10mg), changed (20mg)
  const personAChanges = store.getAllChanges("person_a");
  assertEqual(personAChanges.length, 2, "Person A has exactly 2 change records (new + changed)");
  assert(personAChanges.some((c) => c.change_type === "new"), "Person A has 'new' change");
  assert(personAChanges.some((c) => c.change_type === "changed"), "Person A has 'changed' change");

  const personAMedChanges = personAChanges.filter((c) => c.domain === "medication");
  assertEqual(personAMedChanges.length, 2, "Person A medication has 2 changes");

  // person_b cognition: new (reported), backfilled (inferred earlier)
  const personBChanges = store.getAllChanges("person_b");
  assertEqual(personBChanges.length, 2, "Person B has exactly 2 change records");
  assert(personBChanges.some((c) => c.change_type === "new"), "Person B has 'new' change");
  assert(personBChanges.some((c) => c.change_type === "backfilled"), "Person B has 'backfilled' change");

  // person_a safety: contradictory should not create change
  const personASafetyChanges = personAChanges.filter((c) => c.domain === "safety");
  assertEqual(personASafetyChanges.length, 0, "Person A safety has no changes (contradictory blocked)");

  // person_b function: unknown should not update state
  const personBFunctionState = store.getCurrentState("person_b", "function", "adl_score");
  assertEqual(personBFunctionState?.value ?? null, null, "Person B function state unchanged by unknown claim");

  // Verify provenance chain
  const personAState = store.getCurrentState("person_a", "medication", "medication_dosage");
  assert(personAState !== null, "Person A medication state exists");
  assertEqual(personAState?.source_claim_id, "claim_a3", "Person A state points to latest claim");
  assertEqual(personAState?.value, "20mg", "Person A state has latest value");
  assertEqual(personAState?.confidence_tag, "confirmed", "Person A state confidence preserved");

  console.log("\n=== MULTI-PERSON TEST SUMMARY ===");
  console.log(`Total passed: ${passCount}`);
  console.log(`Total failed: ${failCount}`);
}

async function main(): Promise<void> {
  await runUnitTests();
  await runMultiPersonTest();

  console.log("\n=== FINAL SUMMARY ===");
  console.log(`Total passed: ${passCount}`);
  console.log(`Total failed: ${failCount}`);

  if (failCount > 0) {
    console.error("\nSOME TESTS FAILED — do not proceed until fixed.");
    process.exit(1);
  } else {
    console.log("\nAll state-diff tests passed.");
    process.exit(0);
  }
}

main();
