/**
 * verify-living-care-intelligence.mts
 * Baseline Intelligence + Care Reality Profile + Moment-of-Need + Retention + FBZ expansions.
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
import { resetBehaviorPatternStore } from "../src/lib/behavior-interpretation-engine";
import { seedVerifyConsent } from "../src/lib/policy-engine";
import {
  BASELINE_INTELLIGENCE_IDENTITY,
  BASELINE_PROHIBITED,
} from "../src/lib/baseline-intelligence-engine";
import {
  CARE_REALITY_PROFILE_IDENTITY,
  PROFILE_SECTIONS,
} from "../src/lib/care-reality-profile-engine";
import {
  HELPLESSNESS_REDUCTION_GOAL,
  MOMENT_OF_NEED_IDENTITY,
  MOMENT_OF_NEED_PROHIBITED,
} from "../src/lib/moment-of-need-engine";
import {
  RETENTION_ENGINE_IDENTITY,
  RETURN_STATE_SECTIONS,
  recordSessionVisit,
  resetRetentionSessionStore,
} from "../src/lib/retention-engine";
import {
  FORBIDDEN_FEATURE_CATEGORIES,
  scanForbiddenFeatureRequest,
  scanForbiddenOutput,
} from "../src/lib/forbidden-build-zone";
import {
  resetCareContextRootStore,
  processSituationInput,
  processSessionReentry,
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
  resetBehaviorPatternStore();
  resetRetentionSessionStore();
}

console.log("=== SolenOS Living Care Intelligence ===\n");

assert(BASELINE_INTELLIGENCE_IDENTITY.includes("this person"), "baseline identity");
assert(BASELINE_PROHIBITED.length >= 3, "baseline prohibited");
assert(CARE_REALITY_PROFILE_IDENTITY.includes("this person"), "profile identity");
assert(PROFILE_SECTIONS.length === 8, "eight profile sections");
assert(MOMENT_OF_NEED_IDENTITY.includes("happening right now"), "moment identity");
assert(HELPLESSNESS_REDUCTION_GOAL.includes("helplessness"), "helplessness goal");
assert(MOMENT_OF_NEED_PROHIBITED.includes("diagnose conditions"), "moment prohibited");
assert(RETENTION_ENGINE_IDENTITY.includes("while I was gone"), "retention identity");
assert(RETURN_STATE_SECTIONS.length === 5, "five return sections");
console.log("✓ system contracts");

for (const mig of [
  "059_baseline_intelligence_engine.sql",
  "060_care_reality_profile_engine.sql",
  "061_moment_of_need_engine.sql",
  "062_retention_engine.sql",
]) {
  assert(fs.existsSync(path.join(root, "db/migrations", mig)), `migration ${mig}`);
}
console.log("✓ migrations 059–062");

assert(
  FORBIDDEN_FEATURE_CATEGORIES.includes("symptom_checker"),
  "symptom_checker forbidden",
);
assert(
  FORBIDDEN_FEATURE_CATEGORIES.includes("dementia_faq_assistant"),
  "dementia FAQ forbidden",
);
assert(
  FORBIDDEN_FEATURE_CATEGORIES.includes("medical_recommendation_engine"),
  "medical recommendation forbidden",
);
assert(
  scanForbiddenFeatureRequest("build a dementia FAQ assistant").length > 0,
  "FAQ request blocked",
);
assert(
  scanForbiddenOutput("This is a symptom of dementia").length > 0,
  "generic dementia output blocked",
);
console.log("✓ forbidden build zone expansions");

resetAll();
const caregiverId = "cg_living_care";
seedVerifyConsent(caregiverId);

const day1 = await processSituationInput({
  raw_input: "Mom usually sleeps through the night and eats breakfast every morning.",
  caregiver_id: caregiverId,
  timestamp: "2026-06-01T08:00:00.000Z",
});
assert(day1.baseline_intelligence_layer?.active === true, "baseline layer active");
assert(day1.care_reality_profile_layer?.active === true, "profile layer active");
console.log("✓ baseline + profile on first inputs");

const day2 = await processSituationInput({
  raw_input: "Mom slept well again last night and ate her usual breakfast.",
  caregiver_id: caregiverId,
  timestamp: "2026-06-02T08:00:00.000Z",
});
assert(day2.baseline_intelligence_layer !== undefined, "baseline persists");

const day3 = await processSituationInput({
  raw_input: "Mom keeps asking the same question every 5 minutes today.",
  caregiver_id: caregiverId,
  timestamp: "2026-06-10T15:00:00.000Z",
});

assert(day3.moment_of_need_layer?.triggered === true, "moment of need triggered");
assert(day3.moment_of_need_layer!.sections.what_changed.length >= 1, "what changed");
assert(day3.moment_of_need_layer!.sections.what_we_know.length >= 0, "what we know section");
assert(
  day3.moment_of_need_layer!.sections.questions_worth_tracking.length >= 1,
  "tracking questions",
);
assert(
  !/symptom of dementia/i.test(day3.final_output.what_is_happening),
  "no generic dementia FAQ in output",
);
assert(
  day3.baseline_intelligence_layer!.deviations.length >= 1 ||
    day3.moment_of_need_layer!.change_type !== null,
  "person-specific change detected",
);
console.log("✓ moment-of-need guidance — no generic diagnosis");

recordSessionVisit({
  caregiver_id: caregiverId,
  care_recipient_id: day3.context.care_recipient_id,
  event_count: day3.context.events.length,
  context_updated_at: day3.context.updated_at,
  visited_at: "2026-06-10T16:00:00.000Z",
});

await processSituationInput({
  raw_input: "Sleep was fragmented overnight and appetite decreased this morning.",
  caregiver_id: caregiverId,
  timestamp: "2026-06-12T09:00:00.000Z",
});

const reentry = await processSessionReentry({
  caregiver_id: caregiverId,
  raw_input: "hi",
  timestamp: "2026-06-13T10:00:00.000Z",
});

assert(reentry.retention_engine_layer?.active === true, "retention layer on reentry");
assert(
  reentry.retention_engine_layer!.return_state.sections.what_changed_since_last_visit.length >= 0,
  "return delta sections present",
);
assert(
  !/welcome back/i.test(reentry.final_output.what_is_happening),
  "no welcome-back greeting",
);
console.log("✓ return value loop — no chat re-entry");

console.log("\n=== Living Care Intelligence: ALL CHECKS PASSED ===\n");
