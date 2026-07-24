import { MRE_BOUNDARY, MRE_IDENTITY } from "./contract-constants";
import type { MemoryReconstructionLayerPayload, MemoryReconstructionResult } from "./types";

export function toMemoryReconstructionLayerPayload(
  result: MemoryReconstructionResult,
): MemoryReconstructionLayerPayload {
  return {
    identity: MRE_IDENTITY,
    boundary: MRE_BOUNDARY,
    result,
  };
}
