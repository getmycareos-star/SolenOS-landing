/**
 * Phase 10 — Care Transition Detection.
 * Detect major transitions as signals that change interpretation.
 * Structural classes only — pattern lists are illustrations of classes, not canned stories.
 */

export const CARE_TRANSITION_KINDS = [
  "hospital_discharge",
  "emergency_visit",
  "new_diagnosis_signal",
  "medication_change",
  "care_setting_change",
] as const;

export type CareTransitionKind = (typeof CARE_TRANSITION_KINDS)[number];

export type CareTransitionDetection = {
  kind: CareTransitionKind;
  summary: string;
  source_excerpt: string;
  phase_hint: "before" | "acute" | "after" | "unknown";
};

/**
 * Detect transition *classes* from evidence text.
 * Does not invent diagnoses or prescribe actions.
 */
export function detectCareTransitions(rawText: string): CareTransitionDetection[] {
  const text = rawText.trim();
  if (!text) return [];
  const found: CareTransitionDetection[] = [];

  const checks: Array<{ kind: CareTransitionKind; re: RegExp; phase: CareTransitionDetection["phase_hint"] }> = [
    {
      kind: "hospital_discharge",
      re: /\b(discharg(?:e|ed)|sent home from (?:the )?hospital)\b/i,
      phase: "after",
    },
    {
      kind: "emergency_visit",
      re: /\b(emergency|er visit|ed visit|ambulance|911)\b/i,
      phase: "acute",
    },
    {
      kind: "new_diagnosis_signal",
      re: /\b(new diagnos(?:is|ed)|diagnosed with)\b/i,
      phase: "after",
    },
    {
      kind: "medication_change",
      re: /\b(medication (?:change|changed|stopped|started|adjusted)|new prescription|dose (?:change|changed))\b/i,
      phase: "after",
    },
    {
      kind: "care_setting_change",
      re: /\b(moved to|nursing (?:home|facility)|rehab(?:ilitation)?|home health|assisted living)\b/i,
      phase: "after",
    },
  ];

  for (const c of checks) {
    if (!c.re.test(text)) continue;
    found.push({
      kind: c.kind,
      summary: `Care transition signal: ${c.kind.replace(/_/g, " ")}`,
      source_excerpt: text.slice(0, 160),
      phase_hint: c.phase,
    });
  }

  return found.slice(0, 3);
}
