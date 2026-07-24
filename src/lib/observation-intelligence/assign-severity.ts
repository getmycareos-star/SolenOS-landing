import type { ObservationSeverity } from "./ontology";

export type SeverityContext = {
  /** Numeric frequency extracted from caregiver text (e.g. "seven times" → 7). */
  frequency?: number;
  /** Safety-risk language detected in raw text. */
  safetyRisk?: boolean;
  /** Night-time or unsupervised context (e.g. 2am wandering). */
  unsupervisedContext?: boolean;
  /** Explicit intensity words in caregiver language. */
  intensityWords?: string[];
};

const HIGH_INTENSITY = [
  "dangerous",
  "unsafe",
  "emergency",
  "urgent",
  "scared",
  "terrified",
  "violent",
  "aggressive",
  "fell",
  "injured",
  "missing",
  "left the house",
  "outside alone",
];

const MEDIUM_INTENSITY = [
  "worried",
  "concerned",
  "upset",
  "frustrated",
  "confused",
  "repeated",
  "again",
  "multiple",
  "several",
];

/**
 * Assigns observation severity from caregiver language context — not clinical staging.
 */
export function assignSeverity(ctx: SeverityContext): ObservationSeverity {
  if (ctx.safetyRisk || ctx.unsupervisedContext) return "high";
  if (ctx.frequency !== undefined && ctx.frequency >= 5) return "high";
  if (ctx.frequency !== undefined && ctx.frequency >= 3) return "medium";

  const intensity = ctx.intensityWords ?? [];
  if (intensity.some((w) => HIGH_INTENSITY.includes(w))) return "high";
  if (intensity.some((w) => MEDIUM_INTENSITY.includes(w))) return "medium";
  if (ctx.frequency !== undefined && ctx.frequency >= 2) return "medium";

  return "low";
}

/** Extract numeric frequency from caregiver phrasing. */
export function extractFrequency(text: string): number | undefined {
  const lower = text.toLowerCase();

  const wordMap: Record<string, number> = {
    once: 1,
    twice: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
  };

  const timesMatch = lower.match(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+times?/);
  if (timesMatch) {
    const raw = timesMatch[1]!;
    const n = wordMap[raw] ?? parseInt(raw, 10);
    if (!Number.isNaN(n)) return n;
  }

  if (/\bagain and again\b|\bover and over\b|\bconstantly\b|\brepeatedly\b/.test(lower)) {
    return 4;
  }
  if (/\bagain\b|\brepeated\b|\bmultiple\b|\bseveral\b/.test(lower)) {
    return 2;
  }

  return undefined;
}

export function detectSafetyRisk(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /\b(2\s*am|3\s*am|midnight|late at night|unsupervised|left alone|outside alone|wandered outside|got out)\b/.test(
      lower,
    ) ||
    /\b(dangerous|unsafe|fell|injured|missing|emergency)\b/.test(lower)
  );
}

export function detectUnsupervisedContext(text: string): boolean {
  const lower = text.toLowerCase();
  return /\b(2\s*am|3\s*am|midnight|late at night|unsupervised|alone at night|wandered outside)\b/.test(
    lower,
  );
}

export function detectIntensityWords(text: string): string[] {
  const lower = text.toLowerCase();
  return [...HIGH_INTENSITY, ...MEDIUM_INTENSITY].filter((w) => lower.includes(w));
}
