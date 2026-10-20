import type {
  AssumptionInfluenceEnvelope,
  AssumptionRegistryLayerResult,
  AssumptionRegistryState,
} from "./types";
import { getInfluenceableAssumptions } from "./influence";

export function runAssumptionRegistryGuarantee(params: {
  state: AssumptionRegistryState;
  envelope: AssumptionInfluenceEnvelope;
}): AssumptionRegistryLayerResult["guarantee"] {
  const violations: string[] = [];

  const influenceable = getInfluenceableAssumptions(params.state);
  const nonInfluenceableInfluencing = params.state.assumptions.filter(
    (a) =>
      (a.status === "invalidated" || a.status === "expired") &&
      params.envelope.influenceHints.some((h) => h.includes(a.statement.slice(0, 40))),
  );
  if (nonInfluenceableInfluencing.length > 0) {
    violations.push("invalidated or expired assumptions must not appear in influence hints");
  }

  if (params.envelope.compositeBias > 0 && influenceable.length === 0) {
    violations.push("composite bias requires at least one influenceable assumption");
  }

  if (params.envelope.compositeBias > 0.25) {
    violations.push("assumption composite bias exceeds influence cap");
  }

  for (const assumption of params.state.assumptions) {
    if (!assumption.statement.trim()) {
      violations.push("assumption statement must not be empty");
    }
    if (assumption.confidence < 0 || assumption.confidence > 1) {
      violations.push(`assumption confidence out of range: ${assumption.assumptionId}`);
    }
  }

  return { ok: violations.length === 0, violations };
}

export function validateAssumptionRegistryLayerResult(
  layer: AssumptionRegistryLayerResult,
): AssumptionRegistryLayerResult["guarantee"] {
  return runAssumptionRegistryGuarantee({
    state: layer.state,
    envelope: layer.envelope,
  });
}
