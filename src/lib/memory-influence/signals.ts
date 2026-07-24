import type { MemoryInfluenceSignal } from "./types";

const IDENTITY_PATTERNS: Array<{
  kind: string;
  re: RegExp;
  confidence: number;
  influenceLabel: string;
  userConfirmed?: boolean;
}> = [
  {
    kind: "preference_brief_responses",
    re: /\b(prefer|like|want)\b.{0,40}\b(brief|short|concise)\b/i,
    confidence: 0.85,
    influenceLabel: "preference toward brief responses",
    userConfirmed: true,
  },
  {
    kind: "preference_step_by_step",
    re: /\b(prefer|like|want)\b.{0,40}\b(step.?by.?step|one step at a time)\b/i,
    confidence: 0.85,
    influenceLabel: "preference toward step-by-step guidance",
    userConfirmed: true,
  },
  {
    kind: "role_primary_caregiver",
    re: /\b(i am|i'm)\b.{0,30}\b(primary caregiver|main caregiver)\b/i,
    confidence: 0.9,
    influenceLabel: "stable primary caregiver role pattern",
    userConfirmed: true,
  },
];

const PATTERN_PATTERNS: Array<{
  kind: string;
  re: RegExp;
  confidence: number;
  influenceLabel: string;
}> = [
  {
    kind: "medication_missed_recurring",
    re: /\b(missed|forgot|skip(ped)?)\b.{0,30}\b(medication|dose|meds?)\b/i,
    confidence: 0.8,
    influenceLabel: "recurring medication adherence friction",
  },
  {
    kind: "appointment_scheduling_recurring",
    re: /\b(appointment|follow.?up|specialist)\b.{0,40}\b(again|keep|recurring|every)\b/i,
    confidence: 0.75,
    influenceLabel: "recurring appointment coordination pattern",
  },
  {
    kind: "insurance_admin_recurring",
    re: /\b(insurance|benefits|paperwork|claim)\b.{0,40}\b(again|deadline|form)\b/i,
    confidence: 0.72,
    influenceLabel: "recurring administrative burden pattern",
  },
];

const OPERATIONAL_PATTERNS: Array<{
  kind: string;
  re: RegExp;
  confidence: number;
  influenceLabel: string;
}> = [
  {
    kind: "ongoing_medication_task",
    re: /\b(still|ongoing|in progress|working on)\b.{0,40}\b(medication|refill|prescription)\b/i,
    confidence: 0.78,
    influenceLabel: "active medication workflow in progress",
  },
  {
    kind: "partial_form_completion",
    re: /\b(started|partially|halfway)\b.{0,30}\b(form|application|paperwork)\b/i,
    confidence: 0.76,
    influenceLabel: "partial administrative action underway",
  },
  {
    kind: "pending_follow_up",
    re: /\b(need to|have to|still need)\b.{0,40}\b(call|contact|follow up)\b/i,
    confidence: 0.74,
    influenceLabel: "pending follow-up action",
  },
];

const EMOTIONAL_PATTERNS: Array<{
  kind: string;
  re: RegExp;
  confidence: number;
  influenceLabel: string;
}> = [
  {
    kind: "stress_overwhelm",
    re: /\b(overwhelm(ed|ing)?|burn(ed)? out|exhausted|can't cope)\b/i,
    confidence: 0.82,
    influenceLabel: "elevated stress sensitivity trend",
  },
  {
    kind: "grief_sensitivity",
    re: /\b(grief|grieving|miss (him|her|them)|passed away|died)\b/i,
    confidence: 0.8,
    influenceLabel: "grief sensitivity trend",
  },
  {
    kind: "guilt_pattern",
    re: /\b(feel guilty|not doing enough|failing (him|her|them|mom|dad))\b/i,
    confidence: 0.78,
    influenceLabel: "guilt sensitivity pattern",
  },
];

function matchPatterns(
  input: string,
  category: MemoryInfluenceSignal["category"],
  patterns: Array<{
    kind: string;
    re: RegExp;
    confidence: number;
    influenceLabel: string;
    userConfirmed?: boolean;
  }>,
): MemoryInfluenceSignal[] {
  const signals: MemoryInfluenceSignal[] = [];
  for (const pattern of patterns) {
    if (pattern.re.test(input)) {
      signals.push({
        category,
        kind: pattern.kind,
        confidence: pattern.confidence,
        detail: pattern.kind,
        influenceLabel: pattern.influenceLabel,
        userConfirmed: pattern.userConfirmed ?? false,
      });
    }
  }
  return signals;
}

/**
 * Detect memory influence signals from input — observational only, not truth storage.
 */
export function detectMemoryInfluenceSignals(input: string): MemoryInfluenceSignal[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  return [
    ...matchPatterns(trimmed, "identity", IDENTITY_PATTERNS),
    ...matchPatterns(trimmed, "patterns", PATTERN_PATTERNS),
    ...matchPatterns(trimmed, "operational", OPERATIONAL_PATTERNS),
    ...matchPatterns(trimmed, "emotional", EMOTIONAL_PATTERNS),
  ];
}

export function signalOccurrenceKey(signal: MemoryInfluenceSignal): string {
  return `${signal.category}:${signal.kind}`;
}
