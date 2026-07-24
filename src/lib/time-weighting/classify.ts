import { CURVE_DEFAULT_THRESHOLDS } from "./contract-constants";
import type {
  CurveClassificationResult,
  CurveClassificationSignals,
  TimeCurveType,
  TimeThresholds,
} from "./types";
import { thresholdsForCurve } from "./thresholds";

const MEDICATION_DEP_SIGNALS = [
  /\binsulin\b/i,
  /\banticoagul/i,
  /\bwarfarin\b/i,
  /\bcoumadin\b/i,
  /\bbiologics?\b/i,
  /\bepilep/i,
  /\bseizure med/i,
  /\bmissed (dose|medication|pill|refill)\b/i,
  /\bmedication (refill|dependent|critical)\b/i,
  /\bblood thinner\b/i,
] as const;

const ACUTE_MEDICAL_SIGNALS = [
  /\bdischarge\b/i,
  /\bsurgery\b/i,
  /\bpost[- ]?op\b/i,
  /\bhospital\b/i,
  /\bemergen/i,
  /\bacute\b/i,
  /\bworsening\b/i,
  /\bED\b/,
  /\ber visit\b/i,
] as const;

const CHRONIC_SIGNALS = [
  /\bphysio\b/i,
  /\bphysical therap/i,
  /\bhome mod/i,
  /\bchronic\b/i,
  /\brehab\b/i,
  /\blong[- ]?term\b/i,
  /\broutine care\b/i,
] as const;

const SOCIAL_SIGNALS = [
  /\bschedule\b/i,
  /\bcoordinat/i,
  /\bfamily (meeting|conflict|call)\b/i,
  /\bappoint/i,
  /\btransport/i,
  /\bcare coordination\b/i,
  /\bvisit timing\b/i,
] as const;

const SAFETY_OVERRIDE_SIGNALS = [
  /\bmissed seizure\b/i,
  /\bseizure med/i,
  /\bdischarge without\b/i,
  /\bnot ready (for )?discharge\b/i,
  /\bunready for discharge\b/i,
  /\bcritical (med|medication) (miss|gap)\b/i,
  /\bsafety critical\b/i,
] as const;

function countMatches(text: string, patterns: readonly RegExp[]): number {
  return patterns.filter((p) => p.test(text)).length;
}

function thresholdsCopy(curve: TimeCurveType): TimeThresholds {
  return thresholdsForCurve(curve);
}

/**
 * Situation → TimeCurveType classifier (deterministic heuristics).
 * Never invents urgency; only maps objective signals → curve class.
 *
 * Precedence:
 * 1. explicit override
 * 2. SAFETY_CRITICAL_OVERRIDE keywords
 * 3. MEDICATION_DEPENDENT keywords
 * 4. emergency / CRITICAL / acute keywords → ACUTE_MEDICAL
 * 5. medical_event / medical category → ACUTE_MEDICAL
 * 6. chronic keywords / daily_routine / follow_up → CHRONIC_CARE
 * 7. social / administrative / coordination categories → SOCIAL_COORDINATION
 * 8. uncertain/monitoring → CHRONIC_CARE
 * 9. default → CHRONIC_CARE
 */
export function classifyTimeCurve(
  signals: CurveClassificationSignals,
): CurveClassificationResult {
  if (signals.explicitCurveType) {
    return {
      curveType: signals.explicitCurveType,
      thresholds: thresholdsCopy(signals.explicitCurveType),
      reasons: [`explicit curve override: ${signals.explicitCurveType}`],
    };
  }

  const text = (signals.text ?? "").trim();
  const reasons: string[] = [];
  const situationType = (signals.situationType ?? "").toLowerCase();
  const category = (signals.demandCategory ?? "").toLowerCase();
  const risk = (signals.riskLevel ?? "").toUpperCase();

  if (countMatches(text, SAFETY_OVERRIDE_SIGNALS) > 0) {
    reasons.push("keyword: safety-critical override pattern");
    return {
      curveType: "SAFETY_CRITICAL_OVERRIDE",
      thresholds: thresholdsCopy("SAFETY_CRITICAL_OVERRIDE"),
      reasons,
    };
  }

  if (countMatches(text, MEDICATION_DEP_SIGNALS) > 0) {
    reasons.push("keyword: medication-dependent pattern");
    return {
      curveType: "MEDICATION_DEPENDENT",
      thresholds: thresholdsCopy("MEDICATION_DEPENDENT"),
      reasons,
    };
  }

  if (
    situationType === "emergency" ||
    risk === "CRITICAL" ||
    countMatches(text, ACUTE_MEDICAL_SIGNALS) > 0
  ) {
    if (situationType === "emergency") reasons.push("care-context: emergency");
    if (risk === "CRITICAL") reasons.push("riskLevel: CRITICAL");
    if (countMatches(text, ACUTE_MEDICAL_SIGNALS) > 0) {
      reasons.push("keyword: acute medical pattern");
    }
    return {
      curveType: "ACUTE_MEDICAL",
      thresholds: thresholdsCopy("ACUTE_MEDICAL"),
      reasons,
    };
  }

  if (situationType === "medical_event" || category === "medical") {
    reasons.push(
      situationType === "medical_event"
        ? "care-context: medical_event → acute"
        : "demand category: medical → acute",
    );
    return {
      curveType: "ACUTE_MEDICAL",
      thresholds: thresholdsCopy("ACUTE_MEDICAL"),
      reasons,
    };
  }

  if (
    countMatches(text, CHRONIC_SIGNALS) > 0 ||
    situationType === "daily_routine" ||
    situationType === "follow_up"
  ) {
    if (countMatches(text, CHRONIC_SIGNALS) > 0) reasons.push("keyword: chronic care");
    if (situationType === "daily_routine" || situationType === "follow_up") {
      reasons.push(`care-context: ${situationType} → chronic`);
    }
    return {
      curveType: "CHRONIC_CARE",
      thresholds: thresholdsCopy("CHRONIC_CARE"),
      reasons,
    };
  }

  if (
    countMatches(text, SOCIAL_SIGNALS) > 0 ||
    situationType === "administrative" ||
    category === "care_coordination" ||
    category === "family_conflict" ||
    category === "transportation" ||
    category === "financial" ||
    category === "legal"
  ) {
    reasons.push(
      countMatches(text, SOCIAL_SIGNALS) > 0
        ? "keyword: social/coordination"
        : `category/type: ${category || situationType} → social`,
    );
    return {
      curveType: "SOCIAL_COORDINATION",
      thresholds: thresholdsCopy("SOCIAL_COORDINATION"),
      reasons,
    };
  }

  if (situationType === "uncertain_state" || category === "monitoring") {
    reasons.push("uncertain/monitoring → chronic (linear default)");
    return {
      curveType: "CHRONIC_CARE",
      thresholds: thresholdsCopy("CHRONIC_CARE"),
      reasons,
    };
  }

  reasons.push("default: chronic care linear curve");
  return {
    curveType: "CHRONIC_CARE",
    thresholds: { ...CURVE_DEFAULT_THRESHOLDS.CHRONIC_CARE },
    reasons,
  };
}
