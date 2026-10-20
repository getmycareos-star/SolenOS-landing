/**
 * verify-product-north-star.mts
 * North Star gate + caregiver demand failure model (questions = continuity symptoms).
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
  classifyCaregiverDemand,
  evaluateFeatureAgainstNorthStar,
  NORTH_STAR_TEST,
  PRODUCT_NORTH_STAR,
  PRODUCT_NORTH_STAR_IDENTITY,
  QUESTION_TO_CONTINUITY_FAILURE,
  REAL_USER_JOBS,
  resolveEnginesForQuestion,
} from "../src/lib/product-north-star";
import {
  FORBIDDEN_FEATURE_CATEGORIES,
  passesBuildFilter,
  scanForbiddenFeatureRequest,
} from "../src/lib/forbidden-build-zone";
import { NORTH_STAR_FEELING } from "../src/lib/north-star-experience";
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
}

console.log("=== SolenOS Product North Star ===\n");

assert(
  PRODUCT_NORTH_STAR.includes("reconstruct the care journey from memory"),
  "north star statement",
);
assert(PRODUCT_NORTH_STAR_IDENTITY.includes("memory system"), "identity");
assert(NORTH_STAR_TEST.includes("reconstruct"), "test question");
assert(NORTH_STAR_FEELING === PRODUCT_NORTH_STAR, "experience aligned with constraint");
assert(QUESTION_TO_CONTINUITY_FAILURE.length >= 6, "demand themes");
assert(REAL_USER_JOBS.length === 5, "five real user jobs");
console.log("✓ north star contracts");

assert(
  fs.existsSync(path.join(root, "db/migrations/070_product_north_star.sql")),
  "migration 070",
);
assert(
  fs.existsSync(path.join(root, ".cursor/rules/solenos-product-north-star.mdc")),
  "cursor rule",
);
console.log("✓ migration + cursor rule");

// Feature gate
const passDiff = evaluateFeatureAgainstNorthStar("CareContext Diff Engine for change detection");
assert(passDiff.verdict === "pass", "diff engine passes");

const rejectChat = evaluateFeatureAgainstNorthStar("Build a conversational chatbot assistant");
assert(rejectChat.verdict === "reject", "chatbot rejected");

const unclear = evaluateFeatureAgainstNorthStar("Add a purple theme toggle");
assert(unclear.verdict === "unclear_rejected", "unclear defaults to reject");

assert(
  !passesBuildFilter({
    feature_description: "ask me anything answer engine",
    touches_event_pipeline: true,
    improves_care_record: true,
  }).allowed,
  "answer engine blocked even if touches pipeline",
);
assert(FORBIDDEN_FEATURE_CATEGORIES.includes("answer_engine_optimization"), "FBZ category");
assert(
  scanForbiddenFeatureRequest("build an answer engine for caregivers").length > 0,
  "answer engine feature scan",
);
console.log("✓ north star feature gate — unclear rejects");

// Demand classification — continuity vs search
const continuity = classifyCaregiverDemand(
  "Dad keeps wandering at night and I'm exhausted — should I hire professional help?",
);
assert(continuity.demand_type === "continuity_demand", "continuity demand");
assert(continuity.treat_as_product_signal === true, "product signal");
assert(continuity.build_engines_not_answers.length > 0, "engines not answers");

const search = classifyCaregiverDemand("Does Medicare cover dementia care costs?");
assert(search.demand_type === "search_demand", "search demand");
assert(search.treat_as_product_signal === false, "search is not core product fit");

const forgetting = classifyCaregiverDemand(
  "I can't remember what happened at the last appointment and everything is getting mixed up",
);
assert(forgetting.demand_type === "continuity_demand", "memory reconstruction failure");

const resolve = resolveEnginesForQuestion("Is Dad getting worse?");
assert(resolve.do_not_build.includes("answer"), "do not build answer template");
assert(
  resolve.build_instead.some((e) => /diff|timeline|state/i.test(e)),
  "build change detection engines",
);
console.log("✓ questions are continuity symptoms");

// Pipeline
resetAll();
const caregiverId = "cg_north_star";
seedVerifyConsent(caregiverId);

const result = await processSituationInput({
  raw_input: "Mom almost fell again yesterday and is more confused in the evening.",
  caregiver_id: caregiverId,
  timestamp: "2026-07-10T10:00:00.000Z",
});

assert(result.product_north_star_layer?.active === true, "layer on response");
assert(
  result.product_north_star_layer!.north_star.includes("reconstruct"),
  "north star on layer",
);
assert(result.product_north_star_layer!.anti_answer_engine === true, "anti answer engine");
assert(
  result.product_north_star_layer!.output_answers_memory_questions === true,
  "output covers memory questions",
);
assert(
  result.product_north_star_layer!.demand?.demand_type === "continuity_demand" ||
    result.product_north_star_layer!.demand?.demand_type === "unknown",
  "demand classified",
);
assert(
  result.product_north_star_layer!.refused_generic_search_answer === false,
  "continuity note is not search refusal",
);
console.log("✓ pipeline wires North Star constraint");

// Search Demand must not become FAQ / answer-engine output
resetAll();
seedVerifyConsent(caregiverId);
const searchResult = await processSituationInput({
  raw_input: "Does Medicare cover dementia care costs?",
  caregiver_id: caregiverId,
  timestamp: "2026-07-10T11:00:00.000Z",
});
assert(
  searchResult.product_north_star_layer?.demand?.demand_type === "search_demand",
  "search demand classified on pipeline",
);
assert(
  searchResult.product_north_star_layer?.refused_generic_search_answer === true,
  "search demand refused",
);
assert(
  /Living Care Record|not a general|Q&A|FAQ/i.test(
    searchResult.final_output.what_is_happening,
  ),
  "search demand redirected to continuity framing",
);
assert(
  !/medicare covers|eligible for|typically costs/i.test(
    searchResult.final_output.what_is_happening,
  ),
  "no FAQ-style Medicare answer",
);
console.log("✓ Search Demand refused — continuity redirect enforced");

// Source gates
{
  const emotional = fs.readFileSync(
    path.join(root, "docs/02-product/solenos-emotional-response-language.md"),
    "utf8",
  );
  assert(!/care companion/i.test(emotional), "no care-companion assistant identity");
  const obs = fs.readFileSync(
    path.join(root, "src/components/ui-runtime/ObservationInput.tsx"),
    "utf8",
  );
  assert(!/observation-kpi|Primary KPI|This week:/i.test(obs), "no dashboard KPI chrome on observation input");
  console.log("✓ anti-assistant / anti-dashboard source gates");
}

console.log("\n=== Product North Star: ALL CHECKS PASSED ===\n");
