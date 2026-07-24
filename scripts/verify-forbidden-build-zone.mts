import "./_verify-env.mts";

/**
 * verify-forbidden-build-zone.mts
 * Governance pillars: forbidden build zone, adoption wedge, product reality model.
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
import { resetClarificationStore } from "../src/lib/clarification-engine";
import { resetMemoryStrategyStore } from "../src/lib/memory-strategy-engine";
import { resetTrustLayerEngineStore } from "../src/lib/trust-layer-engine";
import { resetCrisisModeStore } from "../src/lib/crisis-mode-interaction-layer";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetAuditTrailStore } from "../src/lib/audit-trail-system";
import { resetStateOfCareSummaryStore } from "../src/lib/state-of-care-summary-engine";
import { resetCareContextDiffStore } from "../src/lib/care-context-diff-engine";
import { resetCareTimelineStore } from "../src/lib/care-timeline-engine";
import {
  ADOPTION_WEDGE_DEFINING_PRINCIPLE,
  ADOPTION_WEDGE_IDENTITY,
  ORGANIZED_LEAD_MESSAGE,
  processAdoptionWedge,
} from "../src/lib/adoption-wedge-engine";
import {
  BUILD_FILTER_QUESTION,
  FORBIDDEN_BUILD_ZONE_DEFINING_PRINCIPLE,
  passesBuildFilter,
  processForbiddenBuildZone,
  scanForbiddenOutput,
} from "../src/lib/forbidden-build-zone";
import {
  OPERATING_ASSUMPTIONS,
  PRODUCT_REALITY_DEFINING_PRINCIPLE,
  processProductRealityModel,
} from "../src/lib/product-reality-model";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Governance Pillars (FBZ + Wedge + Reality) ===\n");

resetCareTimelineStore();
resetCareContextDiffStore();
resetStateOfCareSummaryStore();
resetAuditTrailStore();
resetMultiCaregiverContextStore();
resetCrisisModeStore();
resetTrustLayerEngineStore();
resetMemoryStrategyStore();
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
resetClarificationStore();
resetPolicyEngineStore();
seedVerifyConsent("cg_gov_ingest");

assert(
  FORBIDDEN_BUILD_ZONE_DEFINING_PRINCIPLE.includes("state-driven"),
  "forbidden build zone principle",
);
assert(ADOPTION_WEDGE_IDENTITY.includes("Send me everything"), "adoption wedge identity");
assert(OPERATING_ASSUMPTIONS.includes("contradiction_is_normal"), "reality model assumptions");
console.log("✓ structural contracts");

assert(fs.existsSync(path.join(root, "db/migrations/052_forbidden_build_zone.sql")), "migration 052");
assert(fs.existsSync(path.join(root, "db/migrations/053_adoption_wedge_engine.sql")), "migration 053");
assert(fs.existsSync(path.join(root, "db/migrations/054_product_reality_model.sql")), "migration 054");
console.log("✓ migrations 052–054");

const blocked = passesBuildFilter({
  feature_description: "internal chat UI for caregivers",
  touches_event_pipeline: false,
  improves_care_record: false,
});
assert(!blocked.allowed, "chat feature blocked");
assert(blocked.reason.includes(BUILD_FILTER_QUESTION), "build filter question cited");

const allowed = passesBuildFilter({
  feature_description: "event extraction from WhatsApp",
  touches_event_pipeline: true,
  improves_care_record: true,
});
assert(allowed.allowed, "ingestion allowed");
console.log("✓ build filter");

assert(scanForbiddenOutput("How can I help you today?").length > 0, "chat pattern detected");
assert(scanForbiddenOutput(ORGANIZED_LEAD_MESSAGE).length === 0, "organized lead allowed");
console.log("✓ forbidden output scan");

const wedgeReady = processAdoptionWedge({
  caregiver_id: "cg_wedge",
  is_first_situation: true,
  events_created_count: 0,
  entry_mode: "initialization",
});
assert(wedgeReady.ingestion_ready, "ingestion ready mode");
assert(wedgeReady.sections.structured_summary_of_chaos.length > 0, "ingestion message");
console.log("✓ adoption wedge ingestion-ready");

const reality = processProductRealityModel({
  has_contradictions: true,
  contradiction_count: 2,
  has_uncertainty: true,
  uncertainty_count: 3,
  events_appended: 1,
  state_derived: true,
  manual_state_edit: false,
});
assert(reality.event_driven, "event driven");
assert(reality.correct_model_rules.includes("state_is_derived"), "derived state rule");
console.log("✓ product reality model");

const init = await processSituationInput({
  raw_input: "Hi SolenOS",
  caregiver_id: "cg_gov_init",
});
assert(init.adoption_wedge_layer?.ingestion_ready === true, "pipeline wedge on init");
assert(init.forbidden_build_zone_layer?.build_filter_passed === true, "output passes filter");
assert(!/\bhow can i help\b/i.test(JSON.stringify(init.final_output)), "no chat in init output");
console.log("✓ pipeline initialization");

const ingested = await processSituationInput({
  raw_input: "Metformin 500mg started yesterday. Blood sugar spike reported.",
  caregiver_id: "cg_gov_ingest",
  timestamp: "2026-07-01T10:00:00.000Z",
});
assert(ingested.adoption_wedge_layer?.is_first_value === true, "first value on ingest");
assert(
  ingested.adoption_wedge_layer?.sections.structured_summary_of_chaos.some((s) =>
    s.includes(ORGANIZED_LEAD_MESSAGE),
  ),
  "organized lead on first ingest",
);
assert(ingested.product_reality_model_layer?.active === true, "reality layer on ingest");
assert(ingested.forbidden_build_zone_layer?.active === true, "forbidden zone layer");
console.log("✓ pipeline first ingest");

const fbz = processForbiddenBuildZone({
  output_surfaces: { test: "Welcome to SolenOS — complete your profile" },
});
assert(!fbz.build_filter_passed, "onboarding copy fails scan");
console.log("✓ forbidden zone processor");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
const pillarSrc = fs.readFileSync(pillarPath, "utf-8");
assert(pillarSrc.includes("forbidden_build_zone"), "pillar forbidden_build_zone");
assert(pillarSrc.includes("adoption_wedge_engine"), "pillar adoption_wedge_engine");
assert(pillarSrc.includes("product_reality_model"), "pillar product_reality_model");
console.log("✓ care continuity pillars #33–35");

assert(
  ingested.adoption_wedge_layer?.defining_principle === ADOPTION_WEDGE_DEFINING_PRINCIPLE,
  "wedge principle",
);
assert(
  ingested.product_reality_model_layer?.defining_principle === PRODUCT_REALITY_DEFINING_PRINCIPLE,
  "reality principle",
);

console.log("\n=== All governance pillar checks passed ===\n");
