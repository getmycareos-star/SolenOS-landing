import type {
  CaregiverPsychologicalLoadGuaranteeResult,
  CaregiverPsychologicalLoadResult,
} from "./types";

export function runCaregiverPsychologicalLoadGuarantee(
  result: CaregiverPsychologicalLoadResult,
): CaregiverPsychologicalLoadGuaranteeResult {
  const violations: string[] = [];

  if (result.moralInjury.contributionToLoad < 0 || result.moralInjury.contributionToLoad > 1) {
    violations.push("moralInjury.contributionToLoad must be 0–1");
  }

  if (result.containmentMode.engaged && result.containmentMode.maxActions > 1) {
    violations.push("containment engaged must cap maxActions at 1");
  }

  if (
    result.highSignalStress.acuteCaregiverBurnoutRiskState &&
    !result.containmentMode.engaged
  ) {
    violations.push("acute burnout risk state must engage containment mode");
  }

  if (
    result.highSignalStress.acuteCaregiverBurnoutRiskState &&
    !result.containmentMode.acuteBurnoutTriggered
  ) {
    violations.push("acute burnout must flag acuteBurnoutTriggered on containment");
  }

  if (
    result.emotionalValidation?.normalizeExperience &&
    !result.emotionalValidation.message.trim()
  ) {
    violations.push("emotional validation message must be non-empty when triggered");
  }

  return { ok: violations.length === 0, violations };
}
