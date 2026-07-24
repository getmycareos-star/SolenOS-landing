/**
 * verify-behavioral-spec-v1.mts
 * Asserts Behavioral Spec v1: 5 signal categories, burnout tiers, Attention A/B/C, response shaping.
 */

import fs from "node:fs";
import path from "node:path";

import {
  ATTENTION_CLASS_A_PATTERNS,
  ATTENTION_CLASS_B_PATTERNS,
  ATTENTION_CLASS_C_PATTERNS,
  ATTENTION_CLASS_LABELS,
  ATTENTION_ENGINE_IDENTITY,
  ATTENTION_ENGINE_ONE_LINE_TRUTH,
  ATTENTION_ENGINE_PIPELINE_POSITION,
  B2B2C_FUTURE_NOTE,
  BEHAVIORAL_SPEC_ANTI_PATTERNS,
  BEHAVIORAL_SPEC_V1_PRINCIPLES,
  attentionClassToPriority,
  classifyAttention,
  classifyBurnoutTier,
  processAttentionLayer,
  shapeBehavioralResponse,
  toAttentionLayerPayload,
} from "../src/lib/attention-engine";
import {
  detectLoadSignalFamilies,
  processCaregiverLoadEngine,
  scoreLoadDimensions,
} from "../src/lib/caregiver-load-engine";
import { detectLoadSignals } from "../src/lib/load-interpretation";
import {
  BEHAVIORAL_SPEC_V1_IDENTITY,
  V14_ANTI_PATTERNS,
  V14_ENGINE_MODULES,
  V14_PIPELINE_ACTUAL_ORDER,
  V14_PRODUCT_NORTH_STAR,
} from "../src/lib/solenos-layers/architecture-map";
import type { SolenOSResponse } from "../src/lib/output-contract";
import { mapSolenOSToDecisionCard } from "../src/lib/ui-runtime";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function assertPathExists(relPath: string, label: string): void {
  const primary = relPath.split("+")[0]!.trim().split(" ")[0]!;
  const candidates = [
    path.join(root, primary),
    path.join(root, `${primary}.ts`),
    path.join(root, primary, "index.ts"),
  ];
  assert(
    candidates.some((p) => fs.existsSync(p)),
    `${label}: path missing — ${primary}`,
  );
}

console.log("=== SolenOS Behavioral Specification v1 ===\n");

assert(ATTENTION_ENGINE_IDENTITY.includes("Attention Engine"), "identity");
assert(ATTENTION_ENGINE_ONE_LINE_TRUTH.includes("What matters now"), "one-line truth");
assert(
  ATTENTION_ENGINE_PIPELINE_POSITION.includes("ATTENTION ENGINE"),
  "pipeline position",
);
assert(BEHAVIORAL_SPEC_V1_PRINCIPLES.length >= 5, "behavioral principles");
assert(BEHAVIORAL_SPEC_ANTI_PATTERNS.some((p) => p.includes("dementia")), "anti-patterns");
assert(B2B2C_FUTURE_NOTE.includes("B2B2C"), "B2B2C future note");
assert(BEHAVIORAL_SPEC_V1_IDENTITY.includes("caregiver overload"), "architecture identity");
assert(V14_PRODUCT_NORTH_STAR.includes("attention prioritization"), "north star");
assert(
  V14_ANTI_PATTERNS.some((p) => p.includes("caregiver overload")),
  "architecture anti-patterns",
);
console.log("✓ contract constants + Behavioral Spec identity");

const attentionMod = V14_ENGINE_MODULES.find((m) => m.spec.includes("Attention Engine"));
assert(attentionMod?.status === "implemented", "architecture map lists Attention Engine");
assertPathExists("src/lib/attention-engine", "Attention Engine path");
assert(
  V14_PIPELINE_ACTUAL_ORDER.some((s) => s.includes("Attention Engine")),
  "pipeline order includes Attention Engine",
);
console.log("✓ architecture map + pipeline order");

assert(Object.keys(ATTENTION_CLASS_A_PATTERNS).length >= 3, "Class A pattern groups");
assert(Object.keys(ATTENTION_CLASS_B_PATTERNS).length >= 2, "Class B pattern groups");
assert(Object.keys(ATTENTION_CLASS_C_PATTERNS).length >= 2, "Class C pattern groups");
assert(ATTENTION_CLASS_LABELS.A.includes("needs attention now"), "Class A label");
assert(ATTENTION_CLASS_LABELS.B.includes("Not urgent"), "Class B label");
assert(ATTENTION_CLASS_LABELS.C.includes("Can wait"), "Class C label");
assert(attentionClassToPriority("A") === "Now", "A → Now");
assert(attentionClassToPriority("B") === "Watch", "B → Watch");
assert(attentionClassToPriority("C") === "Later", "C → Later");
console.log("✓ attention labels + priority mapping");

// Signal → score (5 categories)
const multiLoad =
  "He asks the same thing every five minutes. I haven't slept — calls all night. He was yelling. I don't know if this is serious. I can't leave him alone.";
const families = detectLoadSignalFamilies(multiLoad);
const scores = scoreLoadDimensions(families);
assert(families.repetition >= 0.3 || families.matchedFamilies.includes("repetition") || scores.cognitiveLoadScore >= 20, "repetition load");
assert(families.sleep >= 0.35 || scores.sleepRiskScore >= 30, "sleep load");
assert(families.emotionalDistress >= 0.35 || scores.emotionalLoadScore >= 30, "emotional load");
assert(families.uncertainty >= 0.3 || scores.uncertaintyIndex >= 0.25, "uncertainty load");
assert(scores.dependencyLoadScore >= 20 || families.supervision >= 0.3, "dependency load");
const loadInterp = detectLoadSignals(multiLoad);
assert(
  loadInterp.matchedCategories.length >= 2 ||
    loadInterp.cognitiveLoad >= 0.35 ||
    loadInterp.sleepRisk >= 0.35,
  "load-interpretation patterns cover categories",
);
console.log("✓ signal → score (5 categories + dependency)");

// Burnout tiers
assert(classifyBurnoutTier(0.1) === "Low", "Low tier");
assert(classifyBurnoutTier(0.4) === "Moderate", "Moderate tier");
assert(classifyBurnoutTier(0.6) === "High", "High tier");
assert(classifyBurnoutTier(0.8) === "Critical", "Critical tier");
assert(classifyBurnoutTier(0.2, true) === "Critical", "acute → Critical");
const engine = processCaregiverLoadEngine({ rawInput: multiLoad });
assert(
  ["Low", "Moderate", "High", "Critical"].includes(engine.state.burnout.tier),
  "engine burnout tier",
);
console.log("✓ burnout tiers Low|Moderate|High|Critical");

const urgencyLow = {
  risk_level: "low" as const,
  critical_signals: [] as string[],
  high_signals: [] as string[],
  detection_method: "default" as const,
};
const urgencyCritical = {
  risk_level: "critical" as const,
  critical_signals: ["not breathing"],
  high_signals: [] as string[],
  detection_method: "rule_match" as const,
};

// Class A
const classAInput =
  "He wandered outside last night and I found him confused. Sudden change overnight — acute confusion.";
const aEngine = processCaregiverLoadEngine({ rawInput: classAInput });
const classA = classifyAttention({
  rawInput: classAInput,
  urgencyDetection: urgencyCritical,
  scores: aEngine.state.scores,
  signals: aEngine.state.signals,
  safetyOverrideEngaged: true,
});
assert(classA.attentionClass === "A", "Class A from safety/wandering");
assert(classA.attentionPriority === "Now", "Class A → Now");
assert(classA.label.includes("needs attention now"), "Class A label text");
console.log("✓ Class A — Needs Attention Now");

// Class B
const classBInput =
  "He keeps asking the same question over and over. Getting worse each week. Not an emergency.";
const bEngine = processCaregiverLoadEngine({ rawInput: classBInput });
const classB = classifyAttention({
  rawInput: classBInput,
  urgencyDetection: urgencyLow,
  scores: bEngine.state.scores,
  signals: bEngine.state.signals,
});
assert(classB.attentionClass === "B", "Class B from repetition / gradual change");
assert(classB.attentionPriority === "Watch", "Class B → Watch");
console.log("✓ Class B — Monitor / Watch");

// Class C
const classCInput =
  "Just a general question about a routine appointment next week. Nothing urgent, can wait.";
const cEngine = processCaregiverLoadEngine({ rawInput: classCInput });
const classC = classifyAttention({
  rawInput: classCInput,
  urgencyDetection: urgencyLow,
  scores: cEngine.state.scores,
  signals: cEngine.state.signals,
});
assert(classC.attentionClass === "C", "Class C from routine / can wait");
assert(classC.attentionPriority === "Later", "Class C → Later");
console.log("✓ Class C — Can Wait");

// Response shaping
const tipResponse: SolenOSResponse = {
  what_is_happening: "Understanding dementia: five tips for caregivers",
  what_matters_now: "Try these dementia care techniques",
  what_to_ask_next: "1 tips for medication education",
  what_can_wait: "Research later",
  risk_level: "low",
};
const shaped = shapeBehavioralResponse({
  response: tipResponse,
  classification: classB,
  scores: bEngine.state.scores,
  signals: bEngine.state.signals,
  suppressEducation: true,
  loadSignalsPresent: true,
});
assert(
  shaped.what_is_happening.toLowerCase().includes("repetition") ||
    shaped.what_is_happening.toLowerCase().includes("load") ||
    shaped.what_is_happening.toLowerCase().includes("fatigue"),
  "response framing is load-aware",
);
assert(!/five tips for caregivers/i.test(shaped.what_is_happening), "suppresses education lead");
assert(shaped.what_matters_now.includes("Pay attention") || shaped.what_matters_now.includes("Watch") || shaped.what_matters_now.includes("Not urgent"), "attention lead in what_matters_now");
console.log("✓ response shaping (load-aware, suppress education)");

const attentionResult = processAttentionLayer({
  rawInput: classAInput,
  urgencyDetection: urgencyCritical,
  caregiverLoadEngine: aEngine,
  safetyOverrideEngaged: true,
});
const payload = toAttentionLayerPayload(attentionResult);
assert(payload.attentionClass === "A", "payload class");
assert(payload.attentionPriority === "Now", "payload priority");
assert(payload.burnoutTier.length > 0, "payload burnout tier");
console.log("✓ attention layer process + payload");

const card = mapSolenOSToDecisionCard({
  situationId: "s1",
  response: shaped,
  attentionPriority: "Now",
  attentionLabel: "This needs attention now.",
  attentionClass: "A",
  burnoutTier: "High",
});
assert(card.attentionPriority === "Now", "DecisionCard attentionPriority");
assert(card.whatMattersNow.includes("Now"), "DecisionCard surfaces Now");
assert(card.burnoutTier === "High", "DecisionCard burnoutTier");
console.log("✓ Decision Surface Now/Watch/Later mapping");

const pipelineSource = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf-8",
);
assert(pipelineSource.includes("processAttentionLayer"), "pipeline wires attention");
assert(pipelineSource.includes("attention_layer"), "pipeline exposes attention_layer");
assert(pipelineSource.includes("shapeBehavioralResponse"), "pipeline shapes behavioral response");
const loadEngineIdx = pipelineSource.indexOf("processCaregiverLoadEngine(");
const attentionIdx = pipelineSource.indexOf("processAttentionLayer(");
const priorityIdx = pipelineSource.indexOf("processPriorityEngineLayer(");
assert(
  loadEngineIdx > 0 && attentionIdx > loadEngineIdx && attentionIdx < priorityIdx,
  "order: load engine → attention → priority",
);
console.log("✓ pipeline wiring (load → attention → priority)");

console.log("\n✓ Behavioral Specification v1 verified");
