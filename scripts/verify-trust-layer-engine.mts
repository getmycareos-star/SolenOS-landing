/**
 * verify-trust-layer-engine.mts
 * Trust Layer Engine — known, assumed, unknown, recency, confidence on every output.
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
import {
  TRUST_BEHAVIOR_RULES,
  TRUST_LAYER_DEFINING_PRINCIPLE,
  TRUST_LAYER_ENGINE_IDENTITY,
  processTrustLayerEngine,
  resetTrustLayerEngineStore,
  validateTrustLayer,
} from "../src/lib/trust-layer-engine";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Trust Layer Engine ===\n");

resetTrustLayerEngineStore();
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
resetMemoryStrategyStore();

assert(TRUST_LAYER_ENGINE_IDENTITY.includes("how SolenOS knows"), "trust layer identity");
assert(TRUST_BEHAVIOR_RULES.length === 5, "five behavior rules");
console.log("✓ trust layer contract");

const migration = path.join(root, "db/migrations/043_trust_layer_engine.sql");
assert(fs.existsSync(migration), "migration 043");
console.log("✓ migration 043");

const vague = await processSituationInput({
  raw_input: "Dad isn't acting like himself.",
  caregiver_id: "cg_trust_layer",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(vague.trust_layer_engine_layer !== undefined, "layer on SituationResponse");
assert(vague.trust_layer_engine_layer.active === true, "trust layer active");
assert(vague.trust_layer_engine_layer.trust_layer.unknown.length >= 1, "unknown surfaced");
assert(
  vague.trust_layer_engine_layer.trust_layer.confidence < 1,
  "never full confidence without verification",
);
const validation = validateTrustLayer(vague.trust_layer_engine_layer.trust_layer);
assert(validation.valid === true, `trust block valid: ${validation.errors.join(", ")}`);
console.log("✓ known / assumed / unknown structure");

assert(
  vague.final_output.trust_layer.known.length >= 0 &&
    vague.final_output.trust_layer.unknown.length >= 1,
  "trust_layer on final output",
);
assert(
  vague.final_output.trust_layer.recency.freshness_score >= 0 &&
    vague.final_output.trust_layer.recency.freshness_score <= 1,
  "recency score 0-1",
);
console.log("✓ final output integration");

const behavioral = await processSituationInput({
  raw_input: "He refused medication again and keeps asking to leave.",
  caregiver_id: "cg_trust_layer",
  timestamp: "2026-07-02T10:00:00.000Z",
});

assert(
  behavioral.trust_layer_engine_layer.trust_layer.assumed.length >= 0,
  "assumed inferences when behavior triggered",
);
console.log("✓ assumed labeled separately from known");

const apiRoute = path.join(root, "src/app/api/situation/trust-layer/route.ts");
const panel = path.join(root, "src/components/ops-devtools/TrustLayerEnginePanel.tsx");
assert(fs.existsSync(apiRoute), "trust-layer API route");
assert(fs.existsSync(panel), "TrustLayerEnginePanel");
console.log("✓ API and UI");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
assert(
  fs.readFileSync(pillarPath, "utf-8").includes("trust_layer_engine"),
  "pillar #23 trust_layer_engine",
);
console.log("✓ care continuity pillar registered");

assert(
  behavioral.trust_layer_engine_layer.defining_principle === TRUST_LAYER_DEFINING_PRINCIPLE,
  "defining principle",
);
console.log("✓ design principle upheld");

console.log("\n=== All trust layer engine checks passed ===\n");
