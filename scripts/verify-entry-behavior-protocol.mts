import "./_verify-env.mts";

/**
 * verify-entry-behavior-protocol.mts * Entry Behavior — greetings trigger State of Care, not chat.
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
import {
  ENTRY_BEHAVIOR_DEFINING_PRINCIPLE,
  ENTRY_BEHAVIOR_IDENTITY,
  classifyEntryInput,
  isSessionReentryInput,
} from "../src/lib/entry-behavior-protocol";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import {
  resetCareContextRootStore,
  processSituationInput,
} from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Entry Behavior Protocol ===\n");

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
for (const id of ["cg_entry_init", "cg_entry_re", "cg_entry_mixed"]) {
  seedVerifyConsent(id);
}

assert(ENTRY_BEHAVIOR_IDENTITY.includes("system state"), "entry behavior identity");
console.log("✓ structural contract");

const migration = path.join(root, "db/migrations/049_entry_behavior_protocol.sql");
assert(fs.existsSync(migration), "migration 049");
console.log("✓ migration 049");

assert(
  classifyEntryInput({ raw_input: "Hi SolenOS", has_documents: false }).kind ===
    "SESSION_REENTRY_EVENT",
  "greeting classified as session reentry",
);
assert(
  classifyEntryInput({ raw_input: "How are you?", has_documents: false }).kind ===
    "SESSION_REENTRY_EVENT",
  "how are you is reentry not chat",
);
assert(
  classifyEntryInput({ raw_input: "Mom fell yesterday", has_documents: false }).kind === "CARE_EVENT",
  "care semantic stays care event",
);
assert(isSessionReentryInput({ raw_input: "", has_documents: false }), "empty is reentry");
console.log("✓ input classification");

const init = await processSituationInput({
  raw_input: "Hi SolenOS",
  caregiver_id: "cg_entry_init",
});

assert(init.entry_behavior_layer?.mode === "initialization", "initialization mode when no context");
assert(init.adoption_wedge_layer?.ingestion_ready === true, "ingestion-ready wedge on init");
assert(init.events_created.length === 0, "no CareEvent on greeting");
assert(
  init.final_output.what_is_happening.includes("Forward any care-related content") ||
    init.adoption_wedge_layer?.sections.structured_summary_of_chaos.some((s) =>
      s.includes("Forward"),
    ),
  "ingestion-first prompt — no intake wizard",
);
const initOutput = JSON.stringify(init.final_output);
assert(!/^(?:hi|hello|hey)\b/i.test(init.final_output.what_is_happening), "no greeting in output");
assert(!/\bhow can i help\b/i.test(initOutput), "no chat behavior");
console.log("✓ initialization mode");

await processSituationInput({
  raw_input: "Mobility baseline: walks independently.",
  caregiver_id: "cg_entry_re",
  timestamp: "2026-07-01T10:00:00.000Z",
});

const reentry = await processSituationInput({
  raw_input: "Hello",
  caregiver_id: "cg_entry_re",
  timestamp: "2026-07-02T10:00:00.000Z",
});

assert(reentry.entry_behavior_layer?.mode === "session_reentry", "session reentry mode");
assert(reentry.events_created.length === 0, "greeting does not create CareEvent");
assert(reentry.state_of_care_summary_layer?.active === true, "returns state of care summary");
assert(reentry.entry_behavior_layer.state_reconciled === true, "state reconciled");
const reOutput = JSON.stringify(reentry.final_output);
assert(!/\b(hi|hello|hey)\b/i.test(reOutput.slice(0, 80)), "no greeting in output lead");
assert(!/\bhow can i help\b/i.test(reOutput), "no assistant chat");
console.log("✓ session reentry → state of care");

const mixed = await processSituationInput({
  raw_input: "Hi — he was confused at night",
  caregiver_id: "cg_entry_mixed",
});
assert(mixed.events_created.length >= 1, "care content creates event");
assert(mixed.entry_behavior_layer?.mode !== "session_reentry", "not treated as reentry");
console.log("✓ care semantic overrides greeting prefix");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
assert(fs.readFileSync(pillarPath, "utf-8").includes("entry_behavior_protocol"), "pillar #29");
console.log("✓ care continuity pillar registered");

assert(
  reentry.entry_behavior_layer?.defining_principle === ENTRY_BEHAVIOR_DEFINING_PRINCIPLE,
  "defining principle",
);

console.log("\n=== All entry behavior protocol checks passed ===\n");
