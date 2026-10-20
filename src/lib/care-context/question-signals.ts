import type { SignalTheme } from "./types";

export interface SignalDefinition {
  theme: SignalTheme;
  underlyingNeed: string;
  keywords: RegExp[];
}

/** Caregiver question themes → underlying problems (market signals, not feature requests). */
export const SIGNAL_DEFINITIONS: SignalDefinition[] = [
  {
    theme: "financial_uncertainty",
    underlyingNeed:
      "I am making difficult care decisions under financial uncertainty.",
    keywords: [
      /\b(medicare|medicaid|insurance|cost|pay(?:ing)?|afford|financial|money|budget)\b/i,
    ],
  },
  {
    theme: "care_coordination",
    underlyingNeed: "I cannot coordinate care effectively.",
    keywords: [
      /\b(hir(?:e|ing)|caregiver|live-?in|respite|coordinate|schedul(?:e|ing)|agency)\b/i,
    ],
  },
  {
    theme: "disease_progression",
    underlyingNeed: "I don't understand how reality is changing.",
    keywords: [
      /\b(24\s*\/\s*7|round the clock|warning sign|progress(?:ion|ing)|stage|supervision|wander(?:ing)?|memory loss|declin(?:e|ing))\b/i,
    ],
  },
  {
    theme: "emotional_burden",
    underlyingNeed: "I am carrying too much cognitive load.",
    keywords: [
      /\b(exhaust(?:ed|ion)|burn(?:out|ed)|guilt|overwhelm(?:ed)?|can't cope|work.?life|stressed)\b/i,
    ],
  },
  {
    theme: "decision_making",
    underlyingNeed: "I need confidence in my next decision.",
    keywords: [
      /\b(should i|when to|how do i know|time for|decide|memory care|stay(?:ing)? at home|professional care|nursing home|assisted living)\b/i,
    ],
  },
];

/** Phrases indicating continuity demand — the core SolenOS problem. */
export const CONTINUITY_DEMAND_PATTERNS: RegExp[] = [
  /\b(can't remember|cannot remember|don't remember|forgot what)\b/i,
  /\b(everything is (?:getting )?mixed up|all mixed up|losing track)\b/i,
  /\b(things keep changing|keeps changing|what changed|something changed)\b/i,
  /\b(last appointment|what happened at|reconstruct|piece together)\b/i,
  /\b(started (?:to |recently )|new behavior|getting worse|used to)\b/i,
];

/** Phrases indicating search demand — information-seeking, lower product fit. */
export const SEARCH_DEMAND_PATTERNS: RegExp[] = [
  /\b(does .+ cover|what is|how much does|is it covered|definition of)\b/i,
  /\b(what are the symptoms of|signs of|list of)\b/i,
];

export function detectSignalThemes(text: string): SignalTheme[] {
  const themes: SignalTheme[] = [];
  for (const def of SIGNAL_DEFINITIONS) {
    if (def.keywords.some((re) => re.test(text))) {
      themes.push(def.theme);
    }
  }
  return themes;
}

export function classifyDemandType(text: string): "continuity" | "search" | "mixed" {
  const hasContinuity = CONTINUITY_DEMAND_PATTERNS.some((re) => re.test(text));
  const hasSearch = SEARCH_DEMAND_PATTERNS.some((re) => re.test(text));

  if (hasContinuity && hasSearch) return "mixed";
  if (hasContinuity) return "continuity";
  if (hasSearch) return "search";
  // Questions about change/progression default to continuity when decision-oriented
  if (/\b(how do i know|when should|is it time)\b/i.test(text)) return "continuity";
  return "search";
}

export function underlyingNeedForTheme(theme: SignalTheme): string {
  return (
    SIGNAL_DEFINITIONS.find((d) => d.theme === theme)?.underlyingNeed ?? ""
  );
}
