/**
 * verify-single-user-journey.mts
 * Exact MVP loop: 2 messy inputs → CareEvent → Care State → Diff / continuity.
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
import {
  EXAMPLE_FIRST_INPUT,
  EXAMPLE_SECOND_INPUT,
  JOURNEY_MVP_DEFINITION,
  JOURNEY_STEPS,
  resetJourneyInteractionStore,
  SINGLE_USER_JOURNEY_IDENTITY,
} from "../src/lib/single-user-journey";
import {
  CARE_STATE_ENGINE_IDENTITY,
  CARE_STATE_NOT_IN_MVP,
} from "../src/lib/care-state-engine";
import {
  resetCareContextRootStore,
  processSituationInput,
} from "../src/lib/situation-entry";
import {
  assertCaregiverDtoExcludesInternalCompile,
  toCaregiverSituationResponse,
} from "../src/lib/situation-entry/caregiver-response-dto";
import { resetRetentionSessionStore } from "../src/lib/retention-engine";
import {
  resetDerivedTables,
  resetEventStore,
  resetProjectionStore,
  resetSessionStore,
} from "../src/lib/event-sourced-storage";

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
}

console.log("=== SolenOS Single User Journey (MVP Continuity Loop) ===\n");

assert(SINGLE_USER_JOURNEY_IDENTITY.includes("continuity loop"), "journey identity");
assert(JOURNEY_STEPS.length >= 12, "twelve journey steps");
assert(JOURNEY_MVP_DEFINITION.includes("2 messy inputs"), "mvp definition");
assert(CARE_STATE_ENGINE_IDENTITY.includes("Care State"), "care state identity");
assert(CARE_STATE_NOT_IN_MVP.includes("full_permission_matrix"), "permissions deferred");
console.log("✓ contracts — narrow MVP, architecture-compatible");

assert(fs.existsSync(path.join(root, "db/migrations/068_care_state_engine.sql")), "migration 068");
assert(fs.existsSync(path.join(root, "db/migrations/069_single_user_journey.sql")), "migration 069");
console.log("✓ migrations 068–069");

resetAll();
const caregiverId = "cg_single_journey";
seedVerifyConsent(caregiverId);

// STEP 0–6: First messy input
const first = await processSituationInput({
  raw_input: EXAMPLE_FIRST_INPUT,
  caregiver_id: caregiverId,
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(first.context.events.length >= 1, "STEP 3: first CareEvent created");
assert(first.events_created.length >= 1, "STEP 3: events_created on first pass");
assert(first.care_state_engine_layer?.active === true, "Care State engine active");
assert(
  first.care_state_engine_layer!.care_state.current_understanding.length > 0,
  "STEP 5: current understanding",
);
assert(first.final_output.what_is_happening.trim().length > 0, "STEP 5: state-driven output");
assert(
  !/welcome back|how can i help|hi there/i.test(first.final_output.what_is_happening),
  "RULE: no chat behavior",
);
assert(first.single_user_journey_layer?.active === true, "journey layer present");
assert(
  first.priority_resolution_layer?.dominant_mode === "first_60s_value_loop" ||
    first.priority_resolution_layer?.dominant_mode === "state_of_care_summary" ||
    first.priority_resolution_layer?.dominant_mode === "crisis_mode",
  "first input uses state-driven mode (not clarification-only)",
);
console.log("✓ first input — CareEvent + Care State + no chat");

// STEP 7–12: Second messy input (continuity)
const second = await processSituationInput({
  raw_input: EXAMPLE_SECOND_INPUT,
  caregiver_id: caregiverId,
  timestamp: "2026-07-01T14:00:00.000Z",
});

assert(second.context.events.length >= 2, "STEP 8: CareContext retrieved with prior events");
assert(
  second.context.id === first.context.id ||
    second.context.care_recipient_id === first.context.care_recipient_id,
  "STEP 12: CareContext did not reset",
);
assert(
  second.care_context_diff_layer?.has_meaningful_change === true ||
    second.what_changed.length > 0 ||
    second.care_state_engine_layer?.change_detected === true,
  "STEP 9–11: diff / change detection required",
);
assert(second.final_output.what_is_happening.trim().length > 0, "STEP 11: change-aware output");
assert(
  !/welcome back|how can i help/i.test(second.final_output.what_is_happening),
  "RULE: still no chat on second input",
);
assert(
  second.priority_resolution_layer?.dominant_mode !== "first_60s_value_loop",
  "second input is not onboarding/first-60s",
);
assert(
  second.single_user_journey_layer?.continuity_proven === true ||
    second.single_user_journey_layer?.has_diff_output === true,
  "STEP 12: continuity proven",
);
assert(
  second.care_state_engine_layer!.care_state.recent_changes.length > 0 ||
    second.care_state_engine_layer!.change_detected,
  "Care State surfaces change",
);

// Explicit: user perception conditions
assert(first.events_created.length > 0, "Value: messy input → CareEvent");
assert(
  second.context.events.length > first.context.events.length ||
    second.events_created.length > 0,
  "Value: second input extends history",
);
assert(
  second.what_changed.length > 0 ||
    second.care_context_diff_layer?.has_meaningful_change ||
    /fell|wors|changed|new/i.test(second.final_output.what_is_happening),
  "Value: continuity / change visible",
);

const caregiverDto = toCaregiverSituationResponse(second);
assertCaregiverDtoExcludesInternalCompile(
  caregiverDto as Record<string, unknown>,
  "caregiver API projection",
);
assert(!("final_output" in caregiverDto), "caregiver DTO strips internal final_output");

console.log("✓ second input — context retrieval + diff + continuity");
console.log("✓ caregiver DTO excludes internal final_output (composer path is product truth)");
console.log("✓ MVP SUCCESS: 2 messy inputs → state + change over time");
console.log("\n=== Single User Journey: ALL CHECKS PASSED ===\n");
