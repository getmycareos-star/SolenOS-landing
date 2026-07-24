import "./_verify-env.mts";

/**
 * verify-policy-engine.mts
 * Policy Engine — runtime consent, medical boundary, privacy partition, output constraints.
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
  ONE_LINE_USER_AGREEMENT,
  POLICY_CAPTURE_ALWAYS_PRINCIPLE,
  POLICY_ENGINE_DEFINING_PRINCIPLE,
  POLICY_ENGINE_IDENTITY,
  applyPolicyToFinalOutput,
  detectMedicalAdviceRequest,
  evaluateDataUseRules,
  hasValidConsent,
  recordConsentAcceptance,
  resetPolicyEngineStore,
  sanitizeMedicalBoundary,
  scanAttributionLeakage,
  validateIngestionPolicy,
} from "../src/lib/policy-engine";
import { resetCareContextRootStore, processSituationInput } from "../src/lib/situation-entry";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== solenos Policy Engine ===\n");

resetPolicyEngineStore();
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

assert(POLICY_ENGINE_IDENTITY.includes("execution constraints"), "policy identity");
assert(ONE_LINE_USER_AGREEMENT.includes("not a medical service"), "one-line agreement");
assert(POLICY_ENGINE_DEFINING_PRINCIPLE.includes("Capture always"), "capture-always defining principle");
assert(POLICY_CAPTURE_ALWAYS_PRINCIPLE.includes("Always persist raw input"), "capture principle");
console.log("✓ structural contract");

assert(fs.existsSync(path.join(root, "db/migrations/055_policy_engine.sql")), "migration 055");
console.log("✓ migration 055");

const blocked = validateIngestionPolicy({
  user_id: "cg_policy_blocked",
  raw_input: "Mom fell yesterday",
  has_documents: false,
});
assert(blocked.allowed === true, "capture always allowed without consent");
assert(blocked.consent_required, "consent soft-prompt required flag");
assert(blocked.interpretation_gated === true, "interpretation gated without consent");
assert(blocked.sharing_gated === true, "sharing gated without consent");
assert(blocked.blocked_reason === null, "no hard block reason");
assert(
  (blocked.soft_consent_prompt ?? "").includes("preserved"),
  "soft consent prompt after capture",
);

recordConsentAcceptance({
  user_id: "cg_policy_ok",
  accepted_terms_version: "2026-07-15",
  medical_disclaimer_acknowledged: true,
  privacy_model_acknowledged: true,
  multi_caregiver_acknowledged: true,
  data_improvement_consent: false,
  no_advertising_acknowledged: true,
});
assert(hasValidConsent("cg_policy_ok"), "consent recorded");
console.log("✓ consent manager — capture always, soft-prompt when missing");

assert(detectMedicalAdviceRequest("What medication should I give her?"), "flags medical advice request");
assert(detectMedicalAdviceRequest("Is this serious?"), "flags worry/seriousness question");
assert(detectMedicalAdviceRequest("Should I change the medication?"), "flags med-change question");
assert(!detectMedicalAdviceRequest("What should I do?"), "bare overwhelm not flagged as medical advice");

const adviceFlagged = validateIngestionPolicy({
  user_id: "cg_policy_ok",
  raw_input: "Mom fell. Is this serious? Should I change her meds?",
  has_documents: false,
});
assert(adviceFlagged.allowed, "worry + med-change still allows ingestion");
assert(adviceFlagged.medical_advice_request, "flags medical concern for output constraints");
assert(adviceFlagged.blocked_reason === null, "no block reason when consented");

const prescribeFlagged = validateIngestionPolicy({
  user_id: "cg_policy_ok",
  raw_input: "What medication should I give her?",
  has_documents: false,
});
assert(prescribeFlagged.allowed, "clinical question still allows capture");
assert(prescribeFlagged.medical_advice_request, "clinical question flagged for output guard");
console.log("✓ medical boundary — capture always, constrain outputs");

assert(scanAttributionLeakage("Caregiver Jane said she fell").length > 0, "attribution scan");
const sanitized = sanitizeMedicalBoundary("You have diabetes and should treat with insulin");
assert(sanitized.includes("observation"), "medical sanitize");
console.log("✓ output constraints");

const strictDataUse = evaluateDataUseRules("cg_policy_ok");
assert(!strictDataUse.improvement_allowed, "no improvement without opt-in");
console.log("✓ data use rules");

const withoutConsent = await processSituationInput({
  raw_input: "Mobility baseline recorded.",
  caregiver_id: "cg_policy_no_consent",
});
assert(withoutConsent.events_created.length >= 1, "CareEvent created without consent (capture always)");
assert(withoutConsent.policy_engine_layer?.consent_required === true, "consent soft-prompt after capture");
assert(
  withoutConsent.policy_engine_layer?.ingestion?.interpretation_gated === true,
  "interpretation gated until consent",
);
assert(
  (withoutConsent.final_output.what_can_wait ?? "").toLowerCase().includes("preserved") ||
    (withoutConsent.final_output.follow_up_items ?? []).some((i) => /privacy terms/i.test(i)),
  "soft consent prompt surfaces after capture",
);
console.log("✓ pipeline captures without consent and soft-prompts");

recordConsentAcceptance({
  user_id: "cg_policy_ingest",
  accepted_terms_version: "2026-07-15",
  medical_disclaimer_acknowledged: true,
  privacy_model_acknowledged: true,
  multi_caregiver_acknowledged: true,
  data_improvement_consent: true,
  no_advertising_acknowledged: true,
});

const ingested = await processSituationInput({
  raw_input: "Blood sugar spike reported last night.",
  caregiver_id: "cg_policy_ingest",
  timestamp: "2026-07-01T10:00:00.000Z",
});
assert(ingested.events_created.length >= 1, "CareEvent after consent");
assert(ingested.policy_engine_layer?.consent_verified === true, "consent verified on ingest");
console.log("✓ pipeline allows with consent");

const worried = await processSituationInput({
  raw_input:
    "Mom fell yesterday and I'm scared. Is this serious? Should I change her medication? What should I do?",
  caregiver_id: "cg_policy_ingest",
  timestamp: "2026-07-01T11:00:00.000Z",
});
assert(worried.events_created.length >= 1, "worry + med-change still creates CareEvents");
assert(
  worried.policy_engine_layer?.ingestion?.medical_advice_request === true,
  "medical concern flagged on ingest layer",
);
assert(
  !/\b(you should (?:give|prescribe|stop|change)|prescribe (?:her|him|them)|take this (?:pill|dose|medication))\b/i.test(
    `${worried.final_output.what_to_ask_next} ${worried.final_output.what_matters_now}`,
  ),
  "output does not prescribe or instruct medication changes",
);
console.log("✓ mixed overwhelm + medical concern enters the record");

const constrained = applyPolicyToFinalOutput("cg_policy_ingest", ingested.final_output);
assert(constrained.decision_trace.unknowns.length > 0, "uncertainty preserved in output");
console.log("✓ final output policy pass");

const pillarPath = path.join(root, "src/lib/care-continuity-system/contract-constants.ts");
assert(fs.readFileSync(pillarPath, "utf-8").includes("policy_engine"), "pillar policy_engine");
assert(
  ingested.policy_engine_layer?.defining_principle === POLICY_ENGINE_DEFINING_PRINCIPLE,
  "defining principle",
);

console.log("\n=== All policy engine checks passed ===\n");
