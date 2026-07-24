/**
 * verify-caregiver-expansion.mts
 * Confidence + Crisis Prevention + Delegation layers (DERIVED, post-decision).
 */

import fs from "node:fs";
import path from "node:path";
import {
  CONFIDENCE_LAYER_PIPELINE_POSITION,
  processConfidenceLayer,
  toConfidenceLayerPayload,
} from "../src/lib/confidence-layer";
import {
  CRISIS_PREVENTION_LAYER_PIPELINE_POSITION,
  processCrisisPreventionLayer,
  toCrisisPreventionLayerPayload,
} from "../src/lib/crisis-prevention-layer";
import {
  DELEGATION_LAYER_PIPELINE_POSITION,
  processDelegationLayer,
  toDelegationLayerPayload,
} from "../src/lib/delegation-layer";
import {
  computeConfidenceState,
  computeCrisisRisks,
  computeDelegationSuggestions,
  LAYER_ARCHITECTURE_MAP,
} from "../src/lib/solenos-layers";
import type { Demand } from "../src/lib/demand-engine/types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const root = process.cwd();
const pipelineSrc = fs.readFileSync(
  path.join(root, "src/lib/analyze-pipeline/index.ts"),
  "utf8",
);

console.log("=== SolenOS Caregiver Expansion (Confidence / Crisis / Delegation) ===\n");

assert(
  CONFIDENCE_LAYER_PIPELINE_POSITION.includes("Crisis Prevention"),
  "confidence pipeline must follow crisis prevention",
);
assert(
  CONFIDENCE_LAYER_PIPELINE_POSITION.includes("Human Trust"),
  "confidence pipeline must precede human trust",
);
assert(
  CRISIS_PREVENTION_LAYER_PIPELINE_POSITION.includes("Fail-Safe"),
  "crisis prevention must follow fail-safe",
);
assert(
  DELEGATION_LAYER_PIPELINE_POSITION.includes("Confidence"),
  "delegation must follow confidence",
);
console.log("✓ pipeline position contracts");

assert(
  LAYER_ARCHITECTURE_MAP.DERIVED.owns.some((o) => o.includes("computeConfidenceState")),
  "DERIVED must own computeConfidenceState",
);
assert(
  LAYER_ARCHITECTURE_MAP.DERIVED.facadeModules.includes("confidence-layer"),
  "architecture map must list confidence-layer facade",
);
assert(
  LAYER_ARCHITECTURE_MAP.DERIVED.facadeModules.includes("crisis-prevention-layer"),
  "architecture map must list crisis-prevention-layer facade",
);
assert(
  LAYER_ARCHITECTURE_MAP.DERIVED.facadeModules.includes("delegation-layer"),
  "architecture map must list delegation-layer facade",
);
console.log("✓ layered architecture ownership");

const medDemand: Demand = {
  id: "demand-med-refill",
  situationId: "sit-med",
  title: "Medication refill pickup",
  description: "Pharmacy refill for evening dose",
  category: "medical",
  status: "pending",
  urgency: 55,
  riskImpact: 75,
  effort: 20,
  emotionalLoad: 30,
  uncertainty: 40,
  pressureScore: 58,
  dueDate: new Date(Date.now() + 40 * 60 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
};

const crisis = computeCrisisRisks({
  demands: [medDemand],
  activeSituations: [{ id: "sit-med", title: "Medication management", status: "ACTIVE" }],
  beliefs: [],
  caregiverLoadState: "MODERATE",
});
assert(crisis.length >= 1, "medication demand must produce crisis risk");
assert(crisis[0].probability > 0 && crisis[0].probability <= 1, "probability in 0-1");
assert(crisis[0].explanation.includes("refill") || crisis[0].explanation.includes("Medication"), "plain English crisis explanation");
assert(!crisis[0].explanation.includes("Priority score"), "no priority jargon in crisis explanation");
console.log("✓ crisis prevention — medication refill example");

const confident = computeConfidenceState({
  demands: [medDemand],
  activeSituations: [{ id: "sit-med", title: "Medication", status: "ACTIVE", priority: "MEDIUM" }],
  beliefs: [],
  caregiverLoadState: "LOW",
  crisisRisks: crisis,
});
assert(confident.confidence >= 0 && confident.confidence <= 100, "confidence 0-100");
assert(confident.explanation.length > 10, "confidence explanation non-empty");
assert(!confident.explanation.includes("Priority score"), "no priority jargon in confidence");

const confidentWithCrisis = computeConfidenceState({
  demands: [medDemand],
  activeSituations: [{ id: "sit-med", title: "Medication", status: "ACTIVE", priority: "HIGH" }],
  beliefs: [{ id: "b1", situationId: "sit-med", type: "missing_information", content: "dose?", confidence: 0.3, status: "active", importance: "HIGH", createdAt: new Date().toISOString() }],
  caregiverLoadState: "HIGH",
  crisisRisks: crisis,
  openConflictCount: 2,
  conflictConfidencePenalty: 0.2,
});
assert(
  confidentWithCrisis.confidence < confident.confidence,
  "crisis + load + conflict must decrease confidence",
);
console.log("✓ confidence layer — crisis feeds confidence decrease");

const delegationLow = computeDelegationSuggestions({
  demands: [medDemand],
  ownershipEvals: [{
    demandId: medDemand.id,
    situationId: medDemand.situationId,
    ownershipState: "unassigned",
    ownerIds: [],
    ownerNames: [],
    pressureScore: medDemand.pressureScore,
    highPressure: false,
    criticalUnassigned: false,
  }],
  persons: [
    { id: "p1", name: "Primary caregiver", role: "primary_caregiver", relationship: "self" },
    { id: "p2", name: "Sarah", role: "shared_caregiver", relationship: "daughter" },
  ],
  loads: [
    { personId: "p1", activeResponsibilities: 5, highPressureResponsibilities: 3, loadScore: 9, overloaded: true },
    { personId: "p2", activeResponsibilities: 1, highPressureResponsibilities: 0, loadScore: 1, overloaded: false },
  ],
  caregiverLoadState: "LOW",
});
assert(delegationLow.length === 0, "delegation empty when load not elevated");

const delegationHigh = computeDelegationSuggestions({
  demands: [medDemand],
  ownershipEvals: [{
    demandId: medDemand.id,
    situationId: medDemand.situationId,
    ownershipState: "unassigned",
    ownerIds: [],
    ownerNames: [],
    pressureScore: medDemand.pressureScore,
    highPressure: false,
    criticalUnassigned: false,
  }],
  persons: [
    { id: "p1", name: "Primary caregiver", role: "primary_caregiver", relationship: "self" },
    { id: "p2", name: "Sarah", role: "shared_caregiver", relationship: "daughter" },
  ],
  loads: [
    { personId: "p1", activeResponsibilities: 5, highPressureResponsibilities: 3, loadScore: 9, overloaded: true },
    { personId: "p2", activeResponsibilities: 1, highPressureResponsibilities: 0, loadScore: 1, overloaded: false },
  ],
  caregiverLoadState: "HIGH",
  primaryCaregiverName: "Primary caregiver",
  sharedCaregivers: ["Sarah"],
});
assert(delegationHigh.length >= 1, "delegation suggests when load HIGH");
assert(delegationHigh[0].recommendedPerson === "Sarah", "delegation picks lower-load person");
assert(delegationHigh[0].task.includes("refill") || delegationHigh[0].task.includes("Medication"), "delegation names task");
console.log("✓ delegation layer — Sarah medication pickup example");

const crisisLayer = processCrisisPreventionLayer({
  demands: [medDemand],
  activeSituations: [{ id: "sit-med", title: "Medication", status: "ACTIVE" }],
  beliefs: [],
  caregiverLoadState: "MODERATE",
});
const confidenceLayer = processConfidenceLayer({
  demands: [medDemand],
  activeSituations: [{ id: "sit-med", title: "Medication", status: "ACTIVE" }],
  beliefs: [],
  caregiverLoadState: "LOW",
  crisisRisks: crisisLayer.risks,
});
const delegationLayer = processDelegationLayer({
  demands: [medDemand],
  ownershipEvals: [{
    demandId: medDemand.id,
    situationId: medDemand.situationId,
    ownershipState: "unassigned",
    ownerIds: [],
    ownerNames: [],
    pressureScore: medDemand.pressureScore,
    highPressure: false,
    criticalUnassigned: false,
  }],
  persons: [
    { id: "p1", name: "Primary caregiver", role: "primary_caregiver", relationship: "self" },
    { id: "p2", name: "Sarah", role: "shared_caregiver", relationship: "daughter" },
  ],
  loads: [
    { personId: "p1", activeResponsibilities: 5, highPressureResponsibilities: 3, loadScore: 9, overloaded: true },
    { personId: "p2", activeResponsibilities: 1, highPressureResponsibilities: 0, loadScore: 1, overloaded: false },
  ],
  caregiverLoadState: "HIGH",
  sharedCaregivers: ["Sarah"],
});
void toCrisisPreventionLayerPayload(crisisLayer);
void toConfidenceLayerPayload(confidenceLayer);
void toDelegationLayerPayload(delegationLayer);
assert(crisisLayer.guarantee.ok, "crisis layer guarantee");
assert(confidenceLayer.guarantee.ok, "confidence layer guarantee");
console.log("✓ facade process + payload helpers");

assert(
  pipelineSrc.includes("processCrisisPreventionLayer"),
  "analyze-pipeline must call crisis prevention",
);
assert(
  pipelineSrc.includes("processConfidenceLayer"),
  "analyze-pipeline must call confidence layer",
);
assert(
  pipelineSrc.includes("processDelegationLayer"),
  "analyze-pipeline must call delegation layer",
);
assert(
  pipelineSrc.includes("crisis_prevention_layer"),
  "AnalyzePipelineRun must expose crisis_prevention_layer",
);
assert(
  pipelineSrc.includes("confidence_layer"),
  "AnalyzePipelineRun must expose confidence_layer",
);
assert(
  pipelineSrc.includes("delegation_layer"),
  "AnalyzePipelineRun must expose delegation_layer",
);
const crisisIdx = pipelineSrc.indexOf("// CRISIS PREVENTION — AFTER Fail-Safe");
const confidenceIdx = pipelineSrc.indexOf("// CONFIDENCE LAYER — feeds crisis");
const delegationIdx = pipelineSrc.indexOf("const delegationLayer = processDelegationLayer");
const humanTrustIdx = pipelineSrc.indexOf("// HUMAN TRUST LAYER — AFTER Confidence/Crisis/Delegation");
assert(crisisIdx > 0 && confidenceIdx > crisisIdx, "crisis before confidence");
assert(delegationIdx > confidenceIdx, "confidence before delegation");
assert(humanTrustIdx > delegationIdx, "delegation before human trust");
console.log("✓ analyze-pipeline wiring order");

const decisionCard = fs.readFileSync(
  path.join(root, "src/components/ui-runtime/DecisionCardView.tsx"),
  "utf8",
);
assert(decisionCard.includes("confidence-reassurance"), "DecisionCard shows confidence");
assert(decisionCard.includes("crisis-prevention-hint"), "DecisionCard shows subtle crisis warnings");
assert(decisionCard.includes("delegation-hint"), "DecisionCard shows optional delegation");
console.log("✓ UI wiring — Decision Surface");

console.log("\nAll caregiver expansion checks passed.");
