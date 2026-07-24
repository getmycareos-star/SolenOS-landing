/**
 * verify-priority-contract.mts
 *
 * Situation Priority Contract (GLOBAL RULE):
 * - Exact formula
 * - CRITICAL × NOW safety override
 * - Determinism (same inputs → same score)
 * - Explainability metadata
 * - Facade wiring (computePriority / priority-engine → PriorityContract)
 */

import fs from "node:fs";
import path from "node:path";
import {
  COMPLETION_FACTOR,
  DEPENDENCY_SITUATION_COEFFICIENT,
  PRIORITY_CONTRACT_ONE_LINE,
  PriorityContract,
  RISK_WEIGHT,
  TIME_URGENCY,
  UNCERTAINTY_FIELD_COEFFICIENT,
  calculatePriorityContract,
  computePriority,
  computeRisk,
  computeTimeDecayFactor,
  formatPriorityExplanation,
  rankByPriorityContract,
  resetBeliefStore,
  resetStateStore,
  toStateSituation,
  replaceStateSituations,
  type PriorityContractInput,
} from "../src/lib/solenos-layers";
import {
  PriorityContract as FacadePriorityContract,
  rankSituationsViaPriorityContract,
  scoreSituationViaPriorityContract,
} from "../src/lib/priority-engine";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}

console.log("=== Situation Priority Contract ===\n");

assert(PRIORITY_CONTRACT_ONE_LINE.includes("deterministic"), "one-line summary");
assert(RISK_WEIGHT.CRITICAL === 1.0, "CRITICAL RiskWeight");
assert(RISK_WEIGHT.HIGH === 0.8, "HIGH RiskWeight");
assert(RISK_WEIGHT.MEDIUM === 0.5, "MEDIUM RiskWeight");
assert(RISK_WEIGHT.LOW === 0.2, "LOW RiskWeight");
assert(TIME_URGENCY.NOW === 1.0, "NOW TimeUrgency");
assert(TIME_URGENCY.SOON === 0.7, "SOON TimeUrgency");
assert(TIME_URGENCY.TODAY === 0.5, "TODAY TimeUrgency");
assert(TIME_URGENCY.LATER === 0.2, "LATER TimeUrgency");
assert(COMPLETION_FACTOR.RESOLVED === 1.0, "RESOLVED CompletionFactor");
assert(COMPLETION_FACTOR.PARTIAL === 0.5, "PARTIAL CompletionFactor");
assert(COMPLETION_FACTOR.ACTIVE === 0.0, "ACTIVE CompletionFactor");
assert(UNCERTAINTY_FIELD_COEFFICIENT === 0.3, "uncertainty coefficient");
assert(DEPENDENCY_SITUATION_COEFFICIENT === 0.2, "dependency coefficient");
assert(approx(computeTimeDecayFactor(0), 1), "decay at 0 hours");
assert(approx(computeTimeDecayFactor(3), 0.25), "decay at 3 hours");
console.log("✓ contract constants");

const baseInput: PriorityContractInput = {
  situationId: "sit-a",
  riskLevel: "HIGH",
  severity: 1,
  timeUrgency: "SOON",
  hoursUntilDeadline: 3,
  numberOfMissingCriticalFields: 2,
  missingInformationLoad: 1,
  numberOfDependentSituations: 1,
  downstreamImpact: 1,
  completion: "ACTIVE",
  resolutionProgress: 1,
};

// PriorityScore =
//   (0.8 × 1) + (0.7 × 0.25) + (2×0.3 × 1) + (1×0.2 × 1) - (1 × 0) = 0.8 + 0.175 + 0.6 + 0.2 = 1.775
const expected =
  RISK_WEIGHT.HIGH * 1 +
  TIME_URGENCY.SOON * (1 / (3 + 1)) +
  2 * UNCERTAINTY_FIELD_COEFFICIENT * 1 +
  1 * DEPENDENCY_SITUATION_COEFFICIENT * 1 -
  1 * COMPLETION_FACTOR.ACTIVE;

const scored = PriorityContract.calculate(baseInput);
assert(approx(scored.priorityScore, expected), `formula drift: ${scored.priorityScore} vs ${expected}`);
assert(scored.safetyOverride === false, "no override for HIGH×SOON");
assert(scored.components.riskContribution === RISK_WEIGHT.HIGH, "risk component");
assert(scored.reasons.length > 0, "explainability reasons");
assert(formatPriorityExplanation(scored).includes("score="), "format explanation");
console.log("✓ formula PriorityScore exact match");

// Determinism
const again = calculatePriorityContract(baseInput);
assert(again.priorityScore === scored.priorityScore, "deterministic score");
assert(JSON.stringify(again.components) === JSON.stringify(scored.components), "deterministic components");
console.log("✓ same inputs → same score");

// Completion reduces priority
const partial = PriorityContract.calculate({
  ...baseInput,
  situationId: "sit-partial",
  completion: "PARTIAL",
});
assert(partial.priorityScore < scored.priorityScore, "PARTIAL reduces score");
const resolved = PriorityContract.calculate({
  ...baseInput,
  situationId: "sit-resolved",
  completion: "RESOLVED",
});
assert(resolved.priorityScore < partial.priorityScore, "RESOLVED reduces more");
console.log("✓ completion factor reduces priority");

// Safety override: CRITICAL × NOW always top — even with lower raw score
const lowCriticalNow = PriorityContract.calculate({
  situationId: "critical-now",
  riskLevel: "CRITICAL",
  severity: 0.1,
  timeUrgency: "NOW",
  hoursUntilDeadline: 100,
  numberOfMissingCriticalFields: 0,
  numberOfDependentSituations: 0,
  completion: "ACTIVE",
});
const highLater = PriorityContract.calculate({
  situationId: "high-later",
  riskLevel: "HIGH",
  severity: 1,
  timeUrgency: "LATER",
  hoursUntilDeadline: 0,
  numberOfMissingCriticalFields: 10,
  numberOfDependentSituations: 10,
  completion: "ACTIVE",
});
assert(lowCriticalNow.safetyOverride === true, "CRITICAL×NOW sets safetyOverride");
assert(highLater.safetyOverride === false, "HIGH×LATER no override");
assert(
  lowCriticalNow.priorityScore < highLater.priorityScore,
  "override case can have lower raw score",
);
const ranked = rankByPriorityContract([highLater, lowCriticalNow]);
assert(ranked.rankedSituationIds[0] === "critical-now", "override pushed to TOP");
assert(ranked.overrideApplied === true, "overrideApplied flag");
console.log("✓ SAFETY OVERRIDE: CRITICAL×NOW always top");

// Score-order when no override
const med = PriorityContract.calculate({
  situationId: "med",
  riskLevel: "MEDIUM",
  severity: 1,
  timeUrgency: "TODAY",
  hoursUntilDeadline: 0,
  completion: "ACTIVE",
});
const low = PriorityContract.calculate({
  situationId: "low",
  riskLevel: "LOW",
  severity: 1,
  timeUrgency: "LATER",
  hoursUntilDeadline: 72,
  completion: "ACTIVE",
});
const rankedPlain = PriorityContract.calculateAndRank([
  { ...low, situationId: "low" },
  { ...med, situationId: "med" },
]);
assert(rankedPlain.rankedSituationIds[0] === "med", "sort by score DESC");
console.log("✓ ordering PriorityScore DESC");

// computePriority wires PriorityContract
resetStateStore();
resetBeliefStore();
const situations = replaceStateSituations("session-pc", [
  toStateSituation({
    id: "sit-critical",
    status: "active",
    priority: "CRITICAL",
    summary: "Hospital discharge",
    careSessionId: "session-pc",
  }),
  toStateSituation({
    id: "sit-low",
    status: "active",
    priority: "LOW",
    summary: "Bathroom comfort",
    careSessionId: "session-pc",
  }),
]);
const risk = computeRisk(situations, []);
const priority = computePriority({
  situations,
  beliefs: [],
  risk,
  situationSignals: [
    { situationId: "sit-critical", timeUrgency: "NOW", hoursUntilDeadline: 0 },
    { situationId: "sit-low", timeUrgency: "LATER", hoursUntilDeadline: 72 },
  ],
  candidateActionIds: ["clarify_before_action"],
});
assert(priority.rankedSituationIds?.[0] === "sit-critical", "computePriority ranks CRITICAL×NOW first");
assert(priority.priorityOverrideApplied === true, "computePriority sets override");
assert((priority.situationScores?.length ?? 0) === 2, "situationScores present");
assert((priority.explanationLines?.length ?? 0) >= 1, "explanationLines for Decision Surface");
console.log("✓ computePriority uses PriorityContract");

// Facade wiring
assert(FacadePriorityContract.calculate === PriorityContract.calculate, "facade shares calculate");
const facadeScored = scoreSituationViaPriorityContract(baseInput);
assert(approx(facadeScored.priorityScore, expected), "facade scoreSituation");
const facadeRank = rankSituationsViaPriorityContract({
  trackedSituations: [
    {
      id: "t-crit",
      title: "Hospital discharge planning",
      status: "ACTIVE",
      careSessionId: "s",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastReevaluatedAt: "2026-01-01T00:00:00.000Z",
      timelineEntryIds: [],
      memoryNodeIds: [],
      documentIds: [],
      referencedBySituationIds: [],
      unresolvedDependencyIds: [],
      history: [],
    },
    {
      id: "t-low",
      title: "Bathroom comfort issue",
      status: "ACTIVE",
      careSessionId: "s",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      lastReevaluatedAt: "2026-01-01T00:00:00.000Z",
      timelineEntryIds: [],
      memoryNodeIds: [],
      documentIds: [],
      referencedBySituationIds: [],
      unresolvedDependencyIds: [],
      history: [],
    },
  ],
  riskLevelBySituationId: { "t-crit": "CRITICAL", "t-low": "LOW" },
  timeUrgency: "NOW",
  hoursUntilDeadline: 0,
});
assert(facadeRank.rankedSituationIds[0] === "t-crit", "facade ranks situations via contract");
console.log("✓ priority-engine facade → PriorityContract");

// Source authorship — contract lives in derived layer
const contractSrc = fs.readFileSync(
  path.join(root, "src/lib/solenos-layers/derived/priority-contract.ts"),
  "utf-8",
);
assert(contractSrc.includes("PriorityScore"), "canonical contract file");
assert(contractSrc.includes("safetyOverride"), "override in canonical file");
assert(!/emotional|preference|llm/i.test(contractSrc.split("NOT:")[0] ?? ""), "no emotion in formula body guard");

const computeSrc = fs.readFileSync(
  path.join(root, "src/lib/solenos-layers/derived/compute-priority.ts"),
  "utf-8",
);
assert(computeSrc.includes("PriorityContract"), "computePriority calls PriorityContract");

const facadeSrc = fs.readFileSync(
  path.join(root, "src/lib/priority-engine/situation-contract.ts"),
  "utf-8",
);
assert(facadeSrc.includes("PriorityContract"), "situation-contract facade");
console.log("✓ architecture: derived contract + facade wiring");

console.log("\n=== All Priority Contract checks passed ===");
