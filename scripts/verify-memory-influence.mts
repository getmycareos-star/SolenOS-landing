import fs from "node:fs";
import path from "node:path";
import {
  MEMORY_INFLUENCE_LAYER_FORBIDDEN,
  MEMORY_INFLUENCE_LAYER_IDENTITY,
  MEMORY_INFLUENCE_LAYER_PIPELINE_POSITION,
  MEMORY_INFERENCE_CONFIDENCE_THRESHOLD,
  MEMORY_SIGNAL_REPEAT_THRESHOLD,
  applyMemoryBehaviorWeighting,
  applyMemoryGovernanceConstraints,
  applyMemoryInfluenceGovernanceWeighting,
  computeMemoryInfluenceEnvelope,
  createDefaultMemoryInfluenceState,
  deleteAllMemoryInfluence,
  deleteMemoryEntry,
  detectMemoryInfluenceSignals,
  mergeMemoryWithModuleWeights,
  processInputForMemoryUpdate,
  processMemoryInfluenceLayer,
  readMemoryGovernanceConstraints,
  resetMemoryInfluenceStore,
  runMemorySystemGuarantee,
  tagMemoryEntry,
  toMemoryInfluenceLayerPayload,
} from "../src/lib/memory-influence";
import { computeCareContext } from "../src/lib/care-context/situational";
import { DEFAULT_SOLENOS_SETTINGS, applySettingsGovernance, mergeWithDefaultSettings } from "../src/lib/settings-governance";
import { classifyInputSurface, selectBehaviorProfile } from "../src/lib/input-classification";
import { detectUrgencyLevel } from "../src/lib/urgency-detection";
import { VERIFY_VALID_SOLENOS } from "./fixtures/solenos-valid";

console.log("=== Memory Influence Layer ===\n");

if (!MEMORY_INFLUENCE_LAYER_IDENTITY.includes("weighted inference influence")) {
  throw new Error("memory influence identity contract drift");
}
if (!MEMORY_INFLUENCE_LAYER_FORBIDDEN.some((rule) => rule.includes("Care Context"))) {
  throw new Error("memory influence must forbid merge into Care Context");
}
if (!MEMORY_INFLUENCE_LAYER_FORBIDDEN.some((rule) => rule.includes("Care Profile"))) {
  throw new Error("memory influence must forbid merge into Care Profile");
}
if (!MEMORY_INFLUENCE_LAYER_FORBIDDEN.some((rule) => rule.includes("LLM prompt"))) {
  throw new Error("memory influence must forbid LLM prompt decoration with raw memory");
}
if (!MEMORY_INFLUENCE_LAYER_PIPELINE_POSITION.includes("after Care Context")) {
  throw new Error("memory influence pipeline position must be after Care Context");
}
console.log("✓ memory influence contract constants");

if (MEMORY_SIGNAL_REPEAT_THRESHOLD !== 3) {
  throw new Error("repeat threshold must be 3");
}
if (MEMORY_INFERENCE_CONFIDENCE_THRESHOLD !== 0.75) {
  throw new Error("confidence threshold must be 0.75");
}
console.log("✓ update thresholds");

const userConfirmed = detectMemoryInfluenceSignals("I prefer brief responses please");
if (!userConfirmed.some((s) => s.userConfirmed && s.category === "identity")) {
  throw new Error("must detect user confirmed identity preference");
}
const patternSignals = detectMemoryInfluenceSignals("Mom missed her medication dose again");
if (!patternSignals.some((s) => s.category === "patterns")) {
  throw new Error("must detect pattern memory signals");
}
const operationalSignals = detectMemoryInfluenceSignals("still working on the medication refill");
if (!operationalSignals.some((s) => s.category === "operational")) {
  throw new Error("must detect operational memory signals");
}
console.log("✓ signal detection by category");

const inferenceSettings = mergeWithDefaultSettings({
  memoryControl: {
    ...DEFAULT_SOLENOS_SETTINGS.memoryControl,
    inferenceFromBehavior: true,
    emotionalMemoryWeight: 0.2,
  },
});

resetMemoryInfluenceStore();
const userId = "00000000-0000-4000-8000-000000000003";
let state = createDefaultMemoryInfluenceState(userId, inferenceSettings.memoryControl);
state = {
  ...state,
  memory: applyMemoryGovernanceConstraints(state.memory, inferenceSettings.memoryControl),
};

const confirmed = processInputForMemoryUpdate(state, "I prefer brief responses", {
  inferenceAllowed: true,
});
if (confirmed.appliedUpdates.length === 0) {
  throw new Error("USER_CONFIRMED must apply identity memory immediately");
}
if (confirmed.state.memory.identityMemory.entries.length === 0) {
  throw new Error("USER_CONFIRMED must store identity influence entry");
}
console.log("✓ USER_CONFIRMED update mode");

state = confirmed.state;
let patternState = state;
for (let i = 0; i < 2; i++) {
  const partial = processInputForMemoryUpdate(patternState, "Mom missed her medication dose", {
    inferenceAllowed: true,
  });
  patternState = partial.state;
  if (partial.appliedUpdates.length > 0) {
    throw new Error("single/double pattern occurrence must not promote to long-term memory");
  }
}
const thirdPattern = processInputForMemoryUpdate(
  patternState,
  "Mom missed her medication dose",
  { inferenceAllowed: true },
);
if (thirdPattern.state.memory.longTermPatternMemory.entries.length === 0) {
  throw new Error("REPEATED_PATTERN (3+) must store pattern influence entry");
}
console.log("✓ REPEATED_PATTERN update mode (3 occurrences)");

const operationalSeed = createDefaultMemoryInfluenceState(
  "op-user",
  inferenceSettings.memoryControl,
);
const operational = processInputForMemoryUpdate(
  {
    ...operationalSeed,
    memory: applyMemoryGovernanceConstraints(
      operationalSeed.memory,
      inferenceSettings.memoryControl,
    ),
  },
  "still working on the medication refill",
  { inferenceAllowed: true },
);
if (operational.appliedUpdates.length === 0) {
  throw new Error("HIGH_CONFIDENCE operational signal must apply on first occurrence");
}
console.log("✓ HIGH_CONFIDENCE operational bridge");

const tagged = tagMemoryEntry(
  thirdPattern.state,
  "patterns",
  thirdPattern.state.memory.longTermPatternMemory.entries[0].id,
  { outdated: true },
);
const outdatedEnvelope = computeMemoryInfluenceEnvelope(tagged.memory);
const freshEnvelope = computeMemoryInfluenceEnvelope(thirdPattern.state.memory);
if (outdatedEnvelope.patternBias >= freshEnvelope.patternBias) {
  throw new Error("outdated tag must deprioritize pattern bias");
}
console.log("✓ tagging deprioritization");

const deleted = deleteMemoryEntry(
  thirdPattern.state,
  "patterns",
  thirdPattern.state.memory.longTermPatternMemory.entries[0].id,
  "user forget request",
);
if (!deleted || deleted.state.deletionLog.length === 0) {
  throw new Error("deletion must log event and reconcile weights");
}
if (deleted.state.memory.longTermPatternMemory.entries.length !== 0) {
  throw new Error("deletion must remove influence entry");
}
console.log("✓ deletion with reconciliation log");

const fullDelete = deleteAllMemoryInfluence(confirmed.state, "user full delete");
if (!fullDelete || fullDelete.state.deletionLog.length === 0) {
  throw new Error("full delete must log reconciliation event");
}
console.log("✓ full deletion policy");

const emergencyInput = classifyInputSurface("she is not breathing call 911");
const emergencyContext = computeCareContext({
  input: "she is not breathing call 911",
  inputMode: emergencyInput.mode,
  urgencyDetection: detectUrgencyLevel("she is not breathing call 911", emergencyInput.mode),
});

const emotionalStateSeed = createDefaultMemoryInfluenceState("emo-user", {
  ...inferenceSettings.memoryControl,
  emotionalMemoryWeight: 0.2,
  inferenceFromBehavior: true,
});
let emotionalState = emotionalStateSeed;
for (let i = 0; i < 2; i++) {
  emotionalState = processInputForMemoryUpdate(
    emotionalState,
    "I feel overwhelmed and burned out",
    { inferenceAllowed: true },
  ).state;
}
const emotionalEnvelope = computeMemoryInfluenceEnvelope(
  emotionalState.memory,
  emergencyContext.context,
);
const emotionalOnly = computeMemoryInfluenceEnvelope(emotionalState.memory);
if (emotionalEnvelope.emotionalBias >= emotionalOnly.emotionalBias && emotionalOnly.emotionalBias > 0) {
  throw new Error("care context must dampen emotional memory in emergency");
}
console.log("✓ care context overrides emotional memory");

const guaranteeFail = runMemorySystemGuarantee({
  state: {
    ...createDefaultMemoryInfluenceState("guarantee-user"),
    memory: {
      ...createDefaultMemoryInfluenceState("guarantee-user").memory,
      identityMemory: {
        entries: [
          {
            id: "bad",
            key: "identity:test",
            influenceLabel: "test",
            influenceWeight: 0.9,
            confidence: 0.9,
            occurrenceCount: 1,
            tags: { outdated: false, incorrect: false, sensitive: false },
            source: "HIGH_CONFIDENCE",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    },
  },
  envelope: computeMemoryInfluenceEnvelope(createDefaultMemoryInfluenceState("guarantee-user").memory),
});
if (guaranteeFail.ok) {
  throw new Error("guarantee must reject single-instance identity memory");
}
console.log("✓ safety guarantee validation");

const constraints = readMemoryGovernanceConstraints(inferenceSettings.memoryControl);
if (constraints.memoryWeights.identity !== 0.25) {
  throw new Error("system settings must supply identity weight from MemoryControl");
}
if (constraints.memoryWeights.emotional !== 0.2) {
  throw new Error("system settings must supply emotional weight from MemoryControl");
}
console.log("✓ system settings MemoryControl constraint read");

const behavior = selectBehaviorProfile({ mode: "emotional_narrative" });
const layer = processMemoryInfluenceLayer({
  telemetry_user_id: userId,
  input: "I prefer brief responses",
  governanceSettings: inferenceSettings,
});
const weighted = applyMemoryBehaviorWeighting(behavior, layer.envelope);
if (weighted.verbosity_factor >= behavior.verbosity_factor) {
  throw new Error("identity preference influence must reduce verbosity");
}
console.log("✓ behavior profile weighting");

const governance = applySettingsGovernance(VERIFY_VALID_SOLENOS, inferenceSettings);
const merged = applyMemoryInfluenceGovernanceWeighting(governance, layer);
const mergedWeights = mergeMemoryWithModuleWeights(governance.moduleWeights, layer.envelope);
if (merged.moduleWeights.memory <= governance.moduleWeights.memory) {
  throw new Error("memory influence must adjust governance module weights");
}
if (mergedWeights.memory <= governance.moduleWeights.memory) {
  throw new Error("mergeMemoryWithModuleWeights must boost memory weight");
}
console.log("✓ governance weighting integration");

const payload = toMemoryInfluenceLayerPayload(layer);
if (payload.envelope.interpretationHints.some((h) => h.includes("Mom"))) {
  throw new Error("payload must not expose raw factual memory");
}
console.log("✓ structured layer payload");

const pipelineSource = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);

const careContextIdx = pipelineSource.indexOf("computeCareContext({");
const memoryIdx = pipelineSource.indexOf("processMemoryInfluenceLayer({");
const groundingIdx = pipelineSource.indexOf("await runPreReasoningGrounding({");
const careProfileIdx = pipelineSource.indexOf("processCareProfileLayer({");
const geminiIdx = pipelineSource.indexOf("invokeGeminiExecution({");
const memoryGovIdx = pipelineSource.indexOf("applyMemoryInfluenceGovernanceWeighting(");

if (!(careContextIdx > 0 && memoryIdx > careContextIdx && groundingIdx > memoryIdx && careProfileIdx > groundingIdx && geminiIdx > careProfileIdx)) {
  throw new Error("memory influence must run after care context, before grounding and care profile");
}
if (!pipelineSource.includes("applyMemoryInfluenceBehaviorWeighting(behaviorProfile, memoryInfluenceLayer)")) {
  throw new Error("memory influence must apply behavior weighting before LLM");
}
if (!(memoryGovIdx > geminiIdx)) {
  throw new Error("memory influence governance weighting must run post-reasoning");
}
if (pipelineSource.includes("memoryInfluenceLayer") && pipelineSource.includes("observationTags:")) {
  const obsIdx = pipelineSource.indexOf("observationTags:");
  if (obsIdx > memoryIdx && obsIdx < geminiIdx) {
    const obsBlock = pipelineSource.slice(obsIdx, obsIdx + 500);
    if (obsBlock.includes("memoryInfluence") || obsBlock.includes("interpretationHints")) {
      throw new Error("memory influence must not be passed as LLM observation tag");
    }
  }
}
console.log("✓ memory influence wired in analyze pipeline");

console.log("\n✓ Memory Influence Layer enforced");
