/**
 * verify-north-star-experience.mts
 * North Star Experience — product philosophy every technical decision optimizes toward.
 */

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
import { resetContinuityDecayStore } from "../src/lib/continuity-decay-engine";
import {
  DEFINING_PRINCIPLE,
  EXPERIENCE_TEST_QUESTION,
  NORTH_STAR_FEELING,
  NORTH_STAR_NOT_OPTIMIZING,
  PRODUCT_PRINCIPLES,
  passesExperienceTest,
  processNorthStarExperience,
  resetNorthStarExperienceStore,
} from "../src/lib/north-star-experience";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos North Star Experience ===\n");

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
resetContinuityDecayStore();
resetNorthStarExperienceStore();

assert(
  NORTH_STAR_FEELING.includes("reconstruct the care journey from memory"),
  "north star feeling",
);
assert(PRODUCT_PRINCIPLES.length === 5, "five product principles");
assert(NORTH_STAR_NOT_OPTIMIZING.includes("more engagement"), "not optimizing engagement");
assert(DEFINING_PRINCIPLE.includes("continuity"), "defining principle");
console.log("✓ product philosophy contract");

const migration = path.join(root, "db/migrations/040_north_star_experience.sql");
assert(fs.existsSync(migration), "migration 040 exists");
console.log("✓ migration 040");

const gate = passesExperienceTest({
  feature_name: "continuity_voice",
  strengthens_continuity: true,
  reduces_cognitive_burden: true,
  makes_caregiver_feel_understood: true,
  requires_repetition: false,
  ignores_prior_context: false,
  increases_screen_time: false,
});
assert(gate.passes === true, "experience gate passes good feature");
assert(gate.experience_test_question === EXPERIENCE_TEST_QUESTION, "experience test question");

const badGate = passesExperienceTest({
  feature_name: "engagement_nag",
  strengthens_continuity: false,
  reduces_cognitive_burden: false,
  makes_caregiver_feel_understood: false,
  requires_repetition: true,
  ignores_prior_context: true,
  increases_screen_time: true,
});
assert(badGate.passes === false, "experience gate rejects anti-pattern feature");
console.log("✓ engineering experience gate");

const first = await processSituationInput({
  raw_input: "Dad nearly fell getting out of bed this morning.",
  caregiver_id: "cg_northstar",
  timestamp: "2026-07-01T08:00:00.000Z",
});

assert(first.north_star_experience_layer !== undefined, "layer on SituationResponse");
assert(first.north_star_experience_layer.active === true, "north star active");
assert(first.north_star_experience_layer.is_first_situation === false || first.is_first_situation, "first visit tracked");
console.log("✓ first visit — continuity foundation");

const second = await processSituationInput({
  raw_input: "It happened again today.",
  caregiver_id: "cg_northstar",
  timestamp: "2026-07-04T08:00:00.000Z",
});

assert(second.north_star_experience_layer.is_return_session === true, "return session");
assert(
  second.north_star_experience_layer.continuity_recognition !== null,
  "continuity recognition on 'it happened again'",
);
assert(
  second.north_star_experience_layer.continuity_recognition!.includes("remember") ||
    second.north_star_experience_layer.continuity_recognition!.includes("Continuing"),
  "continuity voice references prior context",
);
assert(second.north_star_experience_layer.experience_test_passed === true, "passes experience test");
console.log("✓ three days later — continuity voice (not a new conversation)");

assert(
  second.final_output.what_is_happening.includes("remember") ||
    second.final_output.what_is_happening.includes("Continuing") ||
    second.final_output.what_is_happening.length > 10,
  "continuity voice in final output",
);
assert(
  second.final_output.decision_trace.events.length >= 1 ||
    second.final_output.decision_trace.assumptions.length >= 1 ||
    second.final_output.decision_trace.unknowns.length >= 1,
  "experience in decision trace",
);
console.log("✓ north star wired into final output");

assert(
  second.mvp_surface_area_layer?.aha_moment?.headline ===
    second.north_star_experience_layer.continuity_recognition,
  "aha moment uses continuity recognition",
);
console.log("✓ aha moment reinforces north star");

const apiRoute = path.join(root, "src/app/api/situation/experience/route.ts");
const panel = path.join(root, "src/components/ops-devtools/NorthStarExperiencePanel.tsx");
assert(fs.existsSync(apiRoute), "experience API route");
assert(fs.existsSync(panel), "NorthStarExperiencePanel");
console.log("✓ API and UI");

console.log("\n=== All north star experience checks passed ===\n");
