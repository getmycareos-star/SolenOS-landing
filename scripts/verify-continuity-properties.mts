/**
 * verify-continuity-properties.mts
 * Vertical Continuity refinement: SRL + EUM + OML + FDLL + failure-map
 * (NOT a new product / NOT a new pillar — properties of CareEvent→CareContext)
 */

import "./_verify-env.mts";
import fs from "node:fs";
import path from "node:path";

import { resetCareEventStore } from "../src/lib/care-events/store";
import { resetDareStore } from "../src/lib/data-acquisition-resilience";
import { resetIntegrityAuditStore } from "../src/lib/care-event-integrity";
import { resetMemoryLayerStore } from "../src/lib/care-memory-layers";
import { resetFailureResilienceStore } from "../src/lib/failure-resilience";
import { resetMoatStore } from "../src/lib/network-effect-moat";
import { resetSuccessModelStore } from "../src/lib/success-model";
import { resetMvpSurfaceStore } from "../src/lib/mvp-surface-area";
import { resetContinuousExecutionStore } from "../src/lib/continuous-execution-loop";
import { seedVerifyConsent, resetPolicyEngineStore } from "../src/lib/policy-engine";
import { resetJourneyInteractionStore } from "../src/lib/single-user-journey";
import { resetRetentionSessionStore } from "../src/lib/retention-engine";
import {
  resetDerivedTables,
  resetEventStore,
  resetProjectionStore,
  resetSessionStore,
} from "../src/lib/event-sourced-storage";
import {
  applyInferenceFeedback,
  classifyFailureFromQuestion,
  classifySourceReliability,
  deriveExplicitUnknowns,
  FAILURE_TO_ENGINE_MAP,
  recordInference,
  resetContinuityPropertiesStore,
  resetInferenceLearningStore,
  resolveReliabilityConflict,
} from "../src/lib/continuity-properties";
import { validateEngineHasMetrics } from "../src/lib/oml";
import {
  resetCareContextRootStore,
  processSituationInput,
} from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function resetAll(): void {
  resetCareContextRootStore();
  resetCareEventStore();
  resetDareStore();
  resetIntegrityAuditStore();
  resetMemoryLayerStore();
  resetFailureResilienceStore();
  resetMoatStore();
  resetSuccessModelStore();
  resetMvpSurfaceStore();
  resetContinuousExecutionStore();
  resetRetentionSessionStore();
  resetJourneyInteractionStore();
  resetEventStore();
  resetProjectionStore();
  resetSessionStore();
  resetDerivedTables();
  resetPolicyEngineStore();
  resetContinuityPropertiesStore();
  resetInferenceLearningStore();
}

console.log("=== SolenOS Continuity Properties (vertical, one system) ===\n");

assert(FAILURE_TO_ENGINE_MAP.length >= 8, "failure map breadth");
const prog = classifyFailureFromQuestion("Is it time for 24/7 care?");
assert(prog.failures.includes("invisible_progression"), "progression failure");
assert(prog.build_engines.some((e) => /diff|timeline|state/i.test(e)), "engines not answers");
assert(prog.continuity_product === true, "continuity product");

const search = classifyFailureFromQuestion("Does Medicare cover dementia care?");
assert(search.content_only === true, "search is content-only");
console.log("✓ failure-first map");

const clinical = classifySourceReliability({
  source: "document",
  raw_input: "Hospital discharge summary — medication changed",
});
assert(clinical.source_type === "clinical", "clinical reliability");
const family = classifySourceReliability({
  source: "user_input",
  raw_input: "Mom seemed confused yesterday",
});
assert(family.source_type === "primary_caregiver", "primary caregiver");
const conflict = resolveReliabilityConflict(clinical, family);
assert(conflict.preferred.source_type === "clinical", "clinical wins weight");
assert(conflict.must_record_contradiction === true, "contradiction preserved");
console.log("✓ source reliability ≠ confidence");

const eum = deriveExplicitUnknowns({
  known: ["Appetite decreased"],
  inferred: ["Possible nutritional concern"],
  event_texts: ["Mom is eating less and more confused"],
  unresolved_clarifications: [],
});
assert(eum.explicit_unknowns.length > 0, "structured unknowns");
assert(
  eum.explicit_unknowns.every((u) => u.why_it_matters && u.priority),
  "unknown schema",
);
console.log("✓ explicit unknowns model");

assert(validateEngineHasMetrics("diff_engine"), "diff maps to OML metric");
assert(validateEngineHasMetrics("clarification_engine"), "clarification maps to OML");

const inf = recordInference({
  inference_id: "inf_test_1",
  care_event_ids: ["ce_1"],
  output_summary: "Confusion increased after medication change",
  confidence_score: 0.6,
  engine_source: "pattern_learning_engine",
  created_at: new Date().toISOString(),
});
const upd = applyInferenceFeedback({
  inference_id: inf.inference_id,
  verdict: "incorrect",
  submitted_at: new Date().toISOString(),
  feedback_source_reliability: 0.8,
});
assert(upd.pathway_unreliable === true, "incorrect marks pathway");
assert(upd.confidence_delta < 0, "confidence drops");
console.log("✓ FDLL explicit feedback learning");

assert(
  fs.existsSync(path.join(root, "db/migrations/072_continuity_properties.sql")),
  "migration 072",
);
console.log("✓ migration");

resetAll();
const caregiverId = "cg_continuity_props";
seedVerifyConsent(caregiverId);

const result = await processSituationInput({
  raw_input:
    "Dad wandered twice this week and I'm overwhelmed — should I hire professional help?",
  caregiver_id: caregiverId,
  timestamp: "2026-07-14T10:00:00.000Z",
});

assert(result.continuity_properties_layer?.active === true, "layer active");
assert(result.continuity_properties_layer!.one_system === true, "one system");
assert(
  result.continuity_properties_layer!.outcome_measurement != null,
  "OML emitted",
);
assert(
  result.care_state_engine_layer!.care_state.explicit_unknowns !== undefined,
  "Care State carries EUM",
);
assert(
  result.continuity_properties_layer!.source_reliability_on_events.length > 0,
  "SRL projected on continuity layer",
);
assert(
  result.continuity_properties_layer!.failure_signals?.continuity_product === true ||
    (result.continuity_properties_layer!.failure_signals?.failures.length ?? 0) > 0,
  "failure signals from input",
);
assert(
  result.continuity_properties_layer!.invariants.reliability_is_not_confidence === true,
  "invariants",
);
console.log("✓ pipeline wires Continuity properties vertically");

console.log("\n=== Continuity Properties: ALL CHECKS PASSED ===\n");
