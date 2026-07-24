/** @deprecated _meta removed from SolenOS schema — legacy process adapter stub. */
export interface LegacyProcessMeta {
  context_completeness: number;
  missing_critical_fact: string | null;
  confidence: "low" | "medium" | "high" | "unknown";
}

/** @deprecated */
export function legacyProcessMeta(params: {
  classification: string;
  domain: string;
  priority_score: number;
  confidence: number;
  safe_mode: boolean;
  missing_fact?: string | null;
}): LegacyProcessMeta {
  return {
    context_completeness: Math.min(1, Math.max(0, params.priority_score)),
    missing_critical_fact:
      params.missing_fact ??
      (params.safe_mode ? "baseline context incomplete for safe prioritization" : null),
    confidence:
      params.confidence >= 0.65 ? "high" : params.confidence >= 0.45 ? "medium" : "low",
  };
}

/** @deprecated Use legacyProcessMeta */
export const legacyProcessTrace = legacyProcessMeta;
