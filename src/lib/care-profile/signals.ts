import type { CareGraphRole, CareProfile, InferenceSignal } from "./types";

const DEPENDENCY_PATTERNS: readonly { pattern: RegExp; label: string }[] = [
  { pattern: /\bmy (?:mom|mother|dad|father|parent|wife|husband|spouse|partner)\b/i, label: "family dependent" },
  { pattern: /\bcaring for (?:my )?\w+/i, label: "caring for dependent" },
  { pattern: /\btake care of (?:my )?\w+/i, label: "take care of dependent" },
  { pattern: /\b(?:elderly|aging) (?:parent|relative)\b/i, label: "elderly relative" },
];

const MEDICATION_PATTERNS: readonly RegExp[] = [
  /\b(?:missed|forgot|skip(?:ped)?) (?:her|his|their|the)? ?(?:dose|medication|pill|medicine)\b/i,
  /\bmedication reminder\b/i,
  /\bpill(?:s)? (?:schedule|time|reminder)\b/i,
  /\b(?:daily|morning|evening|night) meds?\b/i,
];

const MOBILITY_PATTERNS: readonly RegExp[] = [
  /\b(?:wheelchair|walker|mobility aid|transfer(?:ring)?|fall risk)\b/i,
  /\b(?:help(?:ing)? (?:her|him|them) (?:walk|stand|move|get up))\b/i,
  /\b(?:bedbound|bed bound|immobile)\b/i,
];

const SHARED_CARE_PATTERNS: readonly RegExp[] = [
  /\b(?:my )?(?:sister|brother|sibling|siblings) (?:and I|help(?:s)?|share)\b/i,
  /\bwe (?:share|split) (?:care|caregiving|responsibilities?)\b/i,
  /\bshared caregiv(?:ing|er)\b/i,
];

const EXTERNAL_CAREGIVER_PATTERNS: readonly RegExp[] = [
  /\b(?:home (?:health|care) aide|nurse|caregiver|hospice|aide)\b/i,
  /\bexternal (?:care|caregiver|help)\b/i,
  /\bprofessional caregiver\b/i,
];

const USER_CONFIRMED_ROLE_PATTERNS: readonly { pattern: RegExp; role: CareGraphRole }[] = [
  { pattern: /\bI am (?:the )?primary caregiver\b/i, role: "primary_caregiver" },
  { pattern: /\bI(?:'m| am) caring for (?:my )?\w+ now\b/i, role: "primary_caregiver" },
  { pattern: /\bI am (?:a )?secondary caregiver\b/i, role: "secondary_caregiver" },
  { pattern: /\bwe share (?:care|caregiving) equally\b/i, role: "shared_caregiver" },
  { pattern: /\bI(?:'m| am) (?:just )?(?:observing|an observer)\b/i, role: "observer" },
];

const WORKLOAD_HIGH_PATTERNS: readonly RegExp[] = [
  /\b24\/7\b/i,
  /\ball (?:day|night|the time)\b/i,
  /\bno one else (?:helping|helps)\b/i,
  /\boverwhelmed\b/i,
  /\bcan(?:'t| not) keep up\b/i,
];

const WORKLOAD_LOW_PATTERNS: readonly RegExp[] = [
  /\b(?:family|siblings?) (?:help|helps|pitch in)\b/i,
  /\b(?:respite|break|time off)\b/i,
  /\bmanageable (?:load|schedule)\b/i,
];

const TIME_MORNING_PATTERNS: readonly RegExp[] = [
  /\b(?:morning|breakfast|AM) (?:routine|meds|care)\b/i,
  /\bearly morning\b/i,
];

const TIME_NIGHT_PATTERNS: readonly RegExp[] = [
  /\b(?:night|overnight|midnight|evening|bedtime) (?:shift|care|meds)\b/i,
  /\b(?:sundown|nighttime) (?:confusion|agitation)\b/i,
];

function extractDependentLabel(input: string): string | null {
  for (const { pattern, label } of DEPENDENCY_PATTERNS) {
    if (pattern.test(input)) return label;
  }
  return null;
}

/**
 * Detect inference signals from user input — dependency language, medication patterns, role statements.
 */
export function detectInferenceSignals(input: string): InferenceSignal[] {
  const signals: InferenceSignal[] = [];
  const normalized = input.trim();
  if (!normalized) return signals;

  const dependent = extractDependentLabel(normalized);
  if (dependent) {
    signals.push({
      kind: "dependency_language",
      confidence: 0.75,
      detail: `dependency language: ${dependent}`,
      partial: {
        careRelationships: {
          dependents: [dependent],
          sharedCareWith: [],
          externalCaregivers: [],
        },
      },
    });
  }

  for (const pattern of MEDICATION_PATTERNS) {
    if (pattern.test(normalized)) {
      signals.push({
        kind: "medication_pattern",
        confidence: 0.8,
        detail: "medication caregiving pattern detected",
        partial: {
          conditionSignals: { medicationReminders: true, mobilityAssistance: false },
        },
      });
      break;
    }
  }

  for (const pattern of MOBILITY_PATTERNS) {
    if (pattern.test(normalized)) {
      signals.push({
        kind: "mobility_pattern",
        confidence: 0.78,
        detail: "mobility assistance pattern detected",
        partial: {
          conditionSignals: { medicationReminders: false, mobilityAssistance: true },
        },
      });
      break;
    }
  }

  for (const pattern of SHARED_CARE_PATTERNS) {
    if (pattern.test(normalized)) {
      signals.push({
        kind: "shared_care_language",
        confidence: 0.82,
        detail: "shared caregiving language detected",
        partial: {
          roleInCareGraph: "shared_caregiver",
          careRelationships: {
            dependents: dependent ? [dependent] : [],
            sharedCareWith: ["family member"],
            externalCaregivers: [],
          },
        },
      });
      break;
    }
  }

  for (const pattern of EXTERNAL_CAREGIVER_PATTERNS) {
    if (pattern.test(normalized)) {
      signals.push({
        kind: "external_caregiver_language",
        confidence: 0.76,
        detail: "external caregiver reference detected",
        partial: {
          careRelationships: {
            dependents: dependent ? [dependent] : [],
            sharedCareWith: [],
            externalCaregivers: ["professional caregiver"],
          },
        },
      });
      break;
    }
  }

  for (const { pattern, role } of USER_CONFIRMED_ROLE_PATTERNS) {
    if (pattern.test(normalized)) {
      signals.push({
        kind: "user_confirmed_role",
        confidence: 1,
        detail: `user confirmed role: ${role}`,
        partial: { roleInCareGraph: role },
      });
      break;
    }
  }

  if (/\bI am caring for my \w+ now\b/i.test(normalized)) {
    signals.push({
      kind: "user_confirmed_dependent",
      confidence: 1,
      detail: "user confirmed active caregiving",
      partial: {
        roleInCareGraph: "primary_caregiver",
        careRelationships: {
          dependents: dependent ? [dependent] : ["confirmed dependent"],
          sharedCareWith: [],
          externalCaregivers: [],
        },
      },
    });
  }

  if (WORKLOAD_HIGH_PATTERNS.some((p) => p.test(normalized))) {
    signals.push({
      kind: "dependency_language",
      confidence: 0.85,
      detail: "high workload intensity signal",
      partial: { workloadIntensity: "HIGH" },
    });
  } else if (WORKLOAD_LOW_PATTERNS.some((p) => p.test(normalized))) {
    signals.push({
      kind: "dependency_language",
      confidence: 0.7,
      detail: "low workload intensity signal",
      partial: { workloadIntensity: "LOW" },
    });
  }

  if (TIME_MORNING_PATTERNS.some((p) => p.test(normalized))) {
    signals.push({
      kind: "dependency_language",
      confidence: 0.72,
      detail: "morning time sensitivity signal",
      partial: { timeSensitivity: "morning" },
    });
  } else if (TIME_NIGHT_PATTERNS.some((p) => p.test(normalized))) {
    signals.push({
      kind: "dependency_language",
      confidence: 0.72,
      detail: "night time sensitivity signal",
      partial: { timeSensitivity: "night" },
    });
  }

  return signals;
}

export function mergePartialProfile(base: CareProfile, partial: Partial<CareProfile>): CareProfile {
  return {
    roleInCareGraph: partial.roleInCareGraph ?? base.roleInCareGraph,
    careRelationships: {
      dependents: partial.careRelationships?.dependents ?? base.careRelationships.dependents,
      sharedCareWith: partial.careRelationships?.sharedCareWith ?? base.careRelationships.sharedCareWith,
      externalCaregivers:
        partial.careRelationships?.externalCaregivers ?? base.careRelationships.externalCaregivers,
    },
    conditionSignals: {
      medicationReminders:
        partial.conditionSignals?.medicationReminders ?? base.conditionSignals.medicationReminders,
      mobilityAssistance:
        partial.conditionSignals?.mobilityAssistance ?? base.conditionSignals.mobilityAssistance,
    },
    workloadIntensity: partial.workloadIntensity ?? base.workloadIntensity,
    timeSensitivity: partial.timeSensitivity ?? base.timeSensitivity,
  };
}

export function mergeDependentsUnique(existing: string[], incoming: string[]): string[] {
  const set = new Set(existing);
  for (const dep of incoming) {
    if (dep.trim()) set.add(dep.trim());
  }
  return [...set];
}
