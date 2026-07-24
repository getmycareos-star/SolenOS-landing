/**
 * verify-caregiver-load-index.mts
 * Asserts Caregiver Load Index v1.6: formula, states, surface limits, derived placement.
 */

import {
  CAREGIVER_LOAD_INDEX_FORBIDDEN,
  CAREGIVER_LOAD_INDEX_IDENTITY,
  CAREGIVER_LOAD_INDEX_ONE_LINE_TRUTH,
  LOAD_FORMULA_WEIGHTS,
  LOAD_SCORE_BANDS,
  LOAD_STATE_SURFACE_LIMITS,
  classifyLoadState,
  computeCaregiverLoad,
  computeRawLoadScore,
  constrainDemandsByLoadState,
  normalizeLoadScore,
  processCaregiverLoadLayer,
  surfaceLimitForState,
} from "../src/lib/caregiver-load-index";
import { withPressureScore } from "../src/lib/demand-engine";
import { FACADE_DEPRECATION, LAYER_ARCHITECTURE_MAP } from "../src/lib/solenos-layers";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Caregiver Load Index (v1.6) ===\n");

assert(CAREGIVER_LOAD_INDEX_IDENTITY.includes("operational caregiver burden"), "identity");
assert(CAREGIVER_LOAD_INDEX_ONE_LINE_TRUTH.includes("derived function"), "derived truth");
assert(
  CAREGIVER_LOAD_INDEX_FORBIDDEN.some((f) => f.includes("mental health")),
  "forbids MH diagnosis",
);
assert(
  CAREGIVER_LOAD_INDEX_FORBIDDEN.some((f) => f.includes("fatigueTrend")),
  "MVP forbids v2 fields",
);
assert(LOAD_STATE_SURFACE_LIMITS.CRITICAL === 1, "CRITICAL=1");
assert(LOAD_STATE_SURFACE_LIMITS.HIGH === 2, "HIGH=2");
assert(LOAD_STATE_SURFACE_LIMITS.MODERATE === 3, "MODERATE=3");
assert(LOAD_STATE_SURFACE_LIMITS.LOW === 4, "LOW=4");
console.log("✓ contract constants + surface limits");

assert(LOAD_FORMULA_WEIGHTS.activeDemandCount === 1.5, "active weight");
assert(LOAD_FORMULA_WEIGHTS.highPressureDemandCount === 4, "high-pressure weight");
assert(LOAD_FORMULA_WEIGHTS.uncertaintyLoad === 0.2, "uncertainty weight");
assert(LOAD_FORMULA_WEIGHTS.conflictLoad === 0.2, "conflict weight");
assert(LOAD_FORMULA_WEIGHTS.coordinationLoad === 0.15, "coordination weight");
assert(LOAD_FORMULA_WEIGHTS.timePressureLoad === 0.15, "time weight");

const raw = computeRawLoadScore({
  activeDemandCount: 2,
  highPressureDemandCount: 1,
  uncertaintyLoad: 50,
  conflictLoad: 40,
  coordinationLoad: 30,
  timePressureLoad: 20,
});
const expected =
  2 * 1.5 + 1 * 4 + 50 * 0.2 + 40 * 0.2 + 30 * 0.15 + 20 * 0.15;
assert(Math.abs(raw - expected) < 0.01, `raw load formula got ${raw} vs ${expected}`);

const score = normalizeLoadScore(raw);
assert(score >= 0 && score <= 100, "normalized 0–100");
console.log("✓ load formula v1 + normalize");

assert(classifyLoadState(0) === "LOW", "0 LOW");
assert(classifyLoadState(25) === "LOW", "25 LOW");
assert(classifyLoadState(26) === "MODERATE", "26 MODERATE");
assert(classifyLoadState(50) === "MODERATE", "50 MODERATE");
assert(classifyLoadState(51) === "HIGH", "51 HIGH");
assert(classifyLoadState(75) === "HIGH", "75 HIGH");
assert(classifyLoadState(76) === "CRITICAL", "76 CRITICAL");
assert(classifyLoadState(100) === "CRITICAL", "100 CRITICAL");
assert(LOAD_SCORE_BANDS.CRITICAL.min === 76, "CRITICAL band");
console.log("✓ load state bands");

const low = computeCaregiverLoad({
  activeDemandCount: 1,
  highPressureDemandCount: 0,
  uncertaintyLoad: 10,
  conflictLoad: 0,
  coordinationLoad: 5,
  timePressureLoad: 5,
});
assert(low.state === "LOW", `expected LOW got ${low.state} score=${low.score}`);
assert(surfaceLimitForState(low.state) === 4, "LOW surface");

const critical = computeCaregiverLoad({
  activeDemandCount: 8,
  highPressureDemandCount: 5,
  unresolvedSituationCount: 4,
  uncertaintyLoad: 100,
  conflictLoad: 100,
  coordinationLoad: 100,
  timePressureLoad: 100,
  prolongedUnresolvedBoost: 10,
});
assert(
  critical.state === "CRITICAL" || critical.score >= 76,
  `expected CRITICAL-ish got ${critical.state} score=${critical.score}`,
);
assert(surfaceLimitForState("CRITICAL") === 1, "CRITICAL surface=1");
console.log("✓ computeCaregiverLoad + surfaceLimitForState");

const demands = [1, 2, 3, 4, 5].map((i) =>
  withPressureScore({
    id: `d${i}`,
    situationId: "s",
    title: `Demand ${i}`,
    description: `desc ${i}`,
    category: "medical" as const,
    status: "pending" as const,
    urgency: 20 * i,
    riskImpact: 20 * i,
    effort: 50,
    emotionalLoad: 10,
    uncertainty: 10,
    pressureScore: 0,
    createdAt: "",
  }),
);

const criticalSurface = constrainDemandsByLoadState(demands, "CRITICAL");
assert(criticalSurface.length === 1, "CRITICAL shows 1 demand");
const highSurface = constrainDemandsByLoadState(demands, "HIGH");
assert(highSurface.length === 2, "HIGH shows 2");
const modSurface = constrainDemandsByLoadState(demands, "MODERATE");
assert(modSurface.length === 3, "MODERATE shows 3");
const lowSurface = constrainDemandsByLoadState(demands, "LOW");
assert(lowSurface.length === 4, "LOW shows 4");
assert(
  criticalSurface[0]!.pressureScore >= highSurface[1]!.pressureScore,
  "surface picks highest pressure",
);
console.log("✓ Decision Surface constrained by load state");

const layer = processCaregiverLoadLayer({
  demands,
  unresolvedSituationCount: 2,
  beliefs: [
    {
      id: "b1",
      situationId: "s",
      type: "missing_information",
      content: "dose unknown",
      confidence: 0.3,
      importance: "HIGH",
      status: "active",
      createdAt: new Date().toISOString(),
    },
  ],
});
assert(layer.guarantee.ok, `guarantee: ${layer.guarantee.violations.join("; ")}`);
assert(
  layer.surfaceLimit === surfaceLimitForState(layer.load.state),
  "payload surface matches state",
);
assert(!("fatigueTrend" in layer.load), "no fatigueTrend in MVP");
assert(!("burnoutRisk" in layer.load), "no burnoutRisk in MVP");
console.log("✓ processCaregiverLoadLayer + MVP field absence");

assert(
  LAYER_ARCHITECTURE_MAP.DERIVED.owns.some((o) => o.includes("computeCaregiverLoad")),
  "DERIVED owns CLI",
);
assert(
  FACADE_DEPRECATION["caregiver-load-index"] === "derived/computeCaregiverLoad",
  "facade map",
);
console.log("✓ 3-layer DERIVED placement");

console.log("\nCaregiver Load Index verify passed.");
