import {
  PATTERN_INTELLIGENCE_BOUNDARY,
  PATTERN_INTELLIGENCE_IDENTITY,
} from "./contract-constants";
import type { PatternIntelligenceLayerPayload, PatternIntelligenceResult } from "./types";

export function toPatternIntelligenceLayerPayload(
  result: PatternIntelligenceResult,
): PatternIntelligenceLayerPayload {
  return {
    identity: PATTERN_INTELLIGENCE_IDENTITY,
    boundary: PATTERN_INTELLIGENCE_BOUNDARY,
    result,
  };
}
