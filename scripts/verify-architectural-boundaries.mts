/**
 * verify-architectural-boundaries.mts
 */

import fs from "node:fs";
import path from "node:path";

import {
  ARCHITECTURAL_RULES,
  BOUNDARIES_DEFINING_PRINCIPLE,
  DECISION_FRAMEWORK_QUESTIONS,
  evaluateAgainstDecisionFramework,
  enforceBoundariesOnFinalOutput,
  remediateText,
  resetArchitecturalBoundariesStore,
  scanTextForViolations,
} from "../src/lib/architectural-boundaries";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Architectural Boundaries ===\n");

resetArchitecturalBoundariesStore();
resetCareContextRootStore();
resetCareEventStore();
resetDareStore();

assert(ARCHITECTURAL_RULES.length === 10, "ten architectural rules");
assert(DECISION_FRAMEWORK_QUESTIONS.length === 6, "decision framework");
assert(BOUNDARIES_DEFINING_PRINCIPLE.includes("accuracy"), "defining principle");
console.log("✓ boundary contract");

const violations = scanTextForViolations("test", "He has delirium.");
assert(violations.some((v) => v.rule === "never_diagnose"), "detects diagnosis");
const fixed = remediateText("He has delirium.");
assert(fixed.remediated === true, "remediates diagnosis language");
console.log("✓ violation detection and remediation");

const gate = evaluateAgainstDecisionFramework({
  feature_name: "continuity_voice",
  preserves_truth: true,
  reduces_uncertainty_without_concealing: true,
  strengthens_continuity: true,
  explainable: true,
  confidence_proportional: true,
  reduces_burden_without_clinical_replacement: true,
  may_diagnose: false,
  may_invent_facts: false,
  may_hide_uncertainty: false,
  may_overwrite_history: false,
  optimizes_engagement: false,
});
assert(gate.passes === true, "decision framework gate");

const badGate = evaluateAgainstDecisionFramework({
  feature_name: "diagnosis_bot",
  preserves_truth: false,
  reduces_uncertainty_without_concealing: false,
  strengthens_continuity: false,
  explainable: false,
  confidence_proportional: false,
  reduces_burden_without_clinical_replacement: false,
  may_diagnose: true,
  may_invent_facts: true,
  may_hide_uncertainty: true,
  may_overwrite_history: true,
  optimizes_engagement: true,
});
assert(badGate.passes === false, "rejects boundary violations");
console.log("✓ engineering boundary gate");

const migration = path.join(root, "db/migrations/041_architectural_boundaries_clarification.sql");
assert(fs.existsSync(migration), "migration 041");
console.log("✓ migration 041");

const result = await processSituationInput({
  raw_input: "Dad seems more confused today.",
  caregiver_id: "cg_boundaries",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(result.architectural_boundaries_layer !== undefined, "layer on response");
assert(result.architectural_boundaries_layer.enforced === true, "boundaries enforced");
assert(result.architectural_boundaries_layer.rules_satisfied.length >= 5, "rules satisfied");
assert(
  !result.final_output.what_is_happening.toLowerCase().includes("delirium"),
  "no diagnosis in output",
);
console.log("✓ enforced at final output boundary");

const { output, boundaries } = enforceBoundariesOnFinalOutput(
  {
    ...result.final_output,
    what_is_happening: "He has delirium.",
  },
  {
    has_decision_trace: true,
    has_evidence_links: true,
    has_explicit_uncertainty: true,
    preserves_history: true,
    confidence_proportional: true,
  },
);
assert(boundaries.violations_detected.length >= 1, "catches injected violation");
assert(!output.what_is_happening.includes("delirium"), "remediates output");
console.log("✓ boundary enforcement remediates unsafe output");

console.log("\n=== All architectural boundary checks passed ===\n");
