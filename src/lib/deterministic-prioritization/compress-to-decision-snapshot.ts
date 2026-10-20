import {
  FORBIDDEN_PUBLIC_BUCKET_STRINGS,
  MAX_MATTERS_NOW_ACTIONS,
} from "./contract-constants";
import type { DecisionSnapshot, RankedIssue, RiskLevel } from "./types";

/**
 * STEP 5 — Compress into fixed 6-field schema.
 *
 * OPS/ENGINE INTERNAL ONLY. This compressor produces the same 6-field shape as the
 * caregiver-facing Response Contract, but it is NOT understanding — it is keyword-score
 * compression. It must NEVER feed the caregiver response pipeline.
 *
 * Caregiver response is sourced from:
 *   CareSituationUnderstanding → prioritizeFromUnderstanding → projectCareSituationToResponseContract.
 *
 * This compressor exists only for /api/analyze (ops/engine path) where internal
 * DecisionSnapshot reasoning is needed for telemetry, case memory, and human trust layers.
 *
 * Trust via transparency: weave why-direction into text fields — no extra JSON keys.
 * Never emit DO_FIRST / SAFE_TO_DELAY / WATCH_CLOSELY (or spaced variants).
 * Never claim medical/finance/legal authority — user is final decision maker.
 */

function assertNoBucketLeakage(text: string, field: string): void {
  const upper = text.toUpperCase();
  for (const forbidden of FORBIDDEN_PUBLIC_BUCKET_STRINGS) {
    if (upper.includes(forbidden.toUpperCase())) {
      throw new Error(
        `Public compress leaked internal bucket token "${forbidden}" into ${field}`,
      );
    }
  }
}

function shortTitle(title: string, max = 72): string {
  const t = title.trim();
  return t.length > max ? `${t.slice(0, max - 1).trim()}…` : t;
}

function inferRisk(ranked: readonly RankedIssue[]): RiskLevel {
  if (ranked.some((i) => i.prioritySignal === "HIGH_IMPACT")) return "high";
  const maxScore = ranked.reduce((m, i) => Math.max(m, i.priorityScore), 0);
  if (maxScore >= 18) return "high";
  if (maxScore >= 10) return "medium";
  return "low";
}

function buildHappening(ranked: readonly RankedIssue[]): string {
  const top = ranked.slice(0, 3);
  if (top.length === 0) {
    return "Several care and household concerns are present; priorities are still forming from the available description.";
  }
  const high = ranked.filter((i) => i.prioritySignal === "HIGH_IMPACT");
  const practical = ranked.filter((i) => i.prioritySignal !== "HIGH_IMPACT").slice(0, 2);
  const emotional =
    high.length > 0
      ? "Safety and health-related signals are competing with everyday load, which raises stress."
      : "Everyday obligations are stacking without a clear single urgent spike.";

  const focus = top.map((i) => shortTitle(i.title, 48)).join("; ");
  return `Right now the situation centers on: ${focus}. ${emotional}${
    practical.length
      ? ` Lower-weight items (for example ${shortTitle(practical[practical.length - 1]!.title, 40)}) remain in view but should not dominate attention.`
      : ""
  }`.trim();
}

function buildMattersNow(ranked: readonly RankedIssue[]): string {
  const high = ranked.filter((i) => i.prioritySignal === "HIGH_IMPACT");
  const byScore = [...ranked].sort((a, b) => b.priorityScore - a.priorityScore);
  const selected: RankedIssue[] = [];
  for (const i of high) {
    if (selected.length >= MAX_MATTERS_NOW_ACTIONS) break;
    selected.push(i);
  }
  for (const i of byScore) {
    if (selected.length >= MAX_MATTERS_NOW_ACTIONS) break;
    if (selected.some((s) => s.id === i.id)) continue;
    selected.push(i);
  }

  if (selected.length === 0) {
    return "Confirm the single most time-sensitive concern first — SolenOS highlights risk signals only; you decide next steps.";
  }

  const actions = selected.map((i, idx) => {
    const why =
      i.prioritySignal === "HIGH_IMPACT"
        ? "human-impact safety/pain signal"
        : `score ${i.priorityScore} (safety/time weighted)`;
    return `${idx + 1}) Address ${shortTitle(i.title, 56)} — ${why}`;
  });

  return `${actions.join(". ")}. You remain the final decision maker; SolenOS only ranks what appears to matter from the input.`;
}

function buildAskNext(ranked: readonly RankedIssue[]): string {
  const high = ranked.find((i) => i.prioritySignal === "HIGH_IMPACT");
  if (high && /electr|sparks?|wir/i.test(high.title)) {
    return "Is the electrical hazard still live or exposed right now (power on, sparks continuing)?";
  }
  if (high && /pain|tooth|dental|health|deterior/i.test(high.title)) {
    return "Has the pain or health change worsened in the last 24 hours, or is anyone in immediate danger?";
  }
  if (high) {
    return "Is anyone injured, unsafe, or in immediate need of help right now?";
  }
  const uncertain = ranked.filter((i) => i.uncertain);
  if (uncertain.length > 0) {
    return "Which concern has a hard deadline or could become unsafe if postponed this week?";
  }
  return "What feels most time-sensitive to you today — safety, health, or household logistics?";
}

function buildCanWait(ranked: readonly RankedIssue[]): string {
  const delayed = ranked.filter(
    (i) =>
      i.internalBucket === "SAFE_TO_DELAY" ||
      (i.prioritySignal !== "HIGH_IMPACT" && i.priorityScore <= 8),
  );
  const watch = ranked.filter((i) => i.internalBucket === "WATCH_CLOSELY");
  const candidates = [...delayed, ...watch].filter(
    (i) => i.prioritySignal !== "HIGH_IMPACT",
  );
  // Unique by id, prefer lowest scores
  const seen = new Set<string>();
  const unique: RankedIssue[] = [];
  for (const i of [...candidates].sort((a, b) => a.priorityScore - b.priorityScore)) {
    if (seen.has(i.id)) continue;
    seen.add(i.id);
    unique.push(i);
  }

  if (unique.length === 0) {
    return "Non-urgent household or cosmetic items can safely be postponed until higher-impact concerns are clearer.";
  }

  const sample = unique
    .slice(0, 2)
    .map((i) => shortTitle(i.title, 40))
    .join(" and ");
  return `${sample} can safely be postponed — lower weighted scores and no human-impact safety signal. Why: delaying them does not appear to increase immediate harm based on the input.`;
}

function buildFollowUps(ranked: readonly RankedIssue[]): string[] {
  const items: string[] = [];
  if (ranked.some((i) => i.uncertain)) {
    items.push("Clarify ambiguous items so scoring dimensions can be tightened");
  }
  if (ranked.some((i) => /electr|sparks?|wir/i.test(i.title))) {
    items.push("Confirm whether power is still on at the hazardous outlet/wiring");
  }
  if (ranked.some((i) => /tooth|dental|pain/i.test(i.title))) {
    items.push("Note how long the pain has lasted and whether eating/sleep is affected");
  }
  if (ranked.every((i) => i.prioritySignal !== "HIGH_IMPACT") && ranked.length > 1) {
    items.push("Identify any deadline or cost constraint missing from the description");
  }
  if (items.length === 0) {
    items.push("Any missing deadline or safety detail that would change ranking");
  }
  // Ambiguities / missing data — NOT tasks/reminders
  return items.slice(0, 4);
}

export function compressToDecisionSnapshot(
  ranked: readonly RankedIssue[],
): DecisionSnapshot {
  const snapshot: DecisionSnapshot = {
    what_is_happening: buildHappening(ranked),
    what_matters_now: buildMattersNow(ranked),
    what_to_ask_next: buildAskNext(ranked),
    risk_level: inferRisk(ranked),
    what_can_wait: buildCanWait(ranked),
    follow_up_items: buildFollowUps(ranked),
  };

  for (const key of [
    "what_is_happening",
    "what_matters_now",
    "what_to_ask_next",
    "what_can_wait",
  ] as const) {
    assertNoBucketLeakage(snapshot[key], key);
  }
  for (const item of snapshot.follow_up_items) {
    assertNoBucketLeakage(item, "follow_up_items");
  }

  return snapshot;
}

/** Exact-key check for public compress. */
export function isExactSixFieldSnapshot(value: unknown): value is DecisionSnapshot {
  if (!value || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const expected = [
    "follow_up_items",
    "risk_level",
    "what_can_wait",
    "what_is_happening",
    "what_matters_now",
    "what_to_ask_next",
  ];
  if (keys.length !== 6 || keys.some((k, i) => k !== expected[i])) return false;
  if (typeof obj.what_is_happening !== "string") return false;
  if (typeof obj.what_matters_now !== "string") return false;
  if (typeof obj.what_to_ask_next !== "string") return false;
  if (obj.risk_level !== "low" && obj.risk_level !== "medium" && obj.risk_level !== "high") {
    return false;
  }
  if (typeof obj.what_can_wait !== "string") return false;
  if (!Array.isArray(obj.follow_up_items) || !obj.follow_up_items.every((x) => typeof x === "string")) {
    return false;
  }
  return true;
}

/** Count discrete actions listed in what_matters_now (1) 2) 3) pattern). */
export function countMattersNowActions(whatMattersNow: string): number {
  const matches = whatMattersNow.match(/\b\d+\)/g);
  return matches?.length ?? 0;
}
