import { HIGH_PRESSURE_RESPONSIBILITY_THRESHOLD } from "./contract-constants";
import type { ResponsibilityGraphLayerResult } from "./types";

export function runResponsibilityGraphGuarantee(
  layer: ResponsibilityGraphLayerResult,
): ResponsibilityGraphLayerResult["guarantee"] {
  const violations: string[] = [];
  const { state, envelope } = layer;

  for (const person of state.persons) {
    if (!person.id.trim() || !person.name.trim()) {
      violations.push("person id and name must be non-empty");
    }
  }

  const personIds = new Set(state.persons.map((p) => p.id));
  for (const r of state.responsibilities) {
    if (!personIds.has(r.ownerId)) {
      violations.push(`responsibility ${r.id} references unknown owner ${r.ownerId}`);
    }
    if (!r.demandId.trim()) {
      violations.push(`responsibility ${r.id} missing demandId`);
    }
  }

  // Guarantee: high-pressure unassigned → critical flag / escalate
  for (const eval_ of envelope.ownershipEvals) {
    if (
      eval_.ownershipState === "unassigned" &&
      eval_.pressureScore >= HIGH_PRESSURE_RESPONSIBILITY_THRESHOLD &&
      !eval_.criticalUnassigned
    ) {
      violations.push(
        `high-pressure unassigned demand ${eval_.demandId} must set criticalUnassigned`,
      );
    }
  }

  if (
    envelope.health.criticalUnassignedCount > 0 &&
    envelope.health.state !== "critical"
  ) {
    violations.push("critical unassigned count requires health=critical");
  }

  if (envelope.health.criticalUnassignedCount > 0 && !envelope.escalate) {
    violations.push("critical unassigned must set escalate=true");
  }

  if (
    envelope.ownershipUncertainty < 0 ||
    envelope.ownershipUncertainty > 1
  ) {
    violations.push("ownershipUncertainty must be in [0,1]");
  }

  // Unassigned active demands must appear in health.unassignedCount
  const unassigned = envelope.ownershipEvals.filter(
    (e) => e.ownershipState === "unassigned",
  ).length;
  if (unassigned !== envelope.health.unassignedCount) {
    violations.push("health.unassignedCount must match ownership evals");
  }

  return { ok: violations.length === 0, violations };
}

export function validateResponsibilityGraphLayerResult(
  layer: ResponsibilityGraphLayerResult,
): ResponsibilityGraphLayerResult["guarantee"] {
  return runResponsibilityGraphGuarantee(layer);
}
