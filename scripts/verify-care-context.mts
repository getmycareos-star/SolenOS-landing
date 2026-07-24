import fs from "node:fs";
import path from "node:path";
import {
  CARE_CONTEXT_INTENT_CONFIDENCE_THRESHOLD,
  CARE_CONTEXT_LAYER_FORBIDDEN,
  CARE_CONTEXT_LAYER_IDENTITY,
  CARE_CONTEXT_LAYER_PIPELINE_POSITION,
  SITUATION_TYPES,
  applyCareContextBehaviorWeighting,
  applyCareContextGovernanceWeighting,
  computeCareContext,
  computeCareContextWeightEnvelope,
  formatSituationalCareContextObservation,
  mergeCareContextWithModuleWeights,
  mergeRecentEventsBuffer,
  runCareContextSystemGuarantee,
  toCareContextLayerPayload,
  validateCareContextAgainstProfile,
} from "../src/lib/care-context/situational";
import { DEFAULT_CARE_PROFILE } from "../src/lib/care-profile";
import { DEFAULT_SOLENOS_SETTINGS, applySettingsGovernance } from "../src/lib/settings-governance";
import { classifyInputSurface, selectBehaviorProfile } from "../src/lib/input-classification";
import { detectUrgencyLevel } from "../src/lib/urgency-detection";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Situational Care Context Layer ===\n");

if (!CARE_CONTEXT_LAYER_IDENTITY.includes("per-interaction situational")) {
  throw new Error("care context identity contract drift");
}
if (!CARE_CONTEXT_LAYER_FORBIDDEN.some((rule) => rule.includes("Care Profile"))) {
  throw new Error("care context must forbid merge into Care Profile");
}
if (!CARE_CONTEXT_LAYER_FORBIDDEN.some((rule) => rule.includes("persistence across sessions"))) {
  throw new Error("care context must forbid cross-session persistence");
}
if (!CARE_CONTEXT_LAYER_PIPELINE_POSITION.includes("before Care Profile")) {
  throw new Error("care context pipeline position must be before Care Profile");
}
console.log("✓ care context contract constants");

if (SITUATION_TYPES.length !== 6) {
  throw new Error("must define exactly 6 situation types");
}
if (CARE_CONTEXT_INTENT_CONFIDENCE_THRESHOLD !== 0.6) {
  throw new Error("intent confidence threshold must be 0.6");
}
console.log("✓ situation types and intent threshold");

const emergencyInput = classifyInputSurface("she is not breathing call 911");
const emergency = computeCareContext({
  input: "she is not breathing call 911",
  inputMode: emergencyInput.mode,
  urgencyDetection: detectUrgencyLevel("she is not breathing call 911", emergencyInput.mode),
});
if (emergency.context.situationType !== "emergency") {
  throw new Error("critical input must classify as emergency situation");
}
if (emergency.context.urgencyLevel !== "CRITICAL") {
  throw new Error("emergency must have CRITICAL urgency");
}
if (!emergency.guarantee.ok) {
  throw new Error(`emergency guarantee failed: ${emergency.guarantee.violations.join("; ")}`);
}
console.log("✓ emergency → CRITICAL urgency");

const adminInput = classifyInputSurface(
  "Help me submit the insurance benefits form before the deadline next week",
);
const admin = computeCareContext({
  input: "Help me submit the insurance benefits form before the deadline next week",
  inputMode: adminInput.mode,
  urgencyDetection: detectUrgencyLevel(
    "Help me submit the insurance benefits form before the deadline next week",
    adminInput.mode,
  ),
});
if (admin.context.situationType !== "administrative") {
  throw new Error("insurance paperwork must classify as administrative");
}
if (admin.context.environmentSignals.timePressure !== "medium") {
  throw new Error("deadline input must detect medium time pressure");
}
console.log("✓ administrative situation and time pressure");

const uncertain = computeCareContext({
  input: "not sure what to do",
  inputMode: "emotional_narrative",
  urgencyDetection: detectUrgencyLevel("not sure what to do", "emotional_narrative"),
});
if (uncertain.context.situationType !== "uncertain_state") {
  throw new Error("low-confidence input must be uncertain_state");
}
if (uncertain.context.userIntentSignal.confidence >= CARE_CONTEXT_INTENT_CONFIDENCE_THRESHOLD) {
  throw new Error("vague input must have confidence below threshold");
}
const uncertainObs = formatSituationalCareContextObservation(uncertain.context);
if (!uncertainObs.includes("low confidence")) {
  throw new Error("low confidence must appear in observation tag");
}
console.log("✓ intent confidence threshold 0.6 → uncertain context");

const highPressure = computeCareContext({
  input: "On the phone — need answer immediately about hospital discharge paperwork",
  inputMode: "emotional_narrative",
  urgencyDetection: detectUrgencyLevel(
    "On the phone — need answer immediately about hospital discharge paperwork",
    "emotional_narrative",
  ),
});
const highPressureEnvelope = computeCareContextWeightEnvelope(highPressure.context);
const lowPressureEnvelope = computeCareContextWeightEnvelope({
  ...highPressure.context,
  environmentSignals: {
    ...highPressure.context.environmentSignals,
    timePressure: "none",
    interruptionRisk: "low",
    locationContext: "home",
  },
});
if (highPressureEnvelope.compressionFactor >= lowPressureEnvelope.compressionFactor) {
  throw new Error("HIGH time pressure must compress output more than none");
}
if (highPressureEnvelope.stepReduction <= 0) {
  throw new Error("HIGH interruption risk must reduce steps");
}
const unknownLocationEnvelope = computeCareContextWeightEnvelope({
  ...highPressure.context,
  environmentSignals: {
    ...highPressure.context.environmentSignals,
    locationContext: "unknown",
  },
});
if (unknownLocationEnvelope.uncertaintyWeight <= lowPressureEnvelope.uncertaintyWeight) {
  throw new Error("unknown location must increase uncertainty weighting");
}
console.log("✓ environment signal weighting behavior");

const bufferA = mergeRecentEventsBuffer(["prior_event"], ["event_a"]);
const bufferB = mergeRecentEventsBuffer(bufferA, ["event_a", "event_b"]);
if (bufferB.length !== 3 || bufferB[0] !== "prior_event") {
  throw new Error("recent events buffer must dedupe within request scope");
}
if (mergeRecentEventsBuffer(undefined, ["a", "b", "c", "d", "e", "f"]).length > 5) {
  throw new Error("recent events buffer must cap at max size");
}
console.log("✓ ephemeral recent events buffer");

const profileValidation = validateCareContextAgainstProfile(emergency.context, DEFAULT_CARE_PROFILE);
if (!profileValidation.ok) {
  throw new Error("valid emergency context must pass profile cross-validation");
}
console.log("✓ care context validated against care profile without identity merge");

const behavior = selectBehaviorProfile({ mode: "emotional_narrative" });
const weighted = applyCareContextBehaviorWeighting(behavior, highPressure);
if (weighted.verbosity_factor >= behavior.verbosity_factor) {
  throw new Error("high-pressure context must reduce verbosity");
}
console.log("✓ behavior profile weighting");

const governance = applySettingsGovernance(VERIFY_VALID_SOLENOS, DEFAULT_SOLENOS_SETTINGS);
const merged = applyCareContextGovernanceWeighting(governance, emergency);
const mergedWeights = mergeCareContextWithModuleWeights(governance.moduleWeights, emergency.envelope);
if (merged.moduleWeights.priority <= governance.moduleWeights.priority) {
  throw new Error("care context must boost priority module weight under high urgency");
}
if (mergedWeights.priority <= governance.moduleWeights.priority) {
  throw new Error("mergeCareContextWithModuleWeights must boost priority");
}
console.log("✓ governance weighting integration");

const payload = toCareContextLayerPayload(emergency);
if (payload.situationType !== "emergency" || !payload.envelope) {
  throw new Error("toCareContextLayerPayload must expose situational snapshot");
}
console.log("✓ layer payload serialization");

const guaranteeFail = runCareContextSystemGuarantee({
  context: { ...emergency.context, urgencyLevel: "LOW" },
  envelopeApplied: true,
  intentThresholdChecked: true,
});
if (guaranteeFail.ok) {
  throw new Error("guarantee must reject emergency with LOW urgency");
}
console.log("✓ system guarantee validation");

const situationalSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/care-context/situational/compute-care-context.ts"),
  "utf-8",
);
if (
  situationalSource.includes("setUserCareProfileState") ||
  situationalSource.includes("persistCareContext") ||
  situationalSource.includes("saveCareContext")
) {
  throw new Error("situational care context must not persist state");
}
if (situationalSource.includes("CareProfile")) {
  throw new Error("compute-care-context must not import Care Profile types");
}

const profileSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/care-profile/types.ts"),
  "utf-8",
);
if (profileSource.includes("SituationalCareContext") || profileSource.includes("situationType")) {
  throw new Error("Care Profile types must not include situational care context fields");
}
console.log("✓ separation from Care Profile module");

const settingsSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/settings-governance/types.ts"),
  "utf-8",
);
const situationalIndex = fs.readFileSync(
  path.join(process.cwd(), "src/lib/care-context/situational/index.ts"),
  "utf-8",
);
if (situationalIndex.includes("seedProfileFromSettingsCareContext")) {
  throw new Error("situational care context must not bridge settings careContext");
}
console.log("✓ separation from settings-governance careContext");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);

const clarityIdx = pipelineSource.indexOf("processInputClarityGate(");
const urgencyIdx = pipelineSource.indexOf("detectUrgencyLevel(");
const careContextIdx = pipelineSource.indexOf("computeCareContext({");
const careProfileIdx = pipelineSource.indexOf("processCareProfileLayer({");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");

if (!(clarityIdx > 0 && urgencyIdx > clarityIdx && careContextIdx > urgencyIdx && careProfileIdx > careContextIdx && geminiIdx > careProfileIdx)) {
  throw new Error(
    "care context must run after clarity gate and urgency, before care profile and LLM",
  );
}
if (!pipelineSource.includes("applyCareContextBehaviorWeighting(behaviorProfile, situationalCareContext)")) {
  throw new Error("care context must apply behavior weighting before LLM");
}
if (!pipelineSource.includes("applyCareContextGovernanceWeighting(")) {
  throw new Error("care context must apply governance weighting post-reasoning");
}
if (!pipelineSource.includes("formatSituationalCareContextObservation")) {
  throw new Error("care context observation must reach LLM envelope");
}
if (!pipelineSource.includes("care_context_layer: toCareContextLayerPayload")) {
  throw new Error("pipeline must expose ephemeral care_context_layer payload");
}
if (pipelineSource.includes("setCareContext") || pipelineSource.includes("persistCareContext")) {
  throw new Error("pipeline must not persist situational care context");
}
console.log("✓ care context wired in analyze pipeline");

console.log("\n✓ Situational Care Context Layer enforced");
