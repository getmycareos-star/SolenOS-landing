/**
 * Unified epistemic decision signal — sole detector for:
 * - Situation Relationship Engine Signal 6 (ADD_RELATED_EVENT for care decisions)
 * - Decision Memory `recordDecisionFromText`
 * - Composer why-path surfacing (`looksLikeDecisionEvidence`)
 *
 * Intentional split: SRE may return ADD_RELATED_EVENT for improvement outcomes (G2)
 * without this signal firing — those link related evidence, not Decision Memory rows.
 */

export function looksLikeDecisionEvidence(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return /\b(decid(?:ed|e|ing)(?:\s+to)?|decided to|chose(?:\s+to)?|agreed|we (?:chose|agreed|decided)|family (?:decided|agreed)|plan is|plan(?:ning)?\s+to|prescribed|doctor (?:put|started|gave|changed|stopped|switched)|began taking|started|medication|medicine|pill|dose|will (?:start|stop|change|continue)|moved (?:to|into)|went to (?:rehab|rehabilitation)|discontinued|stopped (?:taking|the)|instead of)\b/i.test(
    t,
  );
}
