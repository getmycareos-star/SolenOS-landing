import type { EventStatus } from "../event-normalization/types";
import type { CareEventIntegrity, CareEventLifecycleStatus } from "./types";
import { createDefaultIntegrityFields } from "./confidence";

export function mapNormalizationStatusToLifecycle(
  normStatus: EventStatus,
  confidence: number,
): CareEventLifecycleStatus {
  if (normStatus === "quarantined" || normStatus === "needs_user_confirmation") {
    return "provisional";
  }
  if (confidence < 0.65) return "provisional";
  return "committed";
}

export function createIntegrityState(params: {
  confidenceScore: number;
  userConfirmed?: boolean;
  originalExtraction?: string;
  sources?: CareEventIntegrity["sources"];
}): CareEventIntegrity {
  return {
    field_confidence: createDefaultIntegrityFields(
      params.confidenceScore,
      params.userConfirmed ?? false,
    ),
    sources: params.sources ?? ["ai_inference"],
    superseded_by_id: null,
    supersedes_id: null,
    original_extraction: params.originalExtraction ?? null,
    correction_count: 0,
    audit_trail_ids: [],
  };
}

export function isActiveLifecycleStatus(status: CareEventLifecycleStatus): boolean {
  return status !== "invalidated" && status !== "superseded";
}

export function attachAuditId(integrity: CareEventIntegrity, auditId: string): CareEventIntegrity {
  return {
    ...integrity,
    audit_trail_ids: [...integrity.audit_trail_ids, auditId],
    correction_count: integrity.correction_count + 1,
  };
}

export function markSuperseded(
  integrity: CareEventIntegrity,
  supersededById: string,
  auditId: string,
): CareEventIntegrity {
  return attachAuditId(
    {
      ...integrity,
      superseded_by_id: supersededById,
    },
    auditId,
  );
}

export function markUserCorrected(integrity: CareEventIntegrity): CareEventIntegrity {
  return {
    ...integrity,
    sources: ["user_correction", ...integrity.sources.filter((s) => s !== "user_correction")],
    field_confidence: {
      extracted_fact: {
        extraction: "high",
        user_confirmed: true,
      },
      event_time: {
        ...integrity.field_confidence.event_time,
        user_confirmed: true,
      },
    },
  };
}
