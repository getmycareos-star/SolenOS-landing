/**
 * verify-conflict-detection.mts
 * Asserts Conflict Detection Engine v1.8: types, severity, heuristics, registry,
 * single clarification, belief/decision integration, MVP gaps.
 */

import fs from "node:fs";
import path from "node:path";
import {
  CONFLICT_CLARIFICATION_HEADLINE,
  CONFLICT_DETECTION_LAYER_FORBIDDEN,
  CONFLICT_DETECTION_LAYER_IDENTITY,
  CONFLICT_DETECTION_LAYER_ONE_LINE_TRUTH,
  CONFLICT_DETECTION_LAYER_PIPELINE_POSITION,
  CONFLICT_SEVERITY_CONFIDENCE_REDUCTION,
  CONFLICT_TYPES,
  applyConflictBeliefConfidenceReduction,
  detectConflictsFromText,
  formatConflictDetectionObservation,
  getConflictRegistry,
  hasCriticalMedicalRestriction,
  processConflictDetection,
  resetConflictRegistryStore,
  resolveConflictFromUserResponse,
  selectPrimaryClarification,
  toConflictClarificationView,
  toConflictDetectionLayerPayload,
} from "../src/lib/conflict-detection";
import { computeBeliefInfluence } from "../src/lib/solenos-layers/belief";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Conflict Detection Engine (v1.8) ===\n");

assert(
  CONFLICT_DETECTION_LAYER_IDENTITY.includes("coexist"),
  "identity must ask whether facts can coexist",
);
assert(
  CONFLICT_DETECTION_LAYER_ONE_LINE_TRUTH.includes("Belief"),
  "one-line truth must reference Belief confidence",
);
assert(
  CONFLICT_DETECTION_LAYER_PIPELINE_POSITION.includes("Memory"),
  "pipeline must sit after Memory",
);
assert(
  CONFLICT_DETECTION_LAYER_PIPELINE_POSITION.includes("Decision"),
  "pipeline must sit before Decision",
);
assert(
  CONFLICT_DETECTION_LAYER_FORBIDDEN.some((f) => /17 conflicts/i.test(f)),
  "must forbid conflict-count dumps",
);
assert(
  CONFLICT_DETECTION_LAYER_FORBIDDEN.some((f) => /clustering/i.test(f)),
  "MVP must forbid clustering / auto-recon / source reliability",
);
assert(CONFLICT_TYPES.length === 5, "five conflict types");
assert(CONFLICT_SEVERITY_CONFIDENCE_REDUCTION.LOW === 0, "LOW: no decision impact");
assert(CONFLICT_SEVERITY_CONFIDENCE_REDUCTION.CRITICAL > 0, "CRITICAL reduces confidence");
console.log("✓ contract constants + severity reductions");

resetConflictRegistryStore();

// Spec example 1 — primary caregiver vs sister manages meds
const ex1 = detectConflictsFromText({
  memoryStatements: ["Primary caregiver: David"],
  newInput: "My sister manages all medications.",
});
assert(ex1.length >= 1, "example 1 must detect conflict");
assert(
  ex1.some(
    (c) =>
      c.type === "responsibility_conflict" || c.type === "fact_conflict",
  ),
  "example 1 type",
);
console.log("✓ example 1: caregiver / medication ownership conflict");

// Spec example 2 — lives alone + home health aide = NO conflict
const ex2 = detectConflictsFromText({
  memoryStatements: ["Lives alone."],
  newInput: "Home health aide visits daily.",
});
assert(ex2.length === 0, "example 2 must NOT conflict (both can be true)");
console.log("✓ example 2: coexistence (no false positive)");

// Spec example 3 — medication supply vs refill
const ex3 = detectConflictsFromText({
  memoryStatements: ["Medication supply ends Friday."],
  newInput: "We already picked up a 90-day refill.",
});
assert(ex3.some((c) => c.type === "timeline_conflict"), "example 3 timeline conflict");
assert(ex3.some((c) => c.severity === "HIGH" || c.severity === "CRITICAL"), "example 3 severity");
console.log("✓ example 3: refill timeline conflict");

// Medical CRITICAL
const med = detectConflictsFromText({
  memoryStatements: ["Blood thinner discontinued."],
  newInput: "Blood thinner active.",
});
assert(med.some((c) => c.type === "medical_conflict"), "medical type");
assert(med.every((c) => c.type !== "medical_conflict" || c.severity === "CRITICAL"), "medical CRITICAL");
assert(hasCriticalMedicalRestriction(med), "CRITICAL medical restricts decisions");
console.log("✓ medical CRITICAL restriction");

// Housing fact conflict
const housing = detectConflictsFromText({
  memoryStatements: ["Lives alone."],
  newInput: "Lives with daughter.",
});
assert(housing.some((c) => c.type === "fact_conflict"), "housing fact conflict");
console.log("✓ fact conflict: living arrangement");

// Preference
const pref = detectConflictsFromText({
  memoryStatements: ["Parent wants to remain home."],
  newInput: "Children insist on assisted living.",
});
assert(pref.some((c) => c.type === "preference_conflict"), "preference conflict");
console.log("✓ preference conflict");

// Process layer + registry + ONE clarification
resetConflictRegistryStore();
const layer = processConflictDetection({
  scopeId: "verify-conflict-user",
  userInput: "Blood thinner active. My sister manages all medications.",
  memoryLabels: [
    "Blood thinner discontinued.",
    "Primary caregiver: David",
  ],
});
assert(layer.registry.openConflicts.length >= 1, "registry open conflicts");
assert(layer.envelope.clarification != null, "must surface one clarification");
assert(
  layer.envelope.clarification!.headline === CONFLICT_CLARIFICATION_HEADLINE,
  "headline",
);
assert(
  !/conflicts detected/i.test(layer.envelope.clarification!.question),
  "clarification must not be a count dump",
);
const obs = formatConflictDetectionObservation(layer);
assert(!/\d+\s+conflicts detected/i.test(obs), "observation must not dump counts");
assert(layer.criticalDecisionRestricted === true, "medical CRITICAL blocks decisions");
assert(layer.totalConfidenceReduction > 0, "confidence reduction");

const primary = selectPrimaryClarification(layer.registry);
assert(primary?.conflictId === layer.envelope.clarification?.conflictId, "primary matches");
const view = toConflictClarificationView(toConflictDetectionLayerPayload(layer));
assert(view?.question === primary?.question, "view-model single question");
console.log("✓ registry + single clarification UI contract");

// Resolution flow
const resolved = resolveConflictFromUserResponse({
  scopeId: "verify-conflict-user",
  conflictId: layer.envelope.clarification!.conflictId,
  userResponse: "Still taking / active",
  onUpdateMemory: () => {
    /* Memory update hook exercised */
  },
});
assert(
  resolved.openConflicts.every((c) => c.id !== layer.envelope.clarification!.conflictId),
  "resolved removed from open",
);
assert(
  resolved.resolvedConflicts.some((c) => c.id === layer.envelope.clarification!.conflictId),
  "moved to resolved",
);
console.log("✓ resolution flow: user response → mark resolved");

// Belief confidence lowering
const lowered = applyConflictBeliefConfidenceReduction(
  [{ content: "Blood thinner discontinued.", confidence: 0.9 }],
  med,
);
assert(lowered[0]!.confidence < 0.9, "belief confidence drops on conflict");
const influence = computeBeliefInfluence(
  [
    {
      id: "b1",
      situationId: "s1",
      type: "assumption",
      content: "Blood thinner discontinued.",
      confidence: 0.9,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
  {
    confidencePenalty: layer.envelope.confidencePenalty,
    criticalDecisionRestricted: true,
    clarificationQuestion: layer.envelope.clarification?.question,
  },
);
assert(influence.criticalConflictBlocked === true, "belief influence CRITICAL blocked");
assert(influence.conflictConfidencePenalty > 0, "conflict penalty on influence");
assert(
  influence.needsNext[0] === layer.envelope.clarification?.question ||
    influence.needsNext.includes(layer.envelope.clarification!.question),
  "clarification appears in needsNext",
);
console.log("✓ Belief Layer confidence modulation");

// Caregiver load contribution
assert(layer.envelope.conflictLoadContribution > 0, "feeds conflict load");
console.log("✓ Caregiver Load conflictLoad contribution");

// Pipeline wiring (analyze + core-runtime)
const analyzeSrc = fs.readFileSync(
  path.join(process.cwd(), "src/lib/analyze-pipeline/index.ts"),
  "utf8",
);
assert(analyzeSrc.includes("processConflictDetection"), "analyze wires conflict detection");
assert(analyzeSrc.includes("earlyConflictDetection"), "analyze runs conflict before CLI");
assert(analyzeSrc.includes("criticalDecisionRestricted"), "analyze surfaces CRITICAL gate");
assert(analyzeSrc.includes("conflictBelief"), "analyze feeds Belief/Priority");

const orchSrc = fs.readFileSync(
  path.join(process.cwd(), "src/lib/core-runtime/orchestrate.ts"),
  "utf8",
);
assert(orchSrc.includes("processConflictDetection"), "core-runtime wires conflict");
assert(orchSrc.includes("criticalConflictBlocked"), "core-runtime CRITICAL gate");
console.log("✓ analyze-pipeline + core-runtime wiring");

// Module files exist
const mod = path.join(process.cwd(), "src/lib/conflict-detection");
for (const f of [
  "types.ts",
  "detect.ts",
  "registry.ts",
  "clarification.ts",
  "influence.ts",
  "resolve.ts",
  "process.ts",
  "view-model.ts",
  "index.ts",
]) {
  assert(fs.existsSync(path.join(mod, f)), `missing ${f}`);
}
console.log("✓ module file surface");

// Registry still scoped after resolve
const after = getConflictRegistry("verify-conflict-user");
assert(after.resolvedConflicts.length >= 1, "persisted resolved in operational registry");

console.log("\nAll Conflict Detection Engine checks passed.");
