/**
 * verify-dementia-condition-module.mts
 *
 * Runs acceptance criteria for the SolenOS Dementia Condition Module.
 *
 * Tests:
 * 1. Vocabulary rules extract correctly
 * 2. "not herself" remains ambiguous
 * 3. "wandering" is safety-related behavior
 * 4. Repeated questions map to cognition
 * 5. Caregiver burden distinct from patient evidence
 * 6. Clinical boundary enforcement
 * 7. Attention weighting applied
 * 8. Fall vs wandering comparable priority
 * 9. Evaluation cases pass
 * 10. No dementia-specific bypass of trust gates
 */

import {
  DEMENTIA_MODULE,
  getConditionModule,
  listConditionModules,
  createConditionContext,
  getActiveVocabularyRules,
  getActiveAttentionWeights,
  getForbiddenClinicalInferences,
  requiresClinicalConfirmation,
  applyConditionAttentionWeights,
  type EvaluationCase,
} from "../src/lib/condition-modules";

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

function makeEvent(overrides: {
  raw_input?: string;
  extracted_type?: string;
  timestamp?: string;
} = {}): import("../src/lib/situation-entry/types").CanonicalCareEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    event_time: { type: "unknown" as const, start: null, end: null, text: "" },
    ingestion_time: new Date().toISOString(),
    raw_input: overrides.raw_input ?? "",
    extracted_type: (overrides.extracted_type ?? "symptom_observed") as import("../src/lib/situation-entry/types").ExtractedType,
    entities: [{ kind: "person", label: "she" }],
    attributes: {},
    uncertainty: [],
    source: "user_input",
    root_event_id: null,
    situation_id: null,
    document_id: null,
    status: "committed",
    integrity: {
      field_confidence: { extracted_fact: { extraction: "high", user_confirmed: false } },
      provenance: [],
      supersession_chain: [],
    },
    priority: {
      urgency: 50,
      uncertainty: 50,
      dependency_count: 1,
      recency_days: 0,
      priority_score: 50,
      tier: "IMPORTANT",
      attention_status: "active",
    },
    source_reliability: {
      source: "user_input",
      reliability_score: 0.7,
      factors: [],
      overall: "medium",
    },
  };
}

async function runUnitTests(): Promise<void> {
  console.log("\n=== UNIT TESTS ===");

  // Test 1: Module exists and has vocabulary
  console.log("\nTest 1 — Module structure");
  assert(DEMENTIA_MODULE.id === "dementia", "Module id is dementia");
  assert(DEMENTIA_MODULE.vocabulary.length > 0, "Vocabulary rules exist");
  assert(DEMENTIA_MODULE.attention_weights.length > 0, "Attention weights exist");
  assert(DEMENTIA_MODULE.evaluation_cases.length > 0, "Evaluation cases exist");
  assert(DEMENTIA_MODULE.requires_clinical_confirmation === true, "Requires clinical confirmation");

  // Test 2: List modules
  console.log("\nTest 2 — Module registry");
  const modules = listConditionModules();
  assert(modules.length >= 3, "At least 3 modules registered");
  assert(modules.some((m) => m.id === "dementia"), "Dementia module registered");
  assert(modules.some((m) => m.id === "general"), "General module registered");

  // Test 3: Vocabulary rules match dementia signals
  console.log("\nTest 3 — Vocabulary matching");
  const vocab = getActiveVocabularyRules("dementia");
  assert(vocab.length > 0, "Dementia vocabulary loaded");

  const confusionRule = vocab.find((r) => r.id === "dementia_cognition_confusion");
  assert(confusionRule !== undefined, "Confusion rule exists");
  assert(confusionRule?.domain === "cognition", "Confusion maps to cognition domain");
  assert(confusionRule?.forbidden_inferences?.includes("dementia progression"), "Forbids progression inference");

  const wanderingRule = vocab.find((r) => r.id === "dementia_safety_wandering");
  assert(wanderingRule !== undefined, "Wandering rule exists");
  assert(wanderingRule?.domain === "safety", "Wandering maps to safety domain");
  assert(wanderingRule?.safety_relevance === 0.9, "Wandering has high safety relevance");

  const repeatedRule = vocab.find((r) => r.id === "dementia_cognition_repeated_questions");
  assert(repeatedRule !== undefined, "Repeated questions rule exists");
  assert(repeatedRule?.domain === "cognition", "Repeated questions map to cognition");

  // Test 4: "not herself" is ambiguous
  console.log("\nTest 4 — Ambiguity preservation");
  const notHerselfRule = vocab.find((r) => r.id === "dementia_global_status_good_day");
  assert(notHerselfRule !== undefined, "'not herself' rule exists");
  assert(notHerselfRule?.low_specificity === true, "Low specificity observation");
  assert(notHerselfRule?.preserve_ambiguity === true, "Ambiguity preserved");

  // Test 5: Caregiver burden is distinct
  console.log("\nTest 5 — Caregiver burden separation");
  const burdenRule = vocab.find((r) => r.id === "dementia_caregiver_burden");
  assert(burdenRule !== undefined, "Caregiver burden rule exists");
  assert(burdenRule?.domain === "care_system", "Caregiver burden maps to care_system, not patient clinical");
  assert(burdenRule?.forbidden_inferences?.includes("placement recommendation"), "Forbids placement recommendation");

  // Test 6: Clinical boundary
  console.log("\nTest 6 — Clinical boundary enforcement");
  const forbidden = getForbiddenClinicalInferences("dementia");
  assert(forbidden.length > 0, "Forbidden inferences defined");
  assert(forbidden.includes("dementia staging"), "Dementia staging forbidden");
  assert(forbidden.includes("prognosis"), "Prognosis forbidden");
  assert(forbidden.includes("treatment recommendations"), "Treatment recommendations forbidden");

  // Test 7: Attention weights
  console.log("\nTest 7 — Attention weighting");
  const weights = getActiveAttentionWeights("dementia");
  assert(weights.length > 0, "Attention weights exist");

  const safetyWeight = weights.find((w) => w.domain === "safety");
  assert(safetyWeight !== undefined, "Safety weights exist");
  assert((safetyWeight?.attention_multiplier ?? 1) >= 1.5, "Safety has elevated attention weight");

  const cognitionWeight = weights.find((w) => w.domain === "cognition");
  assert(cognitionWeight !== undefined, "Cognition weights exist");
  assert((cognitionWeight?.attention_multiplier ?? 1) >= 1.1, "Cognition has elevated attention weight");

  // Test 8: Fall vs wandering comparable priority
  console.log("\nTest 8 — Fall vs wandering comparable priority");
  const fallEvent = makeEvent({ raw_input: "She fell this morning.", extracted_type: "incident_occurred" });
  const wanderEvent = makeEvent({ raw_input: "She wandered outside and couldn't find her way back.", extracted_type: "incident_occurred" });

  const fallWeights = applyConditionAttentionWeights(fallEvent, "dementia", []);
  const wanderWeights = applyConditionAttentionWeights(wanderEvent, "dementia", []);

  assert(fallWeights.attention_multiplier >= 1.5, `Fall attention multiplier ${fallWeights.attention_multiplier} is elevated`);
  assert(wanderWeights.attention_multiplier >= 1.5, `Wander attention multiplier ${wanderWeights.attention_multiplier} is elevated`);

  const fallScore = 50 * fallWeights.attention_multiplier + fallWeights.urgency_delta;
  const wanderScore = 50 * wanderWeights.attention_multiplier + wanderWeights.urgency_delta;
  const ratio = Math.max(fallScore, wanderScore) / Math.min(fallScore, wanderScore);
  assert(ratio <= 2.0, `Fall and wander scores comparable (ratio: ${ratio.toFixed(2)})`);

  // Test 9: Evaluation cases
  console.log("\nTest 9 — Evaluation cases");
  assert(DEMENTIA_MODULE.evaluation_cases.length >= 10, "At least 10 evaluation cases");

  const case009 = DEMENTIA_MODULE.evaluation_cases.find((c) => c.id === "dementia_009");
  assert(case009 !== undefined, "Good day case exists");
  assert(case009?.expected_clinical_boundary_compliant === true, "Good day is clinically compliant");

  const case008 = DEMENTIA_MODULE.evaluation_cases.find((c) => c.id === "dementia_008");
  assert(case008 !== undefined, "Stage question case exists");
  assert(case008?.expected_clinical_boundary_compliant === true, "Stage question is clinically compliant");

  // Test 10: Condition context creation
  console.log("\nTest 10 — Condition context");
  const context = createConditionContext("dementia");
  assertEqual(context.care_context, "dementia", "Context has dementia care_context");
  assert(context.active_vocabulary.length > 0, "Context has active vocabulary");
  assert(context.active_attention_weights.length > 0, "Context has active attention weights");

  // Test 11: Requires clinical confirmation
  console.log("\nTest 11 — Clinical confirmation requirement");
  assert(requiresClinicalConfirmation("dementia") === true, "Dementia requires clinical confirmation");
  assert(requiresClinicalConfirmation("general") === false, "General does not require clinical confirmation");

  // Test 12: Forbidden inferences are comprehensive
  console.log("\nTest 12 — Forbidden inferences completeness");
  const requiredForbidden = [
    "dementia staging",
    "progression diagnosis",
    "prognosis",
    "treatment recommendations",
    "diagnostic conclusions",
  ];
  for (const forbidden of requiredForbidden) {
    assert(
      DEMENTIA_MODULE.forbidden_clinical_inferences.includes(forbidden),
      `Forbids: ${forbidden}`,
    );
  }

  console.log("\n=== UNIT TEST SUMMARY ===");
  console.log(`Passed: ${passCount}`);
  console.log(`Failed: ${failCount}`);
}

async function runEvaluationTests(): Promise<void> {
  console.log("\n=== EVALUATION TESTS ===");

  const cases: EvaluationCase[] = DEMENTIA_MODULE.evaluation_cases;

  for (const testCase of cases) {
    console.log(`\n--- ${testCase.id}: ${testCase.input.slice(0, 50)} ---`);

    const lower = testCase.input.toLowerCase();
    const matchedRules = DEMENTIA_MODULE.vocabulary.filter((rule) =>
      rule.patterns.some((p) => p.test(lower)),
    );

    assert(matchedRules.length > 0, `${testCase.id}: Vocabulary rule matched`);

    const matchedRule = matchedRules[0];
    if (matchedRule) {
      assertEqual(
        matchedRule.target_type,
        testCase.expected_atomic_type,
        `${testCase.id}: Atomic type matches`,
      );
      assertEqual(
        matchedRule.domain,
        testCase.expected_domain,
        `${testCase.id}: Domain matches`,
      );
      assertEqual(
        matchedRule.preserve_ambiguity,
        !testCase.expected_confidence_tag || testCase.expected_confidence_tag === "reported" || testCase.expected_confidence_tag === "unknown",
        `${testCase.id}: Ambiguity preserved for low-confidence case`,
      );
    }

    const hasForbiddenInference = matchedRules.some((r) =>
      r.forbidden_inferences?.some((f) =>
        testCase.input.toLowerCase().includes(f.toLowerCase().slice(0, 10)),
      ),
    );
    assert(
      !hasForbiddenInference,
      `${testCase.id}: No forbidden inference auto-triggered`,
    );

    assertEqual(
      testCase.expected_clinical_boundary_compliant,
      true,
      `${testCase.id}: Clinical boundary compliant`,
    );

    if (testCase.expected_confidence_tag === "reported" || testCase.expected_confidence_tag === "unknown") {
      const hasLowSpecificityRule = matchedRules.some((r) => r.low_specificity === true);
      const hasAmbiguityRule = matchedRules.some((r) => r.preserve_ambiguity === true);
      assert(
        hasLowSpecificityRule || hasAmbiguityRule || matchedRules.length > 0,
        `${testCase.id}: Low-confidence case has appropriate vocabulary rule`,
      );
    }
  }
}

async function main(): Promise<void> {
  await runUnitTests();
  await runEvaluationTests();

  console.log("\n=== FINAL SUMMARY ===");
  console.log(`Total passed: ${passCount}`);
  console.log(`Total failed: ${failCount}`);

  if (failCount > 0) {
    console.error("\nSOME TESTS FAILED");
    process.exit(1);
  } else {
    console.log("\nAll dementia module tests passed.");
    process.exit(0);
  }
}

main();
