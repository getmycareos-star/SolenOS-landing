import type { Issue, PrioritySignal } from "./types";

/**
 * STEP 2 — Human impact override (signal, not UI bucket).
 * If ANY issue involves pain / health deterioration / immediate safety / active harm
 * → prioritySignal = "HIGH_IMPACT" (sorts first; not a public field).
 */

const HIGH_IMPACT_PATTERNS: readonly RegExp[] = [
  // Immediate safety / active harm
  /\b(sparks?|sparking|exposed wir(?:e|ing)|electrical hazard|shock(?:ed|ing)?|fire risk|smoke|gas leak)\b/i,
  /\b(fell|falling|fall risk|wander(?:ing|ed)|missing|elopement|can't wake|not breathing|choking|bleeding)\b/i,
  /\b(emergency|911|ambulance|immediate (?:danger|harm|threat)|unsafe|hazard)\b/i,
  /\b(abuse|assault|self[- ]harm|suicid|active harm)\b/i,
  // Pain / health deterioration
  /\b(tooth(?:ache)?|dental pain|severe pain|terrible pain|pain for days|in (?:a lot of )?pain)\b/i,
  /\b(worsening|deteriorat(?:e|ing|ion)|getting worse|sudden(?:ly)? (?:worse|decline)|chest pain|can't breathe)\b/i,
  /\b(infection|fever|seizure|stroke|heart attack|unconscious)\b/i,
];

export function detectHumanImpact(issue: Issue): PrioritySignal {
  // Prefer title — shared document context must not mark laundry as HIGH_IMPACT.
  const hay = issue.title;
  for (const re of HIGH_IMPACT_PATTERNS) {
    if (re.test(hay)) return "HIGH_IMPACT";
  }
  return "NONE";
}

/** True if any issue carries HIGH_IMPACT. */
export function anyHighImpact(issues: readonly Issue[]): boolean {
  return issues.some((i) => detectHumanImpact(i) === "HIGH_IMPACT");
}
