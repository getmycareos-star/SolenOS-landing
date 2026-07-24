import { RUNWAY_DISCLAIMER } from "../contract-constants";
import type { CareRecipientProfileData, PoolRunwayEntry, PoolRunwayView } from "../types";

const RECURRING_COST_HINTS: { pattern: RegExp; label: string; monthlyEstimate: number }[] = [
  { pattern: /\bproperty tax|taxes due\b/i, label: "Property tax", monthlyEstimate: 0 },
  { pattern: /\b(medication|prescription|denture|dental)\b/i, label: "Medical/dental costs", monthlyEstimate: 200 },
  { pattern: /\b(roof|plumb|electrical|repair)\b/i, label: "Home repair reserve", monthlyEstimate: 300 },
];

function seasonFromMonths(months: number): string {
  if (months <= 1) return "within the next few weeks";
  if (months <= 3) return "around early fall";
  if (months <= 6) return "in the next several months";
  return "beyond the next season — highly uncertain";
}

/**
 * Soft runway signal — not budgeting. Shows assumptions explicitly.
 */
export function computePoolRunway(
  profile: CareRecipientProfileData,
  optionalBudget: number | null,
  openItemDescriptions: string[] = [],
): PoolRunwayView {
  const generated_at = new Date().toISOString();
  const runways: PoolRunwayEntry[] = [];
  const hay = [
    ...openItemDescriptions,
    ...profile.tagged_event_log.slice(-10).map((e) => e.tag),
  ].join(" ");

  const assumptions: string[] = [];
  let monthlyBurn = 0;

  for (const hint of RECURRING_COST_HINTS) {
    if (hint.pattern.test(hay)) {
      if (hint.label === "Property tax") {
        assumptions.push("Property tax treated as annual lump — timing approximate");
        monthlyBurn += 200;
      } else {
        monthlyBurn += hint.monthlyEstimate;
        assumptions.push(`${hint.label} estimated at ~$${hint.monthlyEstimate}/month (rough)`);
      }
    }
  }

  if (monthlyBurn === 0) {
    monthlyBurn = 150;
    assumptions.push("No cost tags detected — using minimal placeholder burn rate");
  }

  if (optionalBudget != null && optionalBudget > 0) {
    const months = optionalBudget / monthlyBurn;
    runways.push({
      pool: "money",
      estimated_depletion_window: seasonFromMonths(months),
      confidence: months < 2 ? "medium" : "low",
      assumptions_used: [
        `Caregiver-entered budget: $${optionalBudget}`,
        `Estimated monthly draw: ~$${Math.round(monthlyBurn)}`,
        ...assumptions,
      ],
    });
  } else {
    runways.push({
      pool: "money",
      estimated_depletion_window: "unknown without a rough budget figure",
      confidence: "low",
      assumptions_used: [
        "No caregiver budget entered — cannot estimate depletion window",
        ...assumptions,
        "Add an optional budget figure for a soft range",
      ],
    });
  }

  runways.push({
    pool: "caregiver_time",
    estimated_depletion_window:
      openItemDescriptions.some((d) => /repair|full time|no backup/i.test(d))
        ? "tight within the next few weeks"
        : "moderate — monitor if repair labor continues",
    confidence: "low",
    assumptions_used: [
      "Based on open items mentioning repair labor, full-time work, or no backup",
      "Time runway is qualitative — not hour accounting",
    ],
  });

  return {
    runways,
    optional_budget: optionalBudget,
    generated_at,
    disclaimer: RUNWAY_DISCLAIMER,
  };
}
