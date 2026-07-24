import type {
  SystemHealth,
  SystemHealthGuaranteeResult,
  SystemHealthLayerResult,
} from "./types";

/**
 * System guarantee before every recommendation:
 * Check context, memory, contradictions, critical documents.
 * If health too degraded: reduce autonomy, increase uncertainty, request clarification
 * (enforced via PreRecommendationGate — this validates the check occurred).
 */
export function runSystemHealthGuarantee(params: {
  health: SystemHealth;
  contextChecked: boolean;
  memoryChecked: boolean;
  contradictionsChecked: boolean;
  criticalDocumentsChecked: boolean;
  band: string;
}): SystemHealthGuaranteeResult {
  const violations: string[] = [];

  if (!params.contextChecked) {
    violations.push("context must be checked before recommendation");
  }
  if (!params.memoryChecked) {
    violations.push("memory must be checked before recommendation");
  }
  if (!params.contradictionsChecked) {
    violations.push("contradictions must be checked before recommendation");
  }
  if (!params.criticalDocumentsChecked) {
    violations.push("critical documents must be checked before recommendation");
  }

  if (
    params.health.contradictionHealth.unresolvedContradictions > 0 &&
    (params.band === "Strong" || params.band === "Stable")
  ) {
    // Soft warning — contradictions must reduce score; overall should not stay Strong with many unresolved.
    if (params.health.contradictionHealth.unresolvedContradictions >= 3) {
      violations.push(
        "unresolved contradictions incompatible with Strong/Stable readiness without score reduction",
      );
    }
  }

  if (
    typeof params.health.overallHealthScore !== "number" ||
    !Number.isFinite(params.health.overallHealthScore) ||
    params.health.overallHealthScore < 0 ||
    params.health.overallHealthScore > 100
  ) {
    violations.push("overallHealthScore must be a finite number in 0–100");
  }

  // Forbid infrastructure metric leakage in counters (they are always numbers of care signals).
  const keys = Object.keys(params.health) as (keyof SystemHealth)[];
  for (const key of keys) {
    if (/cpu|latency|uptime|api|db|infra/i.test(String(key))) {
      violations.push(`forbidden infrastructure signal key: ${String(key)}`);
    }
  }

  return {
    ok: violations.length === 0,
    violations,
    checked: {
      context: params.contextChecked,
      memory: params.memoryChecked,
      contradictions: params.contradictionsChecked,
      criticalDocuments: params.criticalDocumentsChecked,
    },
  };
}

export function validateSystemHealthLayerResult(
  result: SystemHealthLayerResult,
): SystemHealthGuaranteeResult {
  return runSystemHealthGuarantee({
    health: result.health,
    contextChecked: result.guarantee.checked.context,
    memoryChecked: result.guarantee.checked.memory,
    contradictionsChecked: result.guarantee.checked.contradictions,
    criticalDocumentsChecked: result.guarantee.checked.criticalDocuments,
    band: result.band,
  });
}
