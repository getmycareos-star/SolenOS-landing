import { RUNWAY_DISCLAIMER } from "../contract-constants";
import type { CareRecipientProfileData, PoolRunwayView } from "../types";

/**
 * A runway estimate is only valid when the caregiver has supplied enough
 * quantified cost/time evidence. Text tags and keywords are not cost data.
 * Never infer dollar amounts, monthly burn, or time capacity from free text.
 */
export function computePoolRunway(
  _profile: CareRecipientProfileData,
  optionalBudget: number | null,
  _openItemDescriptions: string[] = [],
): PoolRunwayView {
  const assumptions = [
    "No verified recurring-cost amounts and frequencies are available; a money depletion estimate cannot be calculated.",
    "No measured caregiver-time capacity or time commitments are available; a time runway cannot be calculated.",
  ];

  if (optionalBudget != null && (!Number.isFinite(optionalBudget) || optionalBudget <= 0)) {
    assumptions.push("The supplied budget is not a valid positive finite amount and was not used.");
  } else if (optionalBudget != null) {
    assumptions.push(`Caregiver-entered budget: $${optionalBudget}; this is not enough by itself to calculate depletion without verified costs.`);
  } else {
    assumptions.push("No caregiver-entered budget is available.");
  }

  return {
    runways: [
      {
        pool: "money",
        estimated_depletion_window: "unknown — verified recurring costs and frequencies are required",
        confidence: "low",
        assumptions_used: assumptions,
      },
      {
        pool: "caregiver_time",
        estimated_depletion_window: "unknown — measured available time and commitments are required",
        confidence: "low",
        assumptions_used: [
          "No measured time capacity or quantified commitments were provided.",
          "Free-text keywords are not sufficient evidence for a time-runway estimate.",
        ],
      },
    ],
    optional_budget:
      optionalBudget != null && Number.isFinite(optionalBudget) && optionalBudget > 0
        ? optionalBudget
        : null,
    generated_at: new Date().toISOString(),
    disclaimer: RUNWAY_DISCLAIMER,
  };
}
