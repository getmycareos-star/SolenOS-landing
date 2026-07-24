/**
 * verify-demand-engine.mts
 * Asserts Demand Engine v1.5: pressure formula, generation, lifecycle, STATE placement.
 */

import {
  DEMAND_ENGINE_FORBIDDEN,
  DEMAND_ENGINE_IDENTITY,
  DEMAND_ENGINE_ONE_LINE_TRUTH,
  DEMAND_ENGINE_PIPELINE_POSITION,
  DEMAND_STATUSES,
  PRESSURE_WEIGHTS,
  canTransitionDemand,
  computePressureScore,
  generateDemandsFromSituation,
  listActiveDemands,
  listDemands,
  mergeGeneratedDemands,
  processDemandEngineLayer,
  rankDemandsByPressure,
  resetDemandStore,
  transitionDemandStatus,
  withPressureScore,
} from "../src/lib/demand-engine";
import { FACADE_DEPRECATION, LAYER_ARCHITECTURE_MAP } from "../src/lib/solenos-layers";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

console.log("=== SolenOS Demand Engine (v1.5) ===\n");

assert(DEMAND_ENGINE_IDENTITY.includes("actionable demands"), "identity");
assert(DEMAND_ENGINE_ONE_LINE_TRUTH.includes("effort never increases"), "effort excluded in truth");
assert(DEMAND_ENGINE_PIPELINE_POSITION.includes("Demand Engine"), "pipeline position");
assert(
  DEMAND_ENGINE_FORBIDDEN.some((f) => f.includes("effort")),
  "forbids effort in priority",
);
assert(DEMAND_STATUSES.join(",") === "pending,in_progress,completed,cancelled", "statuses");
assert(
  PRESSURE_WEIGHTS.urgency === 0.35 &&
    PRESSURE_WEIGHTS.riskImpact === 0.35 &&
    PRESSURE_WEIGHTS.uncertainty === 0.2 &&
    PRESSURE_WEIGHTS.emotionalLoad === 0.1,
  "pressure weights",
);
console.log("✓ contract constants");

const p = computePressureScore({
  urgency: 100,
  riskImpact: 100,
  uncertainty: 100,
  emotionalLoad: 100,
  effort: 100,
});
assert(p === 100, `max pressure should be 100, got ${p}`);

const pEffort = computePressureScore({
  urgency: 80,
  riskImpact: 60,
  uncertainty: 40,
  emotionalLoad: 20,
  effort: 0,
});
const pEffortHigh = computePressureScore({
  urgency: 80,
  riskImpact: 60,
  uncertainty: 40,
  emotionalLoad: 20,
  effort: 100,
});
assert(pEffort === pEffortHigh, "effort must not change pressureScore");
assert(
  Math.abs(pEffort - (80 * 0.35 + 60 * 0.35 + 40 * 0.2 + 20 * 0.1)) < 0.01,
  "pressure formula",
);
console.log("✓ pressure formula (effort excluded)");

assert(canTransitionDemand("pending", "in_progress"), "pending→in_progress");
assert(canTransitionDemand("pending", "completed"), "pending→completed");
assert(canTransitionDemand("pending", "cancelled"), "pending→cancelled");
assert(canTransitionDemand("in_progress", "completed"), "in_progress→completed");
assert(!canTransitionDemand("completed", "pending"), "completed terminal");
assert(!canTransitionDemand("cancelled", "pending"), "cancelled terminal");
console.log("✓ demand lifecycle transitions");

resetDemandStore();
const session = "verify-demand-session";
const generated = generateDemandsFromSituation({
  situationId: "sit-med-1",
  title: "Medication refill needed for insulin",
  situationType: "medical_event",
  urgencyHint: "HIGH",
  beliefUncertainty: 55,
});
assert(generated.length >= 1, "auto-generates from medication situation");
assert(
  generated.every((d) => d.situationId === "sit-med-1"),
  "attached to situationId",
);
assert(
  generated.every((d) => d.status === "pending"),
  "start pending",
);

mergeGeneratedDemands(session, generated);
const active = listActiveDemands(session);
assert(active.length === generated.length, "active matches generated");

const first = active[0]!;
const started = transitionDemandStatus(session, first.id, "in_progress");
assert(started.ok, "can start demand");
const completed = transitionDemandStatus(session, first.id, "completed");
assert(completed.ok, "can complete demand");

// History preserved — completed stay
mergeGeneratedDemands(session, generated);
const all = listDemands(session);
assert(
  all.some((d) => d.id === first.id && d.status === "completed"),
  "completed demands never disappear",
);
console.log("✓ generation + lifecycle + history retention");

const ranked = rankDemandsByPressure([
  withPressureScore({
    id: "a",
    situationId: "s",
    title: "low",
    description: "",
    category: "monitoring" as const,
    status: "pending" as const,
    urgency: 10,
    riskImpact: 10,
    effort: 90,
    emotionalLoad: 10,
    uncertainty: 10,
    pressureScore: 0,
    createdAt: "",
  }),
  withPressureScore({
    id: "b",
    situationId: "s",
    title: "high",
    description: "",
    category: "medical" as const,
    status: "pending" as const,
    urgency: 90,
    riskImpact: 90,
    effort: 5,
    emotionalLoad: 50,
    uncertainty: 40,
    pressureScore: 0,
    createdAt: "",
  }),
]);
assert(ranked[0]!.id === "b", "ranks by pressure not effort");
console.log("✓ priority ranks demands by pressure");

resetDemandStore();
const layer = processDemandEngineLayer({
  careSessionId: "verify-demand-layer",
  situationSeeds: [
    {
      situationId: "sit-d",
      title: "Hospital discharge follow-up",
      situationType: "follow_up",
      urgencyHint: "CRITICAL",
    },
  ],
});
assert(layer.output.activeDemands.length >= 1, "layer emits active demands");
assert(layer.output.unresolvedCount === layer.output.activeDemands.length, "unresolved count");
assert(typeof layer.output.caregiverLoadEstimate === "number", "load estimate");
assert(layer.guarantee.ok, `guarantee: ${layer.guarantee.violations.join("; ")}`);
console.log("✓ processDemandEngineLayer output contract");

assert(
  LAYER_ARCHITECTURE_MAP.STATE.owns.some((o) => o.includes("Demand")),
  "STATE owns Demand",
);
assert(FACADE_DEPRECATION["demand-engine"]?.includes("STATE demands"), "facade map");
console.log("✓ 3-layer STATE placement");

console.log("\nDemand Engine verify passed.");
