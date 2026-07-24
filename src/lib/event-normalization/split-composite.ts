import { SPLIT_VERB_PATTERNS } from "./contract-constants";
import type { AtomicEventType } from "./types";

export function splitCompositeInput(text: string): { clause: string; atomic_type: AtomicEventType }[] {
  const segments = text
    .split(/\s*,\s*|\s+and\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);

  if (segments.length <= 1) {
    const single = classifyClause(text);
    return single ? [{ clause: text.trim(), atomic_type: single }] : [];
  }

  const results: { clause: string; atomic_type: AtomicEventType }[] = [];
  for (const seg of segments) {
    const type = classifyClause(seg);
    if (type) results.push({ clause: seg, atomic_type: type });
  }

  if (results.length === 0) {
    const fallback = classifyClause(text);
    if (fallback) return [{ clause: text.trim(), atomic_type: fallback }];
  }

  return results;
}

function classifyClause(clause: string): AtomicEventType | null {
  for (const { pattern, type } of SPLIT_VERB_PATTERNS) {
    if (pattern.test(clause)) return type;
  }
  if (clause.split(/\s+/).length >= 4) return "symptom_observed";
  return null;
}

export function hasMultipleActions(text: string): boolean {
  const verbs = SPLIT_VERB_PATTERNS.filter((p) => p.pattern.test(text));
  return verbs.length >= 2 || text.split(/\s*,\s*|\s+and\s+/i).length >= 2;
}
