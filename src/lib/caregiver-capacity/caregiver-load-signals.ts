/**
 * Caregiver capacity signals — how hard the caregiver is carrying care right now.
 *
 * Purpose (Evidence Visibility + Cognitive Relief):
 * - Load is a first-class fact about the care situation, not a mood adjective.
 * - It is kept structurally separate from care-recipient changes: strain in the
 *   caregiver is never reported as a change in the person receiving care.
 * - Used to decide relief (fewer asks, no new tasks), never to lecture or
 *   to score the caregiver.
 *
 * Client-safe: no fs, no durable stores, no clinical inference.
 */

import type { CaregiverLoadSignal } from "../semantic-extraction/types";

/** Structural patterns for caregiver strain. Evidence, not sentiment analysis. */
export const CAREGIVER_LOAD_SIGNAL_RULES: {
  kind: CaregiverLoadSignal["kind"];
  pattern: RegExp;
}[] = [
  {
    kind: "exhaustion",
    pattern:
      /\b(?:exhausted|exhausting|no (?:sleep|rest)|barely slept|haven'?t slept|not slept|didn'?t sleep|tired all the time|completely drained|running on empty|can'?t keep up|cannot keep up|knackered|wide awake all night)\b/i,
  },
  {
    kind: "overwhelmed",
    pattern:
      /\b(?:overwhelmed|too much|at my limit|falling apart|drowning|can'?t do this|cannot do this|not coping|no idea how|don'?t know what to do|don'?t know where to start|losing it|at the end of my)\b/i,
  },
  {
    kind: "time_pressure",
    pattern:
      /\b(?:no time|rushed|racing|had to rush|late for|on my way|quick(?:ly)? (?:update|note|one)|back and forth all day|all day today|between (?:work|school|shifts))\b/i,
  },
  {
    kind: "isolation",
    pattern:
      /\b(?:on my own|by myself|doing this alone|no help|nobody (?:helps|to help)|no one (?:helps|to help)|no family (?:support|help)|alone with (?:this|him|her|them|it))\b/i,
  },
  {
    kind: "guilt",
    pattern:
      /\b(?:feel(?:ing)? (?:so )?guilty|so guilty|guilt|blaming myself|should have (?:done|been|checked)|let (?:him|her|them) down|failing (?:him|her|them|at this)|not good enough)\b/i,
  },
  {
    kind: "grief",
    pattern:
      /\b(?:grieving|can'?t stop crying|so sad|heartbroken|missing (?:him|her|them) so much|devastated|don'?t want to lose)\b/i,
  },
  {
    kind: "uncertainty",
    pattern:
      /\b(?:don'?t know what to do|no idea (?:what|why|how)|confused about|baffled|lost track|don'?t understand what'?s happening|not sure (?:what|if|whether)|confused about what)\b/i,
  },
  {
    kind: "competing_demands",
    pattern:
      /\b(?:also (?:have|has|had) to|on top of that|and i still have|my other (?:kids?|children|work|job)|two jobs|work and (?:care|family)|still have to (?:cook|clean|pick up|get to work|work))\b/i,
  },
  {
    kind: "financial_strain",
    pattern: /\b(?:can'?t afford|out of pocket|bills are|money is (?:tight|hard)|so expensive|homecare costs?)\b/i,
  },
  {
    kind: "hope",
    pattern: /\b(?:hoping|hopes|feeling a bit better about|some good news|makes me hopeful|he seems more like)\b/i,
  },
];

/**
 * Care-recipient / clinical content — its presence means the note is not load-only.
 * Judged by what is described, not by pronouns: a caregiver under strain writes about
 * a third party constantly ("my sister said she'll help"), and a bare "she" is load
 * language, not a care fact.
 */
const CARE_CONTENT_MARKERS =
  /\b(?:mom|mum|dad|mother|father|wife|husband|partner|carer|carers)\b|\b(?:fell|fallen|falling|slipped|tripped|pain|aching|hurting|unwell)\b|\b(?:eat(?:ing|ate)?|appetite|off (?:her|his|their) food|swallow\w*|chok\w*|cough\w*)\b|\b(?:medications?|medicines?|pills?|tablets?|doses?|dosage|prescriptions?|prescribed|pharmacy|script|meds)\b|\b(?:doctor|clinic|hospital|nurse|gp|surgery|appointment|district nurse|paramedic|ambulance)\b|\b(?:walk(?:ing|ed|s)?|toilet\w*|toileting|bathroom|bedside|\bchair\b|hoist|frame|walker|stair\w*)\b|\b(?:sleep(?:ing|s)?|awake|up at night|overnight|nights? up|night wakes?)\b|\b(?:confus\w*|forget(?:ful|ting)|wandering|hallucinat\w*|disorient\w*|doesn't recognise|doesn't know me|not herself|not himself)\b|\b(?:breath\w*|swelling\w*|urine|wee|constipat\w*|wounds?|sores?|agitat\w*|refused|unable to|can't get|difficult to (?:eat|drink|walk|breathe)|pressure sore)\b|\b(?:better|worse|improving|deteriorat\w*|more confused|so much more)\b/i;

function cleanSpan(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[\s,;:.\-–—]+/, "")
    .replace(/[\s,;:\-–—]+$/, "")
    .trim();
}

function sentenceUnits(text: string): string[] {
  return text
    .replace(/\r\n/g, "\n")
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => cleanSpan(s))
    .filter((s) => s.length >= 6);
}

function intensityFor(text: string): CaregiverLoadSignal["intensity"] {
  if (
    /\b(?:exhausted|overwhelmed|can'?t take (?:it|this) anymore|falling apart|drowning|no help|doing this alone|at the end of my)\b/i.test(
      text,
    )
  ) {
    return "high";
  }
  if (/\b(?:struggling|so tired|not sleeping|crying|scared|worried sick|no idea|don'?t know what to do|guilty|behind)\b/i.test(text)) {
    return "medium";
  }
  return "low";
}

export type CaregiverLoadProfile = {
  signals: CaregiverLoadSignal[];
  /** Highest-intensity kind, or null when no load language is present. */
  dominant: CaregiverLoadSignal["kind"] | null;
  intensity: CaregiverLoadSignal["intensity"] | null;
  /** True when load language appears together with care-recipient content. */
  has_care_content: boolean;
  /** True when the note is caregiver load with no care content. */
  load_only: boolean;
};

/** Extract every distinct load signal with its verbatim evidence. */
export function caregiverLoadSignals(text: string): CaregiverLoadSignal[] {
  const out: CaregiverLoadSignal[] = [];
  const seen = new Set<string>();
  for (const unit of sentenceUnits(text)) {
    for (const { kind, pattern } of CAREGIVER_LOAD_SIGNAL_RULES) {
      if (seen.has(kind)) continue;
      const match = pattern.exec(unit);
      if (!match) continue;
      seen.add(kind);
      out.push({ kind, evidence: cleanSpan(unit).slice(0, 200), intensity: intensityFor(unit) });
    }
  }
  return out;
}

const INTENSITY_ORDER: Record<CaregiverLoadSignal["intensity"], number> = { low: 1, medium: 2, high: 3 };

export function caregiverLoadProfile(text: string): CaregiverLoadProfile {
  const signals = caregiverLoadSignals(text);
  const has_care_content = CARE_CONTENT_MARKERS.test(text);
  let dominant: CaregiverLoadSignal["kind"] | null = null;
  let intensity: CaregiverLoadSignal["intensity"] | null = null;
  for (const signal of signals) {
    if (!intensity || INTENSITY_ORDER[signal.intensity] > INTENSITY_ORDER[intensity]) {
      intensity = signal.intensity;
      dominant = signal.kind;
    }
  }
  return {
    signals,
    dominant,
    intensity,
    has_care_content,
    load_only: signals.length > 0 && !has_care_content,
  };
}

/** True when the caregiver is speaking about their own load, not about care. */
export function isCaregiverOnlyLoad(text: string): boolean {
  return caregiverLoadProfile(text).load_only;
}

/**
 * Capacity-aware asks: a caregiver under high strain is never handed more
 * tasks by the same turn that recognised their strain.
 */
export function capacityAskCap(base: number, profile: CaregiverLoadProfile): number {
  if (profile.intensity === "high" || profile.signals.length >= 3) return Math.min(base, 1);
  if (profile.intensity === "medium" || profile.signals.length === 2) return Math.min(base, 2);
  return base;
}

/** True when this turn must not introduce anything new to act on tonight. */
export function shouldDeferNewWork(profile: CaregiverLoadProfile): boolean {
  return profile.intensity === "high" || profile.signals.length >= 3;
}

const LOAD_LINES: Partial<Record<CaregiverLoadSignal["kind"], string>> = {
  exhaustion:
    "Caring for someone is tiring. This is held with the rest — nothing else needs doing tonight.",
  overwhelmed:
    "A lot is being carried here. The record holds it so you don't have to hold it all at once.",
  time_pressure: "Everything you shared is captured — you do not need to fill in anything else now.",
  isolation:
    "You are holding this on your own. It is recorded, so the next person who helps has the picture.",
  guilt: "What happened is not a verdict on you. Both what happened and what you did are held separately.",
  grief: "This is held gently in the record. You do not have to explain more than you want to.",
  uncertainty:
    "Not knowing is a real answer here. The record keeps the open parts open rather than guessing.",
  competing_demands:
    "Other responsibilities are noted alongside the care. The care part is recorded in full.",
  financial_strain: "The practical side is recorded too, so it is not something you have to re-explain.",
  hope: "What is going well is recorded as carefully as what is difficult.",
};

/**
 * Caregiver-facing load line — brief, non-judgmental, never a score.
 * Null when there is no load signal to acknowledge.
 */
export function caregiverCapacityLine(
  profile: CaregiverLoadProfile,
  openGapCount: number,
): string | null {
  if (profile.signals.length === 0) {
    if (openGapCount >= 3) {
      return "Several things need attention at once — nothing has to be solved tonight.";
    }
    if (openGapCount === 2) {
      return "A few pieces are still missing — the most important one is enough for now.";
    }
    if (openGapCount === 1) {
      return "One question is still open — it can wait until you have the answer.";
    }
    return null;
  }

  const primary = LOAD_LINES[profile.dominant ?? "overwhelmed"] ?? LOAD_LINES.overwhelmed!;
  if (profile.signals.length === 1) return primary;
  return `${primary} ${profile.signals.length - 1 > 1 ? `${profile.signals.length - 1} other pressures` : "One other pressure"} from this same message is recorded too.`;
}
