/**
 * Deterministic impact-driven prioritization from CareSituationUnderstanding.
 *
 * Rules:
 * - Safety (falls, medical events) > Functional impact (mobility, confusion) >
 *   Uncertainty requiring attention (medication timing) > Admin/fragmentation
 * - When prior continuity hooks exist, prefer reconnecting to prior threads
 * - Never word-count, emotion volume, keyword frequency, or message length
 * - Never infer diagnosis, causation, or generate caregiver prose
 * - Input-agnostic: works for text, document OCR, screenshots, mixed content
 */
import type { CareSituationUnderstanding, CareSituationFact } from "./types";

/**
 * Impact weight for a care fact — based on care reality impact, not wording.
 * Higher number = higher priority.
 */
function impactWeight(fact: CareSituationFact): number {
  const t = fact.text;

  // Safety-critical signals
  if (
    /\b(?:fell|fall|fallen|collapse|fainted|passed out|unconscious|seizure|overdose|injury|broken|fracture|bleed|head injur)\b/i.test(t)
  ) {
    return 6;
  }
  // Medical events / urgent care
  if (
    /\b(?:hospital|emergency|er\b|urgent care|discharge|admitted|surgery|procedure|medication chang|dosage chang|new med|prescription chang)\b/i.test(t)
  ) {
    return 5;
  }
  // Functional/mobility changes
  if (
    /\b(?:walking|mobility|balance|stumble|trouble walking|cannot walk|can'?t walk|wheelchair|transfer|bedridden|eating|appetite|swallow)\b/i.test(t)
  ) {
    return 4;
  }
  // Cognitive / behavioral changes
  if (
    /\b(?:confus|disorient|wander|agitat|aggress|hallucinat|delirium|memory|forget|repeating|sundown)\b/i.test(t)
  ) {
    return 3;
  }
  // Changes from baseline (general)
  if (
    /\b(?:worse|changed|decline|different from usual|not normal|unusual|more (?:often|frequent|difficult))\b/i.test(t)
  ) {
    return 2;
  }
  // Uncertainty requiring attention (medication timing, missing info)
  if (
    /\b(?:not sure|don'?t know|unclear|uncertain|whether|if this started|timing|when it started)\b/i.test(t)
  ) {
    return 1;
  }
  // Admin / fragmentation / load
  return 0;
}

/** True when text is admin / fragmentation / load — not a care fact about recipient. */
function isAdminOrLoad(text: string): boolean {
  // Document gathering, family retelling, admin clutter
  if (
    /\b(?:medication list|hospital paper|papers? from|messages? from|somewhere|explain everything|mixed together)\b/i.test(text)
  ) {
    return true;
  }
  // Family retelling / explanation burden
  if (
    /\b(?:brother|sister|family)\b/i.test(text) &&
    /\b(?:asked|explain|tell|noticed|doesn'?t understand|don'?t understand)\b/i.test(text)
  ) {
    return true;
  }
  // Caregiver load / exhaustion / emotional only
  if (
    /\b(?:i feel|i'?m (?:just )?(?:trying|drowning|exhausted|overwhelmed|burned out)|i don'?t know how much longer|everything is on me)\b/i.test(text)
  ) {
    return true;
  }
  return false;
}

/**
 * Compute deterministic prioritization from CareSituationUnderstanding.
 *
 * When prior continuity hooks exist, prefer reconnecting to prior threads.
 * When prior unknowns exist, merge them into current unknowns for follow-up.
 *
 * @param understanding The current turn's understanding
 * @param priorContinuityHooks Continuity hooks from prior turns to carry forward
 * @param priorUnknowns Unknowns from prior turns to carry forward
 * @returns what_matters_now, what_can_wait, follow_up_questions, continuity_hooks
 */
export function prioritizeFromUnderstanding(
  understanding: CareSituationUnderstanding,
  priorContinuityHooks?: string[],
  priorUnknowns?: string[],
): Pick<
  CareSituationUnderstanding,
  "matters_now" | "can_wait" | "follow_up_questions" | "continuity_hooks"
> {
  // Merge prior unknowns into current unknowns (preserving both)
  const mergedUnknowns = [...new Set([
    ...understanding.unknowns,
    ...(priorUnknowns ?? []),
  ])];

  // Merge prior hooks into continuity attention anchors (deduped)
  const mergedHooks = [...new Set([
    ...understanding.continuity_hooks,
    ...(priorContinuityHooks ?? []),
  ])];

  // Sort facts by impact weight (highest first)
  const sortedByImpact = [...understanding.facts].sort(
    (a, b) => impactWeight(b) - impactWeight(a),
  );

  const matters: string[] = [];
  const wait: string[] = [];

  for (const f of sortedByImpact) {
    if (isAdminOrLoad(f.text)) {
      wait.push(f.text);
      continue;
    }
    if (impactWeight(f) >= 1) {
      matters.push(f.text);
    } else {
      wait.push(f.text);
    }
  }

  // Add changes from baseline to matters (high priority)
  for (const c of understanding.changes_from_baseline) {
    if (
      !matters.some((m) =>
        m.toLowerCase().includes(c.toLowerCase().slice(0, 32)),
      )
    ) {
      matters.push(c);
    }
  }

  // Add possible links as orientation (not causation)
  for (const link of understanding.possible_links) {
    if (
      !matters.includes(link.text) &&
      !wait.includes(link.text)
    ) {
      matters.push(link.text);
    }
  }

  // Add prior continuity hooks to matters if unresolved (second-turn reconnection)
  for (const hook of mergedHooks) {
    if (
      !matters.some((m) =>
        m.toLowerCase().includes(hook.toLowerCase().slice(0, 40)),
      ) &&
      !wait.some((w) =>
        w.toLowerCase().includes(hook.toLowerCase().slice(0, 40)),
      )
    ) {
      matters.push(hook);
    }
  }

  // Add context_only to can_wait
  for (const ctx of understanding.context_only) {
    if (!wait.includes(ctx)) {
      wait.push(ctx);
    }
  }

  // Deduplicate preserving order
  const dedupe = (xs: string[]) => {
    const seen = new Set<string>();
    return xs.filter((x) => {
      const k = x.toLowerCase().slice(0, 80);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };

  const matters_now = dedupe(matters).slice(0, 4);
  const can_wait = dedupe(wait).slice(0, 4);

  // Questions from merged unknowns — max 1-3
  const follow_up_questions = dedupe(mergedUnknowns)
    .filter((q) => q.trim().length >= 12)
    .slice(0, 3)
    .map((q) =>
      /\?$/.test(q.trim()) ? q.trim() : `${q.trim().replace(/\.$/, "")}?`,
    );

  // Continuity hooks from unresolved threads (include prior hooks that remain relevant)
  const continuity_hooks = dedupe([
    ...matters_now.slice(0, 3),
    ...understanding.possible_links.map((l) => l.text).slice(0, 1),
    ...follow_up_questions.slice(0, 2),
    ...mergedHooks.slice(0, 3),
  ]).slice(0, 6);

  return { matters_now, can_wait, follow_up_questions, continuity_hooks };
}
