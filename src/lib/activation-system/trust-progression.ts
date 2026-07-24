import {
  TRUST_STAGE_BUILDING_MAX,
  TRUST_STAGE_EARLY_MAX,
} from "./contract-constants";
import type { TrustStage } from "./types";

export function computeTrustStage(totalEntries: number): TrustStage {
  if (totalEntries <= TRUST_STAGE_EARLY_MAX) return "early";
  if (totalEntries <= TRUST_STAGE_BUILDING_MAX) return "building";
  return "established";
}

export function trustStageAllowsOptionalContext(stage: TrustStage): boolean {
  return stage === "building" || stage === "established";
}

export function trustStageAllowsRichContinuity(stage: TrustStage): boolean {
  return stage === "established";
}
