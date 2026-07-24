import {
  CONFLICT_CONFIDENCE_PENALTY_CAP,
  CONFLICT_LOAD_CAP,
  CONFLICT_LOAD_PER_CRITICAL,
  CONFLICT_LOAD_PER_OPEN,
  CONFLICT_SEVERITY_CONFIDENCE_REDUCTION,
} from "./contract-constants";
import { selectPrimaryClarification } from "./clarification";
import { listOpenConflicts } from "./registry";
import type {
  Conflict,
  ConflictDetectionEnvelope,
  ConflictRegistry,
} from "./types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function computeOpenConflictConfidencePenalty(
  open: readonly Conflict[],
): number {
  const sum = open.reduce(
    (acc, c) => acc + CONFLICT_SEVERITY_CONFIDENCE_REDUCTION[c.severity],
    0,
  );
  return clamp01(Math.min(CONFLICT_CONFIDENCE_PENALTY_CAP, sum));
}

/**
 * CRITICAL open medical conflicts restrict high-confidence decision generation
 * until resolved (or ignored).
 */
export function hasCriticalMedicalRestriction(
  open: readonly Conflict[],
): boolean {
  return open.some(
    (c) =>
      c.status === "open" &&
      c.severity === "CRITICAL" &&
      c.type === "medical_conflict",
  );
}

/** HIGH open conflicts should reduce decision confidence (not hard-block unless CRITICAL medical). */
export function hasHighImpactOpenConflicts(open: readonly Conflict[]): boolean {
  return open.some(
    (c) => c.status === "open" && (c.severity === "HIGH" || c.severity === "CRITICAL"),
  );
}

export function computeConflictLoadContribution(
  open: readonly Conflict[],
): number {
  let load = 0;
  for (const c of open) {
    load +=
      c.severity === "CRITICAL"
        ? CONFLICT_LOAD_PER_CRITICAL
        : c.severity === "HIGH"
          ? CONFLICT_LOAD_PER_OPEN + 5
          : c.severity === "MEDIUM"
            ? CONFLICT_LOAD_PER_OPEN
            : CONFLICT_LOAD_PER_OPEN * 0.4;
  }
  return Math.min(CONFLICT_LOAD_CAP, Math.round(load));
}

export function computeConflictDetectionEnvelope(
  registry: ConflictRegistry,
): ConflictDetectionEnvelope {
  const open = listOpenConflicts(registry);
  const criticalMedicalOpen = hasCriticalMedicalRestriction(open);
  return {
    openCount: open.length,
    highOrCriticalOpenCount: open.filter(
      (c) => c.severity === "HIGH" || c.severity === "CRITICAL",
    ).length,
    criticalMedicalOpen,
    confidencePenalty: computeOpenConflictConfidencePenalty(open),
    criticalDecisionRestricted: criticalMedicalOpen,
    conflictLoadContribution: computeConflictLoadContribution(open),
    clarification: selectPrimaryClarification(registry),
    influenceHints: open.slice(0, 5).map(
      (c) => `${c.type} (${c.severity}): ${c.statementA} ↔ ${c.statementB}`,
    ),
  };
}

/**
 * Soft-lower belief confidence for statements that appear in open conflicts.
 * Does not delete beliefs — lowers trust so Decision becomes cautious.
 */
export function applyConflictBeliefConfidenceReduction<
  T extends { content: string; confidence: number },
>(beliefs: readonly T[], open: readonly Conflict[]): T[] {
  if (open.length === 0) return [...beliefs];
  const penalty = computeOpenConflictConfidencePenalty(open);
  return beliefs.map((b) => {
    const involved = open.some(
      (c) =>
        statementsOverlap(b.content, c.statementA) ||
        statementsOverlap(b.content, c.statementB),
    );
    if (!involved) {
      // Mild global caution when high/critical open conflicts exist.
      if (hasHighImpactOpenConflicts(open)) {
        return {
          ...b,
          confidence: clamp01(b.confidence * (1 - penalty * 0.35)),
        };
      }
      return { ...b };
    }
    return {
      ...b,
      confidence: clamp01(Math.min(b.confidence, 0.45) * (1 - penalty * 0.5)),
    };
  });
}

function statementsOverlap(a: string, b: string): boolean {
  const na = a.trim().toLowerCase();
  const nb = b.trim().toLowerCase();
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na) || tokenOverlap(na, nb) >= 0.5;
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(/\W+/).filter((t) => t.length > 2));
  const tb = new Set(b.split(/\W+/).filter((t) => t.length > 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let hit = 0;
  for (const t of ta) if (tb.has(t)) hit++;
  return hit / Math.min(ta.size, tb.size);
}
