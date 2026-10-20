import {
  CARE_REALITY_PROFILE_DEFINING_PRINCIPLE,
  CARE_REALITY_PROFILE_RULES,
} from "./contract-constants";
import { buildCareRealityProfile } from "./build-profile";
import type { CareRealityProfileResult, ProcessCareRealityProfileInput } from "./types";

export function processCareRealityProfile(
  input: ProcessCareRealityProfileInput,
): CareRealityProfileResult {
  const profile = buildCareRealityProfile(input);

  return {
    active: input.all_events.length > 0 || (input.baseline?.active ?? false),
    profile,
    rules_upheld: [...CARE_REALITY_PROFILE_RULES],
    defining_principle: CARE_REALITY_PROFILE_DEFINING_PRINCIPLE,
  };
}

export { CARE_REALITY_PROFILE_IDENTITY } from "./contract-constants";
