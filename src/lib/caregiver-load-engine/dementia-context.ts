/**
 * Filtered dementia knowledge — burden drivers only.
 * Used for situation framing, NOT education output.
 */

export type DependencyStage = "early" | "middle" | "late";

export type BurdenDriver = {
  id: string;
  label: string;
  loadDimensions: readonly ("cognitiveLoad" | "emotionalLoad" | "sleepLoad" | "uncertaintyLoad" | "dependencyLoad")[];
};

/** Burden-oriented knowledge — NO pathology, neuroscience, or statistics. */
export const BURDEN_DRIVERS: readonly BurdenDriver[] = [
  { id: "repetitive_questioning", label: "repetitive questioning", loadDimensions: ["cognitiveLoad", "emotionalLoad"] },
  { id: "memory_loss", label: "memory loss loops", loadDimensions: ["cognitiveLoad", "uncertaintyLoad"] },
  { id: "communication_difficulties", label: "communication breakdowns", loadDimensions: ["emotionalLoad", "cognitiveLoad"] },
  { id: "personality_changes", label: "personality and mood shifts", loadDimensions: ["emotionalLoad"] },
  { id: "behavioral_unpredictability", label: "behavioral unpredictability", loadDimensions: ["uncertaintyLoad", "emotionalLoad"] },
  { id: "increasing_dependency", label: "increasing dependency", loadDimensions: ["dependencyLoad", "cognitiveLoad"] },
  { id: "emotional_changes", label: "emotional volatility", loadDimensions: ["emotionalLoad"] },
  { id: "caregiver_burden_drivers", label: "sustained vigilance demands", loadDimensions: ["cognitiveLoad", "sleepLoad"] },
] as const;

/** Progressive dependency model — expected burden drivers per stage. */
export const STAGE_BURDEN_DRIVERS: Record<DependencyStage, readonly string[]> = {
  early: [
    "repetitive questioning",
    "memory loss loops",
    "chronic uncertainty about what's next",
  ],
  middle: [
    "increasing supervision needs",
    "communication breakdowns",
    "behavioral unpredictability",
    "sleep disruption from nighttime activity",
  ],
  late: [
    "full-time supervision",
    "assistance with daily activities",
    "emotional exhaustion from constant care",
    "inability to disengage",
  ],
} as const;

/** Patterns excluded from product logic — education/medical content. */
export const FORBIDDEN_KNOWLEDGE_PATTERNS = [
  /\b(plaque?s?|tau|amyloid|hippocamp\w*|neuroscience|neuron)\b/i,
  /\bwho (?:statistics|report|guideline)\b/i,
  /\b(end[- ]of[- ]life physiology|patholog(?:y|ical))\b/i,
] as const;

export type InferDependencyStageParams = {
  rawInput: string;
  dependencyLoadScore: number;
};

export function inferDependencyStage(params: InferDependencyStageParams): DependencyStage {
  const text = params.rawInput.trim();
  if (/\b(late stage|end stage|terminal|bedbound|non[- ]verbal|hospice)\b/i.test(text)) {
    return "late";
  }
  if (
    params.dependencyLoadScore >= 55 ||
    /\b(middle stage|moderate stage|needs help with (?:most|everything)|full[- ]time care)\b/i.test(text)
  ) {
    return "middle";
  }
  if (/\b(early stage|mild|just diagnosed|recent diagnosis|still independent)\b/i.test(text)) {
    return "early";
  }
  if (params.dependencyLoadScore >= 70) return "late";
  if (params.dependencyLoadScore >= 35) return "middle";
  return "early";
}

export function getStageBurdenFraming(stage: DependencyStage): string {
  const drivers = STAGE_BURDEN_DRIVERS[stage];
  return `At this stage, burden often comes from ${drivers.slice(0, 2).join(" and ")}.`;
}

export function containsForbiddenKnowledge(text: string): boolean {
  return FORBIDDEN_KNOWLEDGE_PATTERNS.some((p) => p.test(text));
}
