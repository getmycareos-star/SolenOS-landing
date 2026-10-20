import type { ContentTopic } from "./types";

/**
 * Marketing / SEO content topics only — NOT caregiver product UI.
 * Content attracts search demand; product validates continuity demand.
 * Never import into Living Care Record / mvp-workspace panels.
 */
export const CONTENT_TOPICS_SURFACE = "marketing_content_only" as const;

/**
 * Priority content topics aligned with SolenOS continuity value proposition.
 */
export const PRIORITY_CONTENT_TOPICS: ContentTopic[] = [
  {
    id: "24-7-care-threshold",
    title: "How do I know if my parent needs 24/7 care?",
    priority: "highest",
    signalThemes: ["disease_progression", "decision_making"],
    continuityHook:
      "Threshold questions require comparing behavior changes over time — exactly what CareContext tracks.",
    demandType: "mixed",
    educatesFirst: true,
  },
  {
    id: "warning-signs-professional-care",
    title: "Warning signs a parent needs professional care",
    priority: "highest",
    signalThemes: ["disease_progression"],
    continuityHook:
      "Warning signs only become visible when observed across a timeline, not in a single moment.",
    demandType: "search",
    educatesFirst: true,
  },
  {
    id: "preventing-burnout",
    title: "Preventing caregiver burnout",
    priority: "highest",
    signalThemes: ["emotional_burden"],
    continuityHook:
      "Burnout builds over weeks of undocumented load — SolenOS surfaces the accumulating pattern.",
    demandType: "continuity",
    educatesFirst: true,
  },
  {
    id: "work-dementia-balance",
    title: "Balancing work and dementia caregiving",
    priority: "highest",
    signalThemes: ["emotional_burden", "care_coordination"],
    continuityHook:
      "Work-care conflict is a continuity problem: what changed while you were away?",
    demandType: "continuity",
    educatesFirst: true,
  },
  {
    id: "memory-care-vs-home",
    title: "Memory care vs staying at home",
    priority: "highest",
    signalThemes: ["decision_making"],
    continuityHook:
      "This decision depends on how care needs have evolved — not a static checklist.",
    demandType: "mixed",
    educatesFirst: true,
  },
  {
    id: "deceased-parent-requests",
    title: "When someone asks for a parent who has died — hold it on their timeline",
    priority: "high",
    signalThemes: ["disease_progression"],
    continuityHook:
      "New behaviors mark progression events that belong on the care timeline.",
    demandType: "search",
    educatesFirst: true,
  },
  {
    id: "supervision-by-stage",
    title: "How supervision needs change for this person over time",
    priority: "high",
    signalThemes: ["disease_progression"],
    continuityHook:
      "Guidance becomes actionable when mapped to this person's actual care timeline.",
    demandType: "search",
    educatesFirst: true,
  },
  {
    id: "what-changed-intro",
    title: "What changed? Introducing continuity and CareContext",
    priority: "highest",
    signalThemes: ["disease_progression", "decision_making"],
    continuityHook:
      "The foundational SolenOS article — positions the product as continuity, not Q&A.",
    demandType: "continuity",
    educatesFirst: true,
  },
];

export function topicsByPriority(
  priority: ContentTopic["priority"],
): ContentTopic[] {
  return PRIORITY_CONTENT_TOPICS.filter((t) => t.priority === priority);
}

export function topicsForSignal(
  theme: ContentTopic["signalThemes"][number],
): ContentTopic[] {
  return PRIORITY_CONTENT_TOPICS.filter((t) =>
    t.signalThemes.includes(theme),
  );
}
