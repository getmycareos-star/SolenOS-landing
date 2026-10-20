/**
 * verify-runtime-arbitration.mts
 * Priority Resolution + Event Store + Engine Contract + Edge State + Confidence Calibration.
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
import { seedVerifyConsent } from "../src/lib/policy-engine";
import {
  OUTPUT_MODE_PRIORITY,
  resolveDominantOutputMode,
} from "../src/lib/priority-resolution-system";
import {
  classifyEdgeState,
  EDGE_STATES,
  STALE_THRESHOLD_DAYS,
} from "../src/lib/edge-state-machine";
import {
  computeEventConfidence,
  CONFIDENCE_FLOOR,
  processConfidenceCalibration,
  SOURCE_TYPE_WEIGHTS,
} from "../src/lib/confidence-calibration-system";
import {
  appendEvent,
  getEventStream,
  processEventSourcedStorage,
  rebuildProjection,
  resetDerivedTables,
  resetEventStore,
  resetProjectionStore,
  resetSessionStore,
} from "../src/lib/event-sourced-storage";
import {
  assertEmitOnly,
  MUTATION_AUTHORITY,
  processEngineExecutionContract,
  REGISTERED_ENGINE_CONTRACTS,
} from "../src/lib/engine-execution-contract";
import {
  resetCareContextRootStore,
  processSituationInput,
  processSessionReentry,
} from "../src/lib/situation-entry";
import { recordSessionVisit, resetRetentionSessionStore } from "../src/lib/retention-engine";

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
  resetEventStore();
  resetProjectionStore();
  resetSessionStore();
  resetDerivedTables();
}

console.log("=== SolenOS Runtime Arbitration Core ===\n");

assert(OUTPUT_MODE_PRIORITY[0] === "crisis_mode", "crisis highest");
assert(OUTPUT_MODE_PRIORITY[OUTPUT_MODE_PRIORITY.length - 1] === "clarification_mode", "clarification lowest");
assert(EDGE_STATES.includes("stale"), "stale edge state");
assert(MUTATION_AUTHORITY === "emit_only", "emit only");
assert(REGISTERED_ENGINE_CONTRACTS.length >= 8, "engine contracts registered");
console.log("✓ contracts");

for (const mig of [
  "063_priority_resolution_system.sql",
  "064_event_sourced_storage.sql",
  "065_engine_execution_contract.sql",
  "066_edge_state_machine.sql",
  "067_confidence_calibration_system.sql",
]) {
  assert(fs.existsSync(path.join(root, "db/migrations", mig)), mig);
}
console.log("✓ migrations 063–067");

// Priority determinism
const crisisMode = resolveDominantOutputMode({
  crisis_detected: true,
  no_care_context: true,
  is_first_interaction: true,
  is_session_reentry: true,
  is_return_session: true,
  has_care_context: true,
  clarification_required: true,
  insufficient_data_for_inference: true,
  has_meaningful_change: true,
});
assert(crisisMode.dominant_mode === "crisis_mode", "crisis overrides all");

const first60 = resolveDominantOutputMode({
  crisis_detected: false,
  no_care_context: true,
  is_first_interaction: true,
  is_session_reentry: false,
  is_return_session: false,
  has_care_context: false,
  clarification_required: false,
  insufficient_data_for_inference: false,
  has_meaningful_change: false,
});
assert(first60.dominant_mode === "first_60s_value_loop", "first 60s for empty context");

const returnMode = resolveDominantOutputMode({
  crisis_detected: false,
  no_care_context: false,
  is_first_interaction: false,
  is_session_reentry: true,
  is_return_session: true,
  has_care_context: true,
  clarification_required: false,
  insufficient_data_for_inference: false,
  has_meaningful_change: true,
});
assert(returnMode.dominant_mode === "return_value_loop", "return loop");
assert(returnMode.suppressed_modes.includes("clarification_mode"), "single mode — others suppressed");
console.log("✓ priority resolution — single dominant mode");

// Edge states
const stale = classifyEdgeState({
  crisis_detected: false,
  unresolved_contradictions: 0,
  event_count: 5,
  days_since_last_event: STALE_THRESHOLD_DAYS + 1,
  continuity_decay_pct: 80,
  missing_critical_fields: 0,
  low_confidence_aggregate: false,
});
assert(stale.edge_state === "stale", "stale classification");
assert(stale.output_restrictions.allow_strong_conclusions === false, "stale blocks strong claims");

const conflict = classifyEdgeState({
  crisis_detected: false,
  unresolved_contradictions: 2,
  event_count: 5,
  days_since_last_event: 1,
  continuity_decay_pct: 70,
  missing_critical_fields: 0,
  low_confidence_aggregate: false,
});
assert(conflict.edge_state === "conflict", "conflict mode");
assert(conflict.output_restrictions.require_conflict_surface === true, "must surface conflict");
console.log("✓ edge state machine");

// Event store append-only + projection rebuild
appendEvent({
  event_id: "e1",
  care_recipient_id: "cr_arb",
  caregiver_id: "cg_arb",
  raw_observation: "Mom ate breakfast",
  normalized_type: "observation",
  source_id: "cg_arb",
  confidence: 0.8,
  timestamp: "2026-06-01T08:00:00.000Z",
  linked_entities: ["Mom"],
});
const stream = getEventStream("cr_arb");
assert(stream.length === 1, "event appended");
const proj = rebuildProjection({ care_recipient_id: "cr_arb" });
assert(proj.rebuilt_from_event_count === 1, "projection from events");
assert(proj.event_ids[0] === "e1", "projection includes event");
console.log("✓ event-sourced storage — projection rebuildable");

// Engine contract mutation block
assert(assertEmitOnly("care_event_engine", true) !== null, "mutation blocked");
const contract = processEngineExecutionContract({ attempted_mutations: [] });
assert(contract.contract_valid === true, "valid when no mutations");
const bad = processEngineExecutionContract({ attempted_mutations: ["rogue_engine"] });
assert(bad.contract_valid === false, "invalid when mutation attempted");
console.log("✓ engine execution contract — emit only");

// Confidence calibration
const obs = computeEventConfidence({
  event_id: "e1",
  source_type: "caregiver_direct_observation",
  is_observation: true,
  age_ms: 0,
  high_risk_context: false,
  contradicted: false,
  confirmation_count: 0,
  missing_critical_fields: 0,
});
const inf = computeEventConfidence({
  event_id: "e2",
  source_type: "system_inference",
  is_observation: false,
  age_ms: 0,
  high_risk_context: false,
  contradicted: false,
  confirmation_count: 0,
  missing_critical_fields: 0,
});
assert(obs.score > inf.score, "observations dominate inference");
assert(obs.score >= CONFIDENCE_FLOOR, "above floor");
assert(SOURCE_TYPE_WEIGHTS.medical_professional > SOURCE_TYPE_WEIGHTS.unverified_input, "source weights");

const contradicted = computeEventConfidence({
  event_id: "e3",
  source_type: "caregiver_direct_observation",
  is_observation: true,
  age_ms: 0,
  high_risk_context: false,
  contradicted: true,
  confirmation_count: 0,
  missing_critical_fields: 0,
});
assert(contradicted.score < obs.score, "contradiction reduces confidence");

const aged = computeEventConfidence({
  event_id: "e4",
  source_type: "caregiver_direct_observation",
  is_observation: true,
  age_ms: 60 * 24 * 60 * 60 * 1000,
  high_risk_context: false,
  contradicted: false,
  confirmation_count: 0,
  missing_critical_fields: 0,
});
assert(aged.score < obs.score, "recency decay reduces confidence");

const sameA = processConfidenceCalibration({
  events: [
    {
      event_id: "x",
      source_type: "caregiver_direct_observation",
      is_observation: true,
      age_ms: 1000,
      high_risk_context: false,
      contradicted: false,
      confirmation_count: 1,
      missing_critical_fields: 0,
    },
  ],
});
const sameB = processConfidenceCalibration({
  events: [
    {
      event_id: "x",
      source_type: "caregiver_direct_observation",
      is_observation: true,
      age_ms: 1000,
      high_risk_context: false,
      contradicted: false,
      confirmation_count: 1,
      missing_critical_fields: 0,
    },
  ],
});
assert(
  sameA.aggregate_confidence === sameB.aggregate_confidence,
  "deterministic confidence",
);
console.log("✓ confidence calibration");

// Pipeline integration
resetAll();
const caregiverId = "cg_runtime_arb";
seedVerifyConsent(caregiverId);

const init = await processSessionReentry({
  caregiver_id: caregiverId,
  raw_input: "hello",
  timestamp: "2026-06-01T10:00:00.000Z",
});
assert(init.priority_resolution_layer?.dominant_mode === "first_60s_value_loop", "init → first 60s");
assert(init.edge_state_layer?.edge_state === "bootstrap", "bootstrap edge");
console.log("✓ pipeline bootstrap / first 60s");

const first = await processSituationInput({
  raw_input: "Mom refused breakfast this morning and seemed confused.",
  caregiver_id: caregiverId,
  timestamp: "2026-06-01T11:00:00.000Z",
});
assert(first.priority_resolution_layer !== undefined, "priority layer on response");
assert(first.event_sourced_storage_layer?.event_count >= 1, "events in store");
assert(first.engine_execution_contract_layer?.mutation_authority === "emit_only", "emit only in pipeline");
assert(first.confidence_calibration_layer?.active === true, "confidence calibrated");
console.log("✓ pipeline care event arbitration");

recordSessionVisit({
  caregiver_id: caregiverId,
  care_recipient_id: first.context.care_recipient_id,
  event_count: first.context.events.length,
  context_updated_at: first.context.updated_at,
  visited_at: "2026-06-01T12:00:00.000Z",
});

await processSituationInput({
  raw_input: "Appetite still low this afternoon.",
  caregiver_id: caregiverId,
  timestamp: "2026-06-03T14:00:00.000Z",
});

const reentry = await processSessionReentry({
  caregiver_id: caregiverId,
  raw_input: "hi",
  timestamp: "2026-06-05T10:00:00.000Z",
});
assert(
  reentry.priority_resolution_layer?.dominant_mode === "return_value_loop" ||
    reentry.priority_resolution_layer?.dominant_mode === "state_of_care_summary",
  "reentry selects return or state — not first 60s",
);
assert(
  reentry.priority_resolution_layer?.dominant_mode !== "first_60s_value_loop",
  "returning user does not get onboarding mode",
);
console.log("✓ pipeline return path — no mode mixing");

// Storage sync via processEventSourcedStorage
const storage = processEventSourcedStorage({
  care_recipient_id: "cr_rebuild",
  caregiver_id: "cg_rebuild",
  events: [
    {
      id: "r1",
      raw_input: "Sleep improved after routine change",
      extracted_type: "observation",
      ingestion_time: "2026-06-01T08:00:00.000Z",
      entities: [{ label: "Mom" }],
      uncertainty: [],
    },
  ],
});
assert(storage.can_rebuild_projection === true, "rebuildable");
assert(storage.mutation_blocked === true, "mutation blocked flag");
console.log("✓ storage process path");

console.log("\n=== Runtime Arbitration: ALL CHECKS PASSED ===\n");
