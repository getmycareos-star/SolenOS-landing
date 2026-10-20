import type { BehaviorProfile } from "../input-classification";
import type { CareContextState } from "./contract-constants";

/** Micro tone experiment — verbosity only, no schema/UI/workflow changes. */
const POST_CARE_VERBOSITY_FACTOR_MULTIPLIER = 0.92;
const POST_CARE_MIN_VERBOSITY_FACTOR = 0.75;

/**
 * OPTIONAL: slightly reduce action density when post_care — verbosity_factor tweak only.
 * Does NOT branch pipeline, schema, or UI.
 */
export function applyPostCareToneAdjustment(
  profile: BehaviorProfile,
  careContextState: CareContextState,
): BehaviorProfile {
  if (careContextState !== "post_care") {
    return profile;
  }

  return {
    ...profile,
    verbosity_factor: Math.max(
      POST_CARE_MIN_VERBOSITY_FACTOR,
      profile.verbosity_factor * POST_CARE_VERBOSITY_FACTOR_MULTIPLIER,
    ),
  };
}
