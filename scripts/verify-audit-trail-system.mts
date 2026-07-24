/**
 * verify-audit-trail-system.mts
 * Audit Trail — immutable append-only log on every CareContext write.
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
import {
  AUDIT_IMMUTABILITY_RULES,
  AUDIT_TRAIL_DEFINING_PRINCIPLE,
  AUDIT_TRAIL_IDENTITY,
  getAuditLog,
  processAuditTrail,
  replayCareContextAt,
  resetAuditTrailStore,
  traceRecommendationToInputs,
} from "../src/lib/audit-trail-system";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Audit Trail System ===\n");

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

assert(AUDIT_TRAIL_IDENTITY.includes("history of how"), "audit trail identity");
assert(AUDIT_IMMUTABILITY_RULES.includes("append_only"), "immutability rules");
console.log("✓ audit trail contract");

const migration = path.join(root, "db/migrations/046_audit_trail_system.sql");
assert(fs.existsSync(migration), "migration 046");
console.log("✓ migration 046");

const result = await processSituationInput({
  raw_input: "Mobility baseline: walks independently.",
  caregiver_id: "cg_audit",
  timestamp: "2026-07-01T10:00:00.000Z",
});

assert(result.audit_trail_layer !== undefined, "audit layer on SituationResponse");
assert(result.audit_trail_layer.replayable === true, "replayable audit log");
assert(getAuditLog().length >= 1, "audit entry on CareContext write");
console.log("✓ mandatory audit on write");

const eventId = result.events_created[0]?.id;
assert(eventId !== undefined, "event created");
const trace = traceRecommendationToInputs(eventId, result.context.care_recipient_id);
assert(trace.length >= 1, "trace recommendation to inputs");
console.log("✓ traceability");

const replay = replayCareContextAt(result.context.care_recipient_id, "2026-07-02T10:00:00.000Z");
assert(replay.entries.length >= 1, "replay entries");
assert(replay.entity_states.size >= 1, "reconstruct state at timestamp");
console.log("✓ event sourcing replay");

const entry = getAuditLog()[0]!;
assert(entry.previous_state !== undefined, "previous_state field exists");
assert(entry.actor.id.length > 0, "actor attribution");
assert(entry.reason.length > 0, "reason required");
console.log("✓ full AuditEntry model");

const apiRoute = path.join(root, "src/app/api/situation/audit-trail/route.ts");
const panel = path.join(root, "src/components/ops-devtools/AuditTrailPanel.tsx");
assert(fs.existsSync(apiRoute), "audit-trail API route");
assert(fs.existsSync(panel), "AuditTrailPanel");
console.log("✓ API and internal UI");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
assert(fs.readFileSync(pillarPath, "utf-8").includes("audit_trail_system"), "pillar #26");
console.log("✓ care continuity pillar registered");

assert(result.audit_trail_layer.defining_principle === AUDIT_TRAIL_DEFINING_PRINCIPLE, "defining principle");

console.log("\n=== All audit trail system checks passed ===\n");
