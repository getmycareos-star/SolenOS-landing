import { REEVALUATION_MAX_AGE_MS, SITUATION_LIFECYCLE_STATUSES } from "./contract-constants";
import { countByStatus } from "./filters";
import type {
  ResolutionEngineGuaranteeResult,
  ResolutionEngineLayerResult,
  TrackedSituation,
} from "./types";

const STATUS_SET = new Set<string>(SITUATION_LIFECYCLE_STATUSES);

/**
 * System guarantee — at all times know active / resolved / archived.
 * No situation without lifecycle state.
 * ACTIVE cannot remain permanently without reevaluation.
 */
export function runResolutionEngineGuarantee(params: {
  situations: readonly TrackedSituation[];
  nowMs?: number;
}): ResolutionEngineGuaranteeResult {
  const violations: string[] = [];
  const nowMs = params.nowMs ?? Date.now();

  for (const s of params.situations) {
    if (!STATUS_SET.has(s.status)) {
      violations.push(`situation ${s.id} missing valid lifecycle state`);
    }

    if (!s.id) {
      violations.push("situation id required");
    }

    if (s.status === "RESOLVED" && !s.resolutionEvidence) {
      violations.push(`RESOLVED situation ${s.id} missing resolution evidence`);
    }

    if (s.status === "RESOLVED" && !s.resolvedAt) {
      violations.push(`RESOLVED situation ${s.id} missing resolvedAt`);
    }

    if (s.status === "ARCHIVED" && !s.archivedAt) {
      violations.push(`ARCHIVED situation ${s.id} missing archivedAt`);
    }

    // Preserve refs — presence is fine; deletion would be a consumer bug.
    // Guarantee: arrays must be defined (not null).
    if (!Array.isArray(s.timelineEntryIds) || !Array.isArray(s.memoryNodeIds) || !Array.isArray(s.documentIds)) {
      violations.push(`situation ${s.id} must preserve timeline/memory/document ref arrays`);
    }

    if (s.status === "ACTIVE") {
      const last = Date.parse(s.lastReevaluatedAt);
      if (!Number.isFinite(last)) {
        violations.push(`ACTIVE situation ${s.id} missing lastReevaluatedAt`);
      } else if (nowMs - last > REEVALUATION_MAX_AGE_MS) {
        violations.push(
          `ACTIVE situation ${s.id} exceeded reevaluation window without reevaluation`,
        );
      }
    }

    // History should reflect current status as last entry.
    const lastHistory = s.history[s.history.length - 1];
    if (lastHistory && lastHistory.toStatus !== s.status) {
      violations.push(`situation ${s.id} history status drift vs current status`);
    }
  }

  // Counts always computable — empty catalog is valid.
  countByStatus(params.situations);

  return { ok: violations.length === 0, violations };
}

export function validateResolutionEngineLayerResult(
  result: ResolutionEngineLayerResult,
  nowMs?: number,
): ResolutionEngineGuaranteeResult {
  return runResolutionEngineGuarantee({
    situations: result.situations,
    nowMs,
  });
}
