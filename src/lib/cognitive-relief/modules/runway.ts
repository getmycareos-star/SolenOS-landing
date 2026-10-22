import { RUNWAY_DISCLAIMER } from "../contract-constants";
import type { CareRecipientProfileData, PoolRunwayEntry, PoolRunwayView } from "../types";

/**
 * Deliberately does not infer spending rates or caregiver capacity from free text.
 * A budget without verified recurring-cost amounts is not enough to calculate a
 * depletion window. Return explicit unknowns rather than plausible-looking
 * estimates derived from keywords or placeholder dollar amounts.
 */
export function computePoolRunway(
  _profile: CareRecipientProfileData,
  optionalBudget: number | null,
  _openItemDescriptions: string[] = [],
): PoolRunwayView {
  const runways: PoolRunwayEntry[] = [
    {
      pool: "money",
      estimated_depletion_window:
        optionalBudget != null && optionalBudget > 0
          ? "unknown — verified recurring-cost amounts are not available"
          : "unknown — no caregiver-entered budget is available",
      confidence: "low",
      assumptions_used: [
        ...(optionalBudget != null && optionalBudget > 0
          ? [`Caregiver-entered budget: $${optionalBudget}`]
          : ["No caregiver-entered budget was supplied"]),
        "No verified recurring-cost amounts were supplied",
        "No depletion estimate has been calculated",
      ],
    },
    {
      pool: "caregiver_time",
      estimated_depletion_window:
        "unknown — structured workload and available-support data are not available",
      confidence: "low",
      assumptions_used: [
        "Free-text descriptions are not converted into a time-capacity estimate",
        "No caregiver-time depletion estimate has been calculated",
      ],
    },
  ];

  return {
    runways,
    optional_budget: optionalBudget,
    generated_at: new Date().toISOString(),
    disclaimer: RUNWAY_DISCLAIMER,
  };
}
