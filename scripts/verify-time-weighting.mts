/**
 * verify-time-weighting.mts
 *
 * TIME WEIGHTING MODEL (CRITICAL SYSTEM RULE):
 *   RiskOverTime(t) = BaseRisk × TimeCurveType(t)
 * - Curve math: acute/medication exp, chronic linear, social log, safety step
 * - Classifier heuristics
 * - Threshold zones
 * - Priority Contract integration (curve-derived TimeDecayFactor)
 * - Must NOT flatten deadlines equally or use baseRisk + time
 */

import fs from "node:fs";
import path from "node:path";
import {
  TIME_WEIGHTING_FORBIDDEN,
  TIME_WEIGHTING_IDENTITY,
  TIME_WEIGHTING_ONE_LINE_TRUTH,
  TIME_CURVE_TYPES,
  CURVE_K_DEFAULTS,
  CURVE_K_RANGES,
  SAFETY_STEP_FLOOR,
  SAFETY_STEP_MAX,
  DEFAULT_THRESHOLDS_HOURS,
  classifyTimeCurve,
  computeRiskOverTime,
  acuteMedicalCurve,
  medicationDependentCurve,
  chronicCareCurve,
  socialCoordinationCurve,
  safetyCriticalStepCurve,
  evaluateTimeCurve,
  pressureHoursFromRemaining,
  normalizeTau,
  thresholdZone,
  thresholdsForCurve,
  normalizeThresholds,
  computeCurveTimeDecayFactor,
  linearTimeDecayFactor,
  resolvePriorityTimeSignals,
  elevateMultiSituationRisk,
  estimateHumanDelayBufferHours,
} from "../src/lib/time-weighting";
import {
  PriorityContract,
  RISK_WEIGHT,
  TIME_URGENCY,
  computePriority,
  computeRisk,
  resetBeliefStore,
  resetStateStore,
  replaceStateSituations,
  toStateSituation,
} from "../src/lib/solenos-layers";

const root = process.cwd();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}

console.log("=== TIME WEIGHTING MODEL ===\n");

assert(TIME_WEIGHTING_IDENTITY.includes("non-linear"), "identity");
assert(TIME_WEIGHTING_ONE_LINE_TRUTH.includes("BaseRisk × TimeCurveType"), "one-line truth");
assert(TIME_WEIGHTING_FORBIDDEN.some((f) => f.includes("baseRisk + time")), "forbid additive");
assert(TIME_WEIGHTING_FORBIDDEN.some((f) => f.includes("LLM")), "forbid LLM urgency");
assert(TIME_CURVE_TYPES.length === 5, "five curve types");
assert(CURVE_K_DEFAULTS.ACUTE_MEDICAL >= CURVE_K_RANGES.ACUTE_MEDICAL.min, "acute k range");
assert(CURVE_K_DEFAULTS.MEDICATION_DEPENDENT > CURVE_K_DEFAULTS.ACUTE_MEDICAL, "med k higher");
assert(DEFAULT_THRESHOLDS_HOURS.safeThresholdTime === 72, "default safe 72h");
assert(DEFAULT_THRESHOLDS_HOURS.warningThresholdTime === 24, "default warning 24h");
assert(DEFAULT_THRESHOLDS_HOURS.criticalThresholdTime === 6, "default critical 6h");
console.log("✓ contract constants");

// Curve math at τ=0 → identity-ish multiplicative base
assert(approx(acuteMedicalCurve(0), 1), "acute exp(0)=1");
assert(approx(medicationDependentCurve(0), 1), "med exp(0)=1");
assert(approx(chronicCareCurve(0), 1), "chronic 1+0=1");
assert(approx(socialCoordinationCurve(0), 1), "social 1+log1=1");

// Exponential: acute explodes with τ; medication faster
const acute1 = acuteMedicalCurve(1, 1.1);
const med1 = medicationDependentCurve(1, 1.6);
assert(acute1 > 2.5, `acute e^1.1 ≈ ${acute1}`);
assert(med1 > acute1, "medication grows faster than acute at same τ");
assert(approx(acute1, Math.exp(1.1)), "acute exact e^(kτ)");
assert(approx(med1, Math.exp(1.6)), "med exact e^(kτ)");

// Linear vs log
assert(approx(chronicCareCurve(1), 2), "chronic linear 1+τ");
assert(socialCoordinationCurve(1) < chronicCareCurve(1), "social slower than linear");
assert(approx(socialCoordinationCurve(1), 1 + Math.log(2)), "social log form");

// Step function
const stepThresholds = thresholdsForCurve("SAFETY_CRITICAL_OVERRIDE");
assert(
  safetyCriticalStepCurve({ hoursUntilDeadline: 20, thresholds: stepThresholds }) ===
    SAFETY_STEP_FLOOR,
  "step floor before critical",
);
assert(
  safetyCriticalStepCurve({ hoursUntilDeadline: 3, thresholds: stepThresholds }) ===
    SAFETY_STEP_MAX,
  "step MAX at/below critical",
);
console.log("✓ curve math (exp / linear / log / step)");

// Pressure + RiskOverTime
const thr = thresholdsForCurve("MEDICATION_DEPENDENT");
assert(approx(pressureHoursFromRemaining(72, thr), 0), "at safe → pressure 0");
assert(pressureHoursFromRemaining(6, thr) > 0, "near critical → pressure > 0");
assert(approx(normalizeTau(72, 72), 1), "τ=1 when pressure=safe");

const rotSafe = computeRiskOverTime({
  baseRisk: 0.5,
  curveType: "MEDICATION_DEPENDENT",
  hoursUntilDeadline: 72,
});
assert(approx(rotSafe.curveMultiplier, 1), "safe window multiplier ≈ 1");
assert(approx(rotSafe.riskOverTime, 0.5), "RiskOverTime = base × 1 at safe");

const rotCritical = computeRiskOverTime({
  baseRisk: 0.5,
  curveType: "MEDICATION_DEPENDENT",
  hoursUntilDeadline: 3,
});
assert(rotCritical.riskOverTime > rotSafe.riskOverTime, "critical > safe RiskOverTime");
assert(rotCritical.thresholdZone === "critical", "zone critical <6h");
assert(thresholdZone(20, thr) === "warning", "20h medication → warning");
assert(thresholdZone(80, thr) === "safe", "80h → safe");

// MUST NOT: baseRisk + time
assert(
  !approx(rotCritical.riskOverTime, 0.5 + 3),
  "RiskOverTime is NOT baseRisk + time",
);
console.log("✓ RiskOverTime = BaseRisk × curve (not additive)");

// Acute vs social at same pressure — not flattened
const acuteRot = computeRiskOverTime({
  baseRisk: 1,
  curveType: "ACUTE_MEDICAL",
  hoursUntilDeadline: 4,
});
const socialRot = computeRiskOverTime({
  baseRisk: 1,
  curveType: "SOCIAL_COORDINATION",
  hoursUntilDeadline: 4,
});
assert(acuteRot.riskOverTime > socialRot.riskOverTime, "deadlines not flattened equally");
console.log("✓ situation-specific curves (not uniform deadlines)");

// Classifier
assert(
  classifyTimeCurve({ text: "Insulin refill due tomorrow" }).curveType ===
    "MEDICATION_DEPENDENT",
  "insulin → medication",
);
assert(
  classifyTimeCurve({ text: "Hospital discharge planning after surgery" }).curveType ===
    "ACUTE_MEDICAL",
  "discharge → acute",
);
assert(
  classifyTimeCurve({ text: "Physio schedule home mods" }).curveType === "CHRONIC_CARE",
  "physio → chronic",
);
assert(
  classifyTimeCurve({ text: "Family coordination meeting schedule" }).curveType ===
    "SOCIAL_COORDINATION",
  "family coord → social",
);
assert(
  classifyTimeCurve({ text: "Missed seizure med — not ready for discharge" }).curveType ===
    "SAFETY_CRITICAL_OVERRIDE",
  "seizure/discharge → safety step",
);
assert(
  classifyTimeCurve({ situationType: "emergency" }).curveType === "ACUTE_MEDICAL",
  "emergency context → acute",
);
assert(
  classifyTimeCurve({ situationType: "administrative" }).curveType === "SOCIAL_COORDINATION",
  "administrative → social",
);
assert(
  classifyTimeCurve({
    text: "anything",
    explicitCurveType: "CHRONIC_CARE",
  }).curveType === "CHRONIC_CARE",
  "explicit override wins",
);
console.log("✓ classifier heuristics");

// Thresholds helpers
const norm = normalizeThresholds(
  { safeThresholdTime: 10, warningThresholdTime: 20, criticalThresholdTime: 30 },
  "CHRONIC_CARE",
);
assert(norm.warningThresholdTime <= norm.safeThresholdTime, "warn ≤ safe");
assert(norm.criticalThresholdTime <= norm.warningThresholdTime, "crit ≤ warn");
console.log("✓ threshold normalization");

// Priority Contract curve path
const linearFactor = linearTimeDecayFactor(6);
const curveFactor = computeCurveTimeDecayFactor({
  curveType: "MEDICATION_DEPENDENT",
  hoursUntilDeadline: 6,
});
assert(curveFactor !== linearFactor || curveFactor > 0.5, "curve factor near critical is elevated");

const resolved = resolvePriorityTimeSignals({
  curveType: "MEDICATION_DEPENDENT",
  hoursUntilDeadline: 3,
});
assert(resolved.usedCurve === true, "usedCurve");
assert(resolved.timeUrgency === "NOW", "critical zone → NOW");

const scoredCurve = PriorityContract.calculate({
  situationId: "med-refill",
  riskLevel: "HIGH",
  severity: 1,
  timeUrgency: "LATER",
  hoursUntilDeadline: 3,
  timeCurveType: "MEDICATION_DEPENDENT",
  completion: "ACTIVE",
});
assert(scoredCurve.components.usedTimeCurve === true, "contract uses curve");
assert(scoredCurve.timeUrgency === "NOW", "curve remaps urgency to NOW");
assert((scoredCurve.components.riskOverTime ?? 0) > 1, "RiskOverTime audit present");

const scoredLinear = PriorityContract.calculate({
  situationId: "med-linear",
  riskLevel: "HIGH",
  severity: 1,
  timeUrgency: "LATER",
  hoursUntilDeadline: 3,
  completion: "ACTIVE",
});
assert(scoredLinear.components.usedTimeCurve === false, "no curve → linear path");
assert(
  scoredCurve.priorityScore !== scoredLinear.priorityScore,
  "curve path changes PriorityScore vs linear",
);

// Acute near deadline outranks chronic same hours (not flattened)
const sharedThr = {
  safeThresholdTime: 72,
  warningThresholdTime: 24,
  criticalThresholdTime: 6,
};
const acuteP = PriorityContract.calculate({
  situationId: "acute",
  riskLevel: "MEDIUM",
  severity: 1,
  timeUrgency: "LATER",
  hoursUntilDeadline: 8,
  timeCurveType: "ACUTE_MEDICAL",
  timeThresholds: sharedThr,
  completion: "ACTIVE",
});
const chronicP = PriorityContract.calculate({
  situationId: "chronic",
  riskLevel: "MEDIUM",
  severity: 1,
  timeUrgency: "LATER",
  hoursUntilDeadline: 8,
  timeCurveType: "CHRONIC_CARE",
  timeThresholds: sharedThr,
  completion: "ACTIVE",
});
const ranked2 = PriorityContract.calculateAndRank([
  {
    situationId: "chronic",
    riskLevel: "MEDIUM",
    severity: 1,
    timeUrgency: "LATER",
    hoursUntilDeadline: 8,
    timeCurveType: "CHRONIC_CARE",
    timeThresholds: sharedThr,
    completion: "ACTIVE",
  },
  {
    situationId: "acute",
    riskLevel: "MEDIUM",
    severity: 1,
    timeUrgency: "LATER",
    hoursUntilDeadline: 8,
    timeCurveType: "ACUTE_MEDICAL",
    timeThresholds: sharedThr,
    completion: "ACTIVE",
  },
]);
assert(ranked2.rankedSituationIds[0] === "acute", "acute outranks chronic at same t (shared thresholds)");
assert(
  acuteP.components.timeDecayFactor > chronicP.components.timeDecayFactor,
  "acute time mass > chronic under shared thresholds",
);
console.log("✓ Priority Contract curve integration");

// Safety step jumps to top urgency at threshold
const stepBefore = PriorityContract.calculate({
  situationId: "step-before",
  riskLevel: "HIGH",
  severity: 1,
  timeUrgency: "LATER",
  hoursUntilDeadline: 20,
  timeCurveType: "SAFETY_CRITICAL_OVERRIDE",
  completion: "ACTIVE",
});
const stepAfter = PriorityContract.calculate({
  situationId: "step-after",
  riskLevel: "HIGH",
  severity: 1,
  timeUrgency: "LATER",
  hoursUntilDeadline: 4,
  timeCurveType: "SAFETY_CRITICAL_OVERRIDE",
  completion: "ACTIVE",
});
assert(stepBefore.timeUrgency !== "NOW" || stepBefore.components.timeDecayFactor < 0.5, "step quiet before");
assert(stepAfter.timeUrgency === "NOW", "step → NOW after threshold");
assert(stepAfter.priorityScore > stepBefore.priorityScore, "step jumps priority");
console.log("✓ SAFETY_CRITICAL_OVERRIDE step behavior");

// computePriority wires classifier from summary
resetStateStore();
resetBeliefStore();
const situations = replaceStateSituations("session-tw", [
  toStateSituation({
    id: "sit-insulin",
    status: "active",
    priority: "HIGH",
    summary: "Insulin refill needed — anticoagulant reminder",
    careSessionId: "session-tw",
  }),
  toStateSituation({
    id: "sit-schedule",
    status: "active",
    priority: "MEDIUM",
    summary: "Family coordination schedule for next visit",
    careSessionId: "session-tw",
  }),
]);
const risk = computeRisk(situations, []);
const priority = computePriority({
  situations,
  beliefs: [],
  risk,
  situationSignals: [
    { situationId: "sit-insulin", hoursUntilDeadline: 4 },
    { situationId: "sit-schedule", hoursUntilDeadline: 4 },
  ],
  candidateActionIds: ["clarify_before_action"],
});
assert(priority.rankedSituationIds?.[0] === "sit-insulin", "medication situation ranks above social");
const insulinScore = priority.situationScores?.find((s) => s.situationId === "sit-insulin");
assert(insulinScore?.components.usedTimeCurve === true, "computePriority applies curve");
assert(insulinScore?.components.timeCurveType === "MEDICATION_DEPENDENT", "classified medication");
console.log("✓ computePriority auto-classifies curves");

// Optional v1.5 stubs
assert(elevateMultiSituationRisk([0.5, 0.55]) === 0.75, "multi-situation elevate");
assert(elevateMultiSituationRisk([0.2]) === undefined, "single no elevate");
assert(estimateHumanDelayBufferHours() === 0, "delay buffer stub");
console.log("✓ optional v1.5 multi-situation + delay stub");

// Architecture / source authorship
const curveSrc = fs.readFileSync(path.join(root, "src/lib/time-weighting/curves.ts"), "utf-8");
assert(curveSrc.includes("Math.exp"), "exp curves in module");
assert(curveSrc.includes("Math.log"), "log curve in module");
assert(!curveSrc.includes("baseRisk +"), "no additive risk in curves");

const contractSrc = fs.readFileSync(
  path.join(root, "src/lib/solenos-layers/derived/priority-contract.ts"),
  "utf-8",
);
assert(contractSrc.includes("timeCurveType"), "Priority Contract accepts curve");
assert(contractSrc.includes("resolvePriorityTimeSignals"), "contract wires curve bridge");
assert(contractSrc.includes("RiskOverTime"), "documents RiskOverTime model");

const archSrc = fs.readFileSync(
  path.join(root, "src/lib/solenos-layers/architecture-map.ts"),
  "utf-8",
);
assert(archSrc.includes("TIME WEIGHTING"), "architecture map mentions TIME WEIGHTING");
assert(archSrc.includes("time-weighting"), "facade map includes time-weighting");

// evaluateTimeCurve dispatch
assert(evaluateTimeCurve("CHRONIC_CARE", 2) === chronicCareCurve(2), "dispatch chronic");
assert(RISK_WEIGHT.CRITICAL === 1 && TIME_URGENCY.NOW === 1, "priority constants intact");

console.log("\n=== All Time Weighting checks passed ===");
