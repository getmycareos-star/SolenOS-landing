import type { CareProfile } from "../../care-profile/types";
import type { SituationalCareContext } from "./types";

/**
 * Validate situational care context against Care Profile — context may escalate urgency
 * temporarily but must never mutate identity graph fields.
 */
export function validateCareContextAgainstProfile(
  context: SituationalCareContext,
  profile: CareProfile,
): { ok: boolean; violations: string[] } {
  const violations: string[] = [];

  if (!profile) {
    violations.push("care profile required for cross-layer validation");
    return { ok: false, violations };
  }

  if (context.activeConstraints.some((c) => c.startsWith("profile_role_override"))) {
    violations.push("care context must not override care profile role");
  }

  if (
    profile.roleInCareGraph === "observer" &&
    context.situationType === "emergency" &&
    context.urgencyLevel !== "CRITICAL"
  ) {
    violations.push("emergency context for observer role must still escalate to CRITICAL urgency");
  }

  return { ok: violations.length === 0, violations };
}
