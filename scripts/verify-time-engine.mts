import fs from "node:fs";
import path from "node:path";
import {
  TIME_ENGINE_LAYER_FORBIDDEN,
  TIME_ENGINE_LAYER_IDENTITY,
  TIME_ENGINE_LAYER_ONE_LINE_TRUTH,
  TIME_ENGINE_LAYER_PIPELINE_POSITION,
  URGENCY_DECAY_LAMBDA,
  HORIZON_HOURS,
  UNSCHEDULED_TEMPORAL_LABEL,
  applyDecayToUrgency,
  applyTimeEngineBehaviorWeighting,
  applyTimeEngineGovernanceWeighting,
  buildHorizonBlend,
  classifyHorizonFromHours,
  classifyTemporalInput,
  computeDependencyBoost,
  computeUrgencyDecay,
  DEFAULT_TIME_ENGINE,
  extractTimeInputSignals,
  formatTimeEngineObservation,
  processTimeEngineLayer,
  readTimeEngineFromSettings,
  resolveMemoryTimeOverride,
  resolveTimeConflict,
  runTimeEngineGuarantee,
  toTimeEngineLayerPayload,
} from "../src/lib/time-engine";
import {
  DEFAULT_SOLENOS_SETTINGS,
  applySettingsGovernance,
  mergeWithDefaultSettings,
} from "../src/lib/settings-governance";
import { createDefaultMemoryInfluenceState } from "../src/lib/memory-influence";
import { DEFAULT_CARE_PROFILE } from "../src/lib/care-profile";
import { computeCareContext } from "../src/lib/care-context/situational";
import { classifyInputSurface, selectBehaviorProfile } from "../src/lib/input-classification";
import { detectUrgencyLevel } from "../src/lib/urgency-detection";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Time Engine Layer ===\n");

if (!TIME_ENGINE_LAYER_IDENTITY.includes("priority weight")) {
  throw new Error("time engine identity contract drift");
}
if (!TIME_ENGINE_LAYER_ONE_LINE_TRUTH.includes("never schedules")) {
  throw new Error("time engine one-line truth must forbid scheduling");
}
if (!TIME_ENGINE_LAYER_FORBIDDEN.some((r) => r.includes("reminders"))) {
  throw new Error("time engine must forbid reminders");
}
if (!TIME_ENGINE_LAYER_FORBIDDEN.some((r) => r.includes("raw timestamps"))) {
  throw new Error("time engine must forbid raw timestamps as LLM facts");
}
if (!TIME_ENGINE_LAYER_PIPELINE_POSITION.includes("before Priority")) {
  throw new Error("time engine pipeline position must be before Priority Engine");
}
console.log("✓ time engine contract constants");

if (URGENCY_DECAY_LAMBDA !== 0.08) {
  throw new Error("decay λ must be 0.08");
}
if (HORIZON_HOURS.NOW_MAX !== 4 || HORIZON_HOURS.TODAY_MAX !== 24 || HORIZON_HOURS.SOON_MAX !== 72) {
  throw new Error("horizon hours must be 0–4 / 4–24 / 1–3 days");
}
console.log("✓ horizon bounds and decay λ");

const decay0 = computeUrgencyDecay(0);
if (Math.abs(decay0 - 1) > 1e-9) {
  throw new Error("decay at t=0 must be 1");
}
const decay10 = computeUrgencyDecay(10);
const expected = Math.exp(-URGENCY_DECAY_LAMBDA * 10);
if (Math.abs(decay10 - expected) > 1e-9) {
  throw new Error("urgencyDecay must equal Math.exp(-λ * timeDelta)");
}
const decayed = applyDecayToUrgency(0.95, 10);
if (decayed >= 0.95) {
  throw new Error("decay must reduce urgency without reinforcement");
}
console.log("✓ urgency decay function");

const missing = extractTimeInputSignals("Mom seems tired and I am unsure what to do");
if (!missing.missingTime) {
  throw new Error("input without time must set missingTime");
}
const explicit = extractTimeInputSignals("Appointment at 3:00pm tomorrow");
if (!explicit.explicitTime && !explicit.relativeTime) {
  throw new Error("must extract explicit or relative time");
}
if (explicit.missingTime) {
  throw new Error("timed input must not be missingTime");
}
const relative = extractTimeInputSignals("Need help within 2 hours for medication");
if (!relative.relativeTime) {
  throw new Error("must extract relative time");
}
console.log("✓ time signal extraction");

if (classifyHorizonFromHours(1) !== "NOW") throw new Error("1h → NOW");
if (classifyHorizonFromHours(8) !== "TODAY") throw new Error("8h → TODAY");
if (classifyHorizonFromHours(48) !== "SOON") throw new Error("48h → SOON");
if (classifyHorizonFromHours(100) !== "LATER") throw new Error("100h → LATER");
console.log("✓ horizon classification");

const unscheduled = classifyTemporalInput({
  signals: { missingTime: true },
  engine: DEFAULT_TIME_ENGINE,
});
if (unscheduled.kind !== "unscheduled" || unscheduled.state.label !== UNSCHEDULED_TEMPORAL_LABEL) {
  throw new Error("missing time must produce UNSCHEDULED TEMPORAL STATE");
}
if (unscheduled.state.urgencyScore !== 0) {
  throw new Error("unscheduled must not assume urgency");
}
console.log("✓ missing time rule");

const nowClassified = classifyTemporalInput({
  signals: extractTimeInputSignals("Need this right now for the dose"),
  engine: DEFAULT_TIME_ENGINE,
});
if (nowClassified.kind !== "classified" || nowClassified.classification.horizon !== "NOW") {
  throw new Error("right now must classify as NOW");
}
console.log("✓ NOW classification");

const strictBlend = buildHorizonBlend("TODAY", 0.7, true);
if (strictBlend !== undefined) {
  throw new Error("strictTimeHorizonMode must not emit hybrid blends");
}
const openBlend = buildHorizonBlend("TODAY", 0.7, false);
if (!openBlend || !openBlend.TODAY || !openBlend.NOW || !openBlend.SOON) {
  throw new Error("non-strict mode must allow blended urgency signals");
}
console.log("✓ strictTimeHorizonMode enforcement");

const settings = mergeWithDefaultSettings({
  timeControl: {
    ...DEFAULT_SOLENOS_SETTINGS.timeControl,
    strictTimeHorizonMode: true,
    timezoneDetection: true,
  },
});
const engineFromSettings = readTimeEngineFromSettings(settings);
if (!engineFromSettings.strictTimeHorizonMode) {
  throw new Error("time engine must read strictTimeHorizonMode from settings");
}
if (engineFromSettings.timeHorizonModel.NOW !== settings.timeControl.timeHorizonModel.NOW) {
  throw new Error("time engine must read timeHorizonModel from resolved settings");
}
console.log("✓ settings integration (read-only)");

const careCtx = computeCareContext({
  input: "Need medication within 1 hour urgently",
  inputMode: "crisis_urgent",
  urgencyDetection: detectUrgencyLevel("Need medication within 1 hour urgently", "crisis_urgent"),
});
const profile = {
  ...DEFAULT_CARE_PROFILE,
  timeSensitivity: "morning" as const,
  conditionSignals: { medicationReminders: true, mobilityAssistance: false },
};
const memState = createDefaultMemoryInfluenceState("00000000-0000-4000-8000-000000000099");
memState.memory.longTermPatternMemory.entries.push({
  id: "p1",
  key: "medication_missed_recurring",
  influenceLabel: "recurring medication adherence friction",
  influenceWeight: 0.6,
  confidence: 0.8,
  occurrenceCount: 3,
  tags: { outdated: false, incorrect: false, sensitive: false },
  source: "REPEATED_PATTERN",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
const memEnvelope = {
  identityBias: 0,
  patternBias: 0.4,
  operationalBias: 0.3,
  emotionalBias: 0.2,
  compositeInfluence: 0.35,
  interpretationHints: ["pattern bias"],
};

const override = resolveMemoryTimeOverride({
  temporal: nowClassified,
  memoryState: memState,
  memoryEnvelope: memEnvelope,
});
if (!override || override.visibleClassification === undefined) {
  throw new Error("memory override must keep visible classification");
}
const conflict = resolveTimeConflict({
  signals: extractTimeInputSignals("Need this right now for the dose"),
  memoryOverride: override,
});
if (!conflict?.explicitPreferred || !conflict.uncertaintyFlagged) {
  throw new Error("explicit input must prefer over memory and flag uncertainty");
}
const depBoost = computeDependencyBoost({
  careProfile: profile,
  memoryEnvelope: memEnvelope,
  emotionalBias: 0.2,
});
if (depBoost <= 0) {
  throw new Error("timeSensitivity + medication dependency must boost dependencyBoost");
}
console.log("✓ memory override + dependency boost");

const layer = processTimeEngineLayer({
  input: "Need medication within 2 hours",
  governanceSettings: settings,
  careProfile: profile,
  careContext: careCtx.context,
  memoryState: memState,
  memoryEnvelope: memEnvelope,
  urgencyDetection: detectUrgencyLevel("Need medication within 2 hours", "crisis_urgent"),
});
if (!layer.guarantee.ok) {
  throw new Error(`time engine guarantee failed: ${layer.guarantee.violations.join("; ")}`);
}
if (layer.prioritySignal.activeHorizon === "UNSCHEDULED") {
  throw new Error("timed input must not be UNSCHEDULED");
}
if (layer.prioritySignal.strictMode && layer.prioritySignal.blendedHorizons) {
  throw new Error("strict mode layer must not blend");
}
const observation = formatTimeEngineObservation(layer);
if (observation.includes("3:00") || observation.includes("timestamp=")) {
  throw new Error("observation must not pass raw timestamps as facts");
}
if (!observation.includes("time_horizon=")) {
  throw new Error("observation must use classification envelope");
}
console.log("✓ processTimeEngineLayer + observation envelope");

const missingLayer = processTimeEngineLayer({
  input: "Things feel heavy and I am unsure what matters",
  governanceSettings: DEFAULT_SOLENOS_SETTINGS,
});
if (!missingLayer.signals.missingTime) {
  throw new Error("missing time case failed");
}
if (missingLayer.prioritySignal.urgencyScore !== 0) {
  throw new Error("missing time must not hallucinate urgency");
}
const missingGuarantee = runTimeEngineGuarantee({
  signals: missingLayer.signals,
  temporal: missingLayer.temporal,
  prioritySignal: missingLayer.prioritySignal,
});
if (!missingGuarantee.ok) {
  throw new Error(`missing-time guarantee failed: ${missingGuarantee.violations.join("; ")}`);
}
console.log("✓ system guarantee (no urgency hallucination)");

const classification = classifyInputSurface("Need medication within 2 hours");
let behavior = selectBehaviorProfile(classification);
behavior = applyTimeEngineBehaviorWeighting(behavior, layer);
const governance = applyTimeEngineGovernanceWeighting(
  applySettingsGovernance(VERIFY_VALID_SOLENOS, settings, {
    validatedRiskLevel: VERIFY_VALID_SOLENOS.risk_level,
  }),
  layer,
);
if (governance.moduleWeights.time <= 0) {
  throw new Error("time module weight must remain positive after time engine merge");
}
const payload = toTimeEngineLayerPayload(layer);
if (payload.missingTime) {
  throw new Error("payload missingTime mismatch");
}
console.log("✓ behavior + governance weighting");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
const memoryIdx = pipelineSource.indexOf("processMemoryInfluenceLayer(");
const careProfileIdx = pipelineSource.indexOf("processCareProfileLayer(");
const timeIdx = pipelineSource.indexOf("processTimeEngineLayer(");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");
if (!(memoryIdx > 0 && careProfileIdx > memoryIdx && timeIdx > careProfileIdx && timeIdx < geminiIdx)) {
  throw new Error(
    "pipeline order must be memory → care profile → time engine → generation (before priority)",
  );
}
if (!pipelineSource.includes("formatTimeEngineObservation")) {
  throw new Error("pipeline must pass time engine observation envelope (not raw timestamps)");
}
if (!pipelineSource.includes("applyTimeEngineGovernanceWeighting")) {
  throw new Error("pipeline must apply time engine governance weighting");
}
console.log("✓ analyze-pipeline wiring");

console.log("\n✓ Time Engine Layer verified");
