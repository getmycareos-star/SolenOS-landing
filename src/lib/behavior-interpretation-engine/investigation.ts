import type { InvestigationDomain, InvestigationItem } from "./types";

const PHYSICAL_ITEMS = [
  "pain",
  "hunger",
  "thirst",
  "constipation",
  "urinary discomfort",
  "possible infection",
  "medication side effects",
  "fatigue",
  "dehydration",
] as const;

const ENVIRONMENTAL_ITEMS = [
  "excessive noise",
  "unfamiliar surroundings",
  "recent routine change",
  "temperature discomfort",
  "overstimulation",
  "understimulation",
] as const;

const EMOTIONAL_ITEMS = [
  "loneliness",
  "grief",
  "boredom",
  "fear",
  "confusion",
  "frustration",
] as const;

function toChecklist(domain: InvestigationDomain, items: readonly string[]): InvestigationItem[] {
  return items.map((item) => ({ domain, item, checked: false as const }));
}

export function buildInvestigationChecklist(behaviorIds: string[]): InvestigationItem[] {
  const checklist = [
    ...toChecklist("physical", PHYSICAL_ITEMS),
    ...toChecklist("environmental", ENVIRONMENTAL_ITEMS),
    ...toChecklist("emotional", EMOTIONAL_ITEMS),
  ];

  if (behaviorIds.includes("refuses_medication") || behaviorIds.includes("refuses_food")) {
    checklist.unshift(
      { domain: "physical", item: "medication side effects or swallowing difficulty", checked: false },
    );
  }

  if (behaviorIds.includes("agitation") || behaviorIds.includes("night_wandering")) {
    checklist.unshift(
      { domain: "environmental", item: "evening noise and lighting changes", checked: false },
    );
  }

  return checklist.slice(0, 18);
}

export function buildRecommendedApproach(needs: string[]): string[] {
  const approaches = [
    "Lead with emotional validation before problem-solving.",
    "Offer simple choices to preserve autonomy.",
    "Reduce pressure — slow pace and calm tone.",
    "Simplify communication — one step at a time.",
  ];

  if (needs.includes("reassurance")) {
    approaches.unshift("Provide brief, consistent reassurance without over-explaining.");
  }
  if (needs.includes("orientation_support")) {
    approaches.push("Use familiar objects or photos — avoid arguing about facts.");
  }
  if (needs.includes("reduced_stimulation")) {
    approaches.push("Move to a quieter space and reduce simultaneous demands.");
  }

  return [...new Set(approaches)].slice(0, 6);
}
