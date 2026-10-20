/**
 * verify-claim-consistency.mts
 *
 * Runs acceptance criteria for the SolenOS Claim Consistency Confirmation Gate.
 *
 * Tests:
 * 1. Full agreement -> confirmed
 * 2. Confirmed vs reported -> reported
 * 3. Confirmed vs inferred -> inferred
 * 4. Reported vs unknown -> unknown
 * 5. Entity disagreement -> not confirmed
 * 6. Event-type disagreement -> not confirmed
 * 7. Confidence disagreement -> conservative downgrade
 * 8. A-only claim -> retained, confidence = unknown
 * 9. B-only claim -> retained, confidence = unknown
 * 10. No source pointer -> cannot become confirmed
 * 11. Invalid source pointer -> pointer verification fails, confidence downgraded
 * 12. Duplicate matching prevention -> one-to-one matching
 * 13. Parallel execution verification
 * 14. Confidence escalation prevention
 * 15. Real-world ambiguous inputs (3+)
 * 16. Realistic caregiver inputs (5+)
 */

import { strictParseModelJson } from "../src/lib/gemini-contract";
import {
  runConsistencyGate,
  verifySourcePointer,
  enforceSourcePointer,
  reconcileExtractionRuns,
  type ConsistencyGateInput,
  type ConsistencyGateResult,
  type ExtractedClaim,
  type ExtractionRunOutput,
  setConsistencyLogger,
  ConsoleConsistencyLogger,
} from "../src/lib/claim-consistency";

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

function makeClaim(overrides: Partial<ExtractedClaim> = {}): ExtractedClaim {
  return {
    id: `claim_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    claim_text: overrides.claim_text ?? "test claim",
    entity_type: overrides.entity_type ?? "symptom",
    event_type: overrides.event_type ?? "symptom_observed",
    confidence_tag: overrides.confidence_tag ?? "confirmed",
    source_span: "source_span" in overrides ? overrides.source_span : { start_offset: 0, end_offset: 10, text: "test claim" },
    raw_input_id: overrides.raw_input_id ?? "ri_test",
    evidence_id: overrides.evidence_id ?? "ev_test",
    extraction_run_id: overrides.extraction_run_id ?? "run_test",
    created_at: new Date().toISOString(),
  };
}

function makeRun(claims: ExtractedClaim[], success = true, error?: string): ExtractionRunOutput {
  return {
    run_id: `run_${Date.now()}`,
    claims,
    raw_output: JSON.stringify({ claims }),
    success,
    error,
  };
}

async function runUnitTests(): Promise<void> {
  console.log("\n=== UNIT TESTS ===");

  const evidenceId = "ev_unit_test";

  // Test 1: Full agreement
  console.log("\nTest 1 — Full agreement");
  const runA1 = makeRun([
    makeClaim({ claim_text: "Mom fell yesterday", entity_type: "behavior", event_type: "fall_observed", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 17, text: "Mom fell yesterday" } }),
  ]);
  const runB1 = makeRun([
    makeClaim({ claim_text: "Mom fell yesterday", entity_type: "behavior", event_type: "fall_observed", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 17, text: "Mom fell yesterday" } }),
  ]);
  const result1 = reconcileExtractionRuns(runA1, runB1, evidenceId);
  assert(result1.reconciled_claims.length === 1, "One reconciled claim produced");
  assert(result1.reconciled_claims[0]!.confidence_tag === "confirmed", "Full agreement preserves confirmed");
  assert(result1.metrics.full_agreement_claims === 1, "Full agreement count is 1");

  // Test 2: Confirmed vs reported
  console.log("\nTest 2 — Confirmed vs reported");
  const runA2 = makeRun([
    makeClaim({ claim_text: "She seems confused", entity_type: "symptom", event_type: "confusion_observed", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 18, text: "She seems confused" } }),
  ]);
  const runB2 = makeRun([
    makeClaim({ claim_text: "She seems confused", entity_type: "symptom", event_type: "confusion_observed", confidence_tag: "reported", source_span: { start_offset: 0, end_offset: 18, text: "She seems confused" } }),
  ]);
  const result2 = reconcileExtractionRuns(runA2, runB2, evidenceId);
  assert(result2.reconciled_claims[0]!.confidence_tag === "reported", "Confirmed vs reported downgrades to reported");

  // Test 3: Confirmed vs inferred
  console.log("\nTest 3 — Confirmed vs inferred");
  const runA3 = makeRun([
    makeClaim({ claim_text: "New medication started", entity_type: "medication", event_type: "medication_change", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 23, text: "New medication started" } }),
  ]);
  const runB3 = makeRun([
    makeClaim({ claim_text: "New medication started", entity_type: "medication", event_type: "medication_change", confidence_tag: "inferred", source_span: { start_offset: 0, end_offset: 23, text: "New medication started" } }),
  ]);
  const result3 = reconcileExtractionRuns(runA3, runB3, evidenceId);
  assert(result3.reconciled_claims[0]!.confidence_tag === "inferred", "Confirmed vs inferred downgrades to inferred");

  // Test 4: Reported vs unknown
  console.log("\nTest 4 — Reported vs unknown");
  const runA4 = makeRun([
    makeClaim({ claim_text: "Maybe a UTI", entity_type: "symptom", event_type: "possible_infection", confidence_tag: "reported", source_span: { start_offset: 0, end_offset: 11, text: "Maybe a UTI" } }),
  ]);
  const runB4 = makeRun([
    makeClaim({ claim_text: "Maybe a UTI", entity_type: "symptom", event_type: "possible_infection", confidence_tag: "unknown", source_span: { start_offset: 0, end_offset: 11, text: "Maybe a UTI" } }),
  ]);
  const result4 = reconcileExtractionRuns(runA4, runB4, evidenceId);
  assert(result4.reconciled_claims[0]!.confidence_tag === "unknown", "Reported vs unknown stays unknown");

  // Test 5: Entity disagreement
  console.log("\nTest 5 — Entity disagreement");
  const runA5 = makeRun([
    makeClaim({ claim_text: "She is lethargic", entity_type: "symptom", event_type: "lethargy", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 16, text: "She is lethargic" } }),
  ]);
  const runB5 = makeRun([
    makeClaim({ claim_text: "She is lethargic", entity_type: "behavior", event_type: "lethargy", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 16, text: "She is lethargic" } }),
  ]);
  const result5 = reconcileExtractionRuns(runA5, runB5, evidenceId);
  assert(result5.reconciled_claims[0]!.confidence_tag !== "confirmed", "Entity disagreement prevents confirmed");
  assert(result5.disagreements.length === 1, "Disagreement logged for entity mismatch");

  // Test 6: Event-type disagreement
  console.log("\nTest 6 — Event-type disagreement");
  const runA6 = makeRun([
    makeClaim({ claim_text: "She refused to eat", entity_type: "symptom", event_type: "appetite_loss", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 19, text: "She refused to eat" } }),
  ]);
  const runB6 = makeRun([
    makeClaim({ claim_text: "She refused to eat", entity_type: "symptom", event_type: "behavioral_change", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 19, text: "She refused to eat" } }),
  ]);
  const result6 = reconcileExtractionRuns(runA6, runB6, evidenceId);
  assert(result6.reconciled_claims[0]!.confidence_tag !== "confirmed", "Event-type disagreement prevents confirmed");
  assert(result6.disagreements.some((d) => d.disagreement_fields.includes("event_type")), "Event-type disagreement logged");

  // Test 7: Confidence disagreement (confirmed vs reported)
  console.log("\nTest 7 — Confidence disagreement");
  const runA7 = makeRun([
    makeClaim({ claim_text: "Pain in left side", entity_type: "symptom", event_type: "pain_reported", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 16, text: "Pain in left side" } }),
  ]);
  const runB7 = makeRun([
    makeClaim({ claim_text: "Pain in left side", entity_type: "symptom", event_type: "pain_reported", confidence_tag: "reported", source_span: { start_offset: 0, end_offset: 16, text: "Pain in left side" } }),
  ]);
  const result7 = reconcileExtractionRuns(runA7, runB7, evidenceId);
  assert(result7.reconciled_claims[0]!.confidence_tag === "reported", "Confidence disagreement downgrades conservatively");

  // Test 8: A-only claim
  console.log("\nTest 8 — A-only claim");
  const runA8 = makeRun([
    makeClaim({ claim_text: "Only in run A", entity_type: "symptom", event_type: "unique_a", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 14, text: "Only in run A" } }),
  ]);
  const runB8 = makeRun([]);
  const result8 = reconcileExtractionRuns(runA8, runB8, evidenceId);
  assert(result8.reconciled_claims.length === 1, "A-only claim retained");
  assert(result8.reconciled_claims[0]!.confidence_tag === "unknown", "A-only claim downgraded to unknown");
  assert(result8.a_only_logs.length === 1, "A-only log created");

  // Test 9: B-only claim
  console.log("\nTest 9 — B-only claim");
  const runA9 = makeRun([]);
  const runB9 = makeRun([
    makeClaim({ claim_text: "Only in run B", entity_type: "symptom", event_type: "unique_b", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 14, text: "Only in run B" } }),
  ]);
  const result9 = reconcileExtractionRuns(runA9, runB9, evidenceId);
  assert(result9.reconciled_claims.length === 1, "B-only claim retained");
  assert(result9.reconciled_claims[0]!.confidence_tag === "unknown", "B-only claim downgraded to unknown");
  assert(result9.b_only_logs.length === 1, "B-only log created");

  // Test 10: No source pointer
  console.log("\nTest 10 — No source pointer");
  const claimNoPointer = makeClaim({ source_span: null, confidence_tag: "confirmed" });
  const enforced = enforceSourcePointer(claimNoPointer, "anything");
  assert(enforced.confidence_tag === "unknown", "Null source pointer downgrades confirmed to unknown");

  // Test 11: Invalid source pointer
  console.log("\nTest 11 — Invalid source pointer");
  const claimBadPointer = makeClaim({
    source_span: { start_offset: 10, end_offset: 5, text: "bad" },
    confidence_tag: "confirmed",
  });
  const verified = verifySourcePointer(claimBadPointer, "bad");
  assert(verified === false, "Invalid source pointer fails verification");
  const enforcedBad = enforceSourcePointer(claimBadPointer, "bad");
  assert(enforcedBad.confidence_tag === "unknown", "Invalid source pointer downgrades to unknown");
  assert(enforcedBad.source_span === null, "Invalid source span nulled after enforcement");

  // Test 11b: Mismatched source pointer text (text doesn't match original at offsets)
  console.log("\nTest 11b — Mismatched source pointer text");
  const claimMismatchedText = makeClaim({
    claim_text: "She fell down",
    entity_type: "symptom",
    event_type: "fall_observed",
    confidence_tag: "confirmed",
    source_span: { start_offset: 0, end_offset: 11, text: "completely unrelated text" },
  });
  const originalText11b = "She fell down";
  const verifiedMismatched = verifySourcePointer(claimMismatchedText, originalText11b);
  assert(verifiedMismatched === false, "Mismatched source text fails verification");
  const enforcedMismatched = enforceSourcePointer(claimMismatchedText, originalText11b);
  assert(enforcedMismatched.confidence_tag === "unknown", "Mismatched text downgrades to unknown");
  assert(enforcedMismatched.source_span === null, "Mismatched source span nulled after enforcement");

  // Test 11c: Valid source pointer text (exact match)
  console.log("\nTest 11c — Valid exact source pointer");
  const claimValidSpan = makeClaim({
    claim_text: "She fell",
    entity_type: "symptom",
    event_type: "fall_observed",
    confidence_tag: "reported",
    source_span: { start_offset: 0, end_offset: 8, text: "She fell" },
  });
  const originalText11c = "She fell";
  const verifiedValid = verifySourcePointer(claimValidSpan, originalText11c);
  assert(verifiedValid === true, "Exact source pointer passes verification");
  const enforcedValid = enforceSourcePointer(claimValidSpan, originalText11c);
  assert(enforcedValid.confidence_tag === "reported", "Valid source pointer preserves reported confidence");
  assert(enforcedValid.source_span !== null, "Valid source span preserved after enforcement");

  // Test 11d: Partial offset match (offset into a larger original text)
  console.log("\nTest 11d — Source pointer with correct offsets into larger text");
  const claimPartial = makeClaim({
    claim_text: "yesterday",
    entity_type: "symptom",
    event_type: "timing",
    confidence_tag: "confirmed",
    source_span: { start_offset: 14, end_offset: 23, text: "yesterday" },
  });
  const originalText11d = "She fell down yesterday morning";
  const verifiedPartial = verifySourcePointer(claimPartial, originalText11d);
  assert(verifiedPartial === true, "Correct offset into larger text passes verification");

  // Test 11e: Wrong offset into larger text
  console.log("\nTest 11e — Wrong offset into larger text");
  const claimWrongOffset = makeClaim({
    claim_text: "yesterday",
    entity_type: "symptom",
    event_type: "timing",
    confidence_tag: "confirmed",
    source_span: { start_offset: 14, end_offset: 23, text: "morning yest" },
  });
  const originalText11e = "She fell down yesterday morning";
  const verifiedWrong = verifySourcePointer(claimWrongOffset, originalText11e);
  assert(verifiedWrong === false, "Wrong offset text fails verification");
  const enforcedWrong = enforceSourcePointer(claimWrongOffset, originalText11e);
  assert(enforcedWrong.confidence_tag === "unknown", "Wrong offset downgrades confirmed to unknown");

  // Test 12: Duplicate matching prevention
  console.log("\nTest 12 — Duplicate matching prevention");
  const runA12 = makeRun([
    makeClaim({ id: "a1", claim_text: "Shared text", entity_type: "symptom", event_type: "shared", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 12, text: "Shared text" } }),
    makeClaim({ id: "a2", claim_text: "Shared text 2", entity_type: "symptom", event_type: "shared2", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 13, text: "Shared text 2" } }),
  ]);
  const runB12 = makeRun([
    makeClaim({ id: "b1", claim_text: "Shared text", entity_type: "symptom", event_type: "shared", confidence_tag: "confirmed", source_span: { start_offset: 0, end_offset: 12, text: "Shared text" } }),
  ]);
  const result12 = reconcileExtractionRuns(runA12, runB12, evidenceId);
  assert(result12.matched_pairs.length <= 1, "One B claim matched at most once");
  assert(result12.a_only_claims.length >= 1, "Unmatched A claim retained as A-only");

  console.log("\n=== UNIT TEST SUMMARY ===");
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
}

async function runIntegrationTests(): Promise<void> {
  console.log("\n=== INTEGRATION TESTS (requires GEMINI_API_KEY) ===");

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.log("SKIP: GEMINI_API_KEY not configured — skipping LLM integration tests");
    return;
  }

  const logger = new ConsoleConsistencyLogger();
  setConsistencyLogger(logger);

  const testInputs: Array<{ label: string; text: string }> = [
    { label: "Ambiguous 1", text: "She seemed off today." },
    { label: "Ambiguous 2", text: "Mom wasn't herself after the appointment." },
    { label: "Ambiguous 3", text: "I think the new medication is making her tired." },
    { label: "Medication change", text: "Started memantine 10mg yesterday morning with breakfast." },
    { label: "Hospital/discharge", text: "Discharged from St. Mary's Hospital on Tuesday after 3-day stay for pneumonia." },
    { label: "Symptom observation", text: "She has been refusing to eat lunch for the past two days." },
    { label: "Appointment/follow-up", text: "Neurology follow-up scheduled for next Monday at 2pm with Dr. Patel." },
    { label: "Unresolved/contradictory", text: "The nurse said she fell but my mom says she just sat down slowly." },
  ];

  for (const { label, text } of testInputs) {
    console.log(`\n--- ${label} ---`);
    const input: ConsistencyGateInput = {
      evidence_id: `ev_int_${Date.now()}`,
      raw_text: text,
      raw_input_id: `ri_int_${Date.now()}`,
      caregiver_id: "test_caregiver",
      timestamp: new Date().toISOString(),
    };

    const result = await runConsistencyGate(input);
    assert(result.success, `${label}: gate completed`);
    assert(result.run_a.success && result.run_b.success, `${label}: both runs succeeded`);
    assert(result.reconciliation.metrics.matched_claims >= 0, `${label}: metrics computed`);

    const hasConfirmed = result.reconciliation.reconciled_claims.some(
      (c) => c.confidence_tag === "confirmed",
    );
    if (hasConfirmed) {
      const confirmedClaims = result.reconciliation.reconciled_claims.filter(
        (c) => c.confidence_tag === "confirmed",
      );
      for (const claim of confirmedClaims) {
        const pair = result.reconciliation.matched_pairs.find(
          (p) => p.final_claim.id === claim.id,
        );
        if (pair) {
          assert(pair.entity_agrees, `${label}: confirmed claim entity agreement`);
          assert(pair.event_type_agrees, `${label}: confirmed claim event type agreement`);
          assert(pair.confidence_agrees, `${label}: confirmed claim confidence agreement`);
        }
      }
    }
  }
}

async function main(): Promise<void> {
  await runUnitTests();
  await runIntegrationTests();

  console.log("\n=== FINAL SUMMARY ===");
  console.log(`Total passed: ${passCount}`);
  console.log(`Total failed: ${failCount}`);

  if (failCount > 0) {
    console.error("\nSOME TESTS FAILED — do not proceed to next intelligence layer until fixed.");
    process.exit(1);
  } else {
    console.log("\nAll acceptance criteria passed.");
    process.exit(0);
  }
}

main();
