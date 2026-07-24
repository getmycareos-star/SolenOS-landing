/**
 * verify-multi-caregiver-context-model.mts
 * Multi-Caregiver Context — mandatory attribution, conflict preservation, shared recipient scope.
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
import {
  MULTI_CAREGIVER_CONTEXT_IDENTITY,
  MULTI_CAREGIVER_DEFINING_PRINCIPLE,
  attachAttributionToEvents,
  linkCaregiverToRecipient,
  processMultiCaregiverContext,
  resetMultiCaregiverContextStore,
  resolveCareRecipientId,
} from "../src/lib/multi-caregiver-context-model";
import { resetAuditTrailStore } from "../src/lib/audit-trail-system";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";
import {
  getActiveCareSituation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { getCareRealityState, resetCareRealityStateStore } from "../src/lib/care-reality-state";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Multi-Caregiver Context Model ===\n");

resetMultiCaregiverContextStore();
resetAuditTrailStore();
resetCrisisModeStore();
resetTrustLayerEngineStore();
resetMemoryStrategyStore();
resetCareContextRootStore();
resetActiveCareSituationStore();
resetCareRealityStateStore();
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

assert(
  MULTI_CAREGIVER_CONTEXT_IDENTITY.includes("private caregiver observations"),
  "multi-caregiver identity",
);
console.log("✓ structural contract");

const migration = path.join(root, "db/migrations/045_multi_caregiver_context_model.sql");
assert(fs.existsSync(migration), "migration 045");
console.log("✓ migration 045");

linkCaregiverToRecipient("cg_daughter", "cr_shared");
linkCaregiverToRecipient("cg_nurse", "cr_shared");

const daughter = await processSituationInput({
  raw_input: "He is eating less this week — barely finishing meals.",
  caregiver_id: "cg_daughter",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(daughter.multi_caregiver_context_layer !== undefined, "layer on SituationResponse");
assert(daughter.context.care_recipient_id === "cr_shared", "care recipient scope not single-user");
assert(
  daughter.events_created.every((e) => e.source_attribution?.caregiver_id === "cg_daughter"),
  "mandatory event attribution",
);
assert(
  daughter.multi_caregiver_context_layer.attribution_enforced === true,
  "attribution enforced in backend",
);
console.log("✓ mandatory attribution on CareEvents");

const nurse = await processSituationInput({
  raw_input: "Normal appetite observed during today's visit — eating well.",
  caregiver_id: "cg_nurse",
  timestamp: "2026-07-02T10:00:00.000Z",
});

assert(
  nurse.multi_caregiver_context_layer.caregivers.length >= 2,
  "multiple caregivers on shared recipient",
);
assert(
  nurse.multi_caregiver_context_layer.conflict_log.length >= 1,
  "conflicting perspectives preserved",
);
assert(
  nurse.multi_caregiver_context_layer.conflict_log.some(
    (c) => c.resolution_status === "preserved_both",
  ),
  "conflict is data not error",
);
console.log("✓ multi-perspective merge without overwrite");

assert(
  nurse.what_needs_clarification.every(
    (q) => !q.includes("cg_daughter") && !q.includes("cg_nurse"),
  ),
  "no contributor ids in caregiver-facing clarification",
);
assert(nurse.multi_caregiver_context_layer.shared_reality !== undefined, "shared reality layer");
assert(nurse.multi_caregiver_context_layer.attribution_internal_only === true, "privacy flag");
console.log("✓ private input / shared reality privacy");

// Locked B — one Living Care Record: ACS + CRS + CareContext share care_recipient_id
assert(
  daughter.context.care_recipient_id === "cr_shared" &&
    nurse.context.care_recipient_id === "cr_shared",
  "CareContext scoped to shared care recipient",
);
assert(
  resolveCareRecipientId("cg_daughter") === "cr_shared" &&
    resolveCareRecipientId("cg_nurse") === "cr_shared",
  "both contributors resolve to same Care Reality",
);

const sharedAcs = getActiveCareSituation("cg_nurse");
assert(sharedAcs, "nurse sees Active Care Situation");
assert(sharedAcs!.care_recipient_id === "cr_shared", "ACS keyed by care recipient");
assert(
  sharedAcs!.observations.length >= 2,
  "shared ACS holds both contributors' observations",
);
assert(
  sharedAcs!.observations.some((o) => o.contributor_id === "cg_daughter") &&
    sharedAcs!.observations.some((o) => o.contributor_id === "cg_nurse"),
  "ACS attributions for both contributors",
);
assert(
  getActiveCareSituation("cg_daughter")?.id === sharedAcs!.id,
  "daughter and nurse share one ACS id",
);

const sharedCrs = getCareRealityState("cg_nurse");
assert(sharedCrs, "shared CRS exists");
assert(
  (sharedCrs!.care_recipient_id ?? sharedCrs!.caregiver_id) === "cr_shared",
  "CRS keyed by care recipient",
);
assert(sharedCrs!.observation_count >= 2, "CRS observation count spans contributors");
console.log("✓ Locked B: one ACS/CRS/CareContext for many contributors");

const apiRoute = path.join(root, "src/app/api/situation/multi-caregiver/route.ts");
const panel = path.join(root, "src/components/ops-devtools/MultiCaregiverContextPanel.tsx");
assert(fs.existsSync(apiRoute), "multi-caregiver API route");
assert(fs.existsSync(panel), "MultiCaregiverContextPanel");
console.log("✓ API ready for future collaboration");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
assert(
  fs.readFileSync(pillarPath, "utf-8").includes("multi_caregiver_context_model"),
  "pillar #25 multi_caregiver_context_model",
);
console.log("✓ care continuity pillar registered");

assert(
  daughter.multi_caregiver_context_layer.defining_principle === MULTI_CAREGIVER_DEFINING_PRINCIPLE,
  "defining principle",
);

const traced = attachAttributionToEvents(daughter.events_created, "cg_daughter", "cr_shared")[0];
assert(traced?.source_attribution?.source_type !== undefined, "source type on attribution");
console.log("✓ traceable who / when / context");

console.log("\n=== All multi-caregiver context model checks passed ===\n");
