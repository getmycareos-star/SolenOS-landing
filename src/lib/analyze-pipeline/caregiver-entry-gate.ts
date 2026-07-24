/**
 * Caregiver MVP entry is POST /api/situation only.
 * /api/analyze is an ops/engine path — hard-gated unless explicitly enabled.
 */

import { assertOpsAccess } from "../ops-console/access";

export const CAREGIVER_ENTRY_PIPELINE = "/api/situation" as const;
export const OPS_ANALYZE_PIPELINE = "/api/analyze" as const;

/** Header ops tooling may send to unlock /api/analyze when OPS_SECRET is set. */
export const ANALYZE_OPS_KEY_HEADER = "x-solenos-ops-key";

/**
 * Analyze is blocked for caregiver surfaces by default.
 * Allow when:
 * - SOLENOS_ENABLE_ANALYZE=1 (local engine / verify), or
 * - valid OPS_SECRET via x-solenos-ops-key
 */
export function isAnalyzePipelineEnabled(params?: {
  opsKey?: string | null;
}): boolean {
  if (process.env.SOLENOS_ENABLE_ANALYZE === "1") return true;
  if (process.env.SOLENOS_VERIFY === "1") return true;
  if (params?.opsKey && assertOpsAccess(params.opsKey)) return true;
  return false;
}

export function analyzePipelineDisabledResponse(): {
  error: string;
  caregiver_entry: typeof CAREGIVER_ENTRY_PIPELINE;
  status: 404;
} {
  return {
    error:
      "Analyze is not a caregiver entry path. Use /api/situation to preserve care in the Living Care Record.",
    caregiver_entry: CAREGIVER_ENTRY_PIPELINE,
    status: 404,
  };
}
