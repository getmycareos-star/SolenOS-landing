/**
 * Acceptance evaluators for Care Situation Understanding.
 * Golden / emotional / document fixtures = evaluation only — never product branches.
 */

import type { CareSituationUnderstanding } from "./types";
import { projectCareSituationOrientation } from "./project";

export type UnderstandingAcceptanceFailure =
  | "no_orient"
  | "echo_summary"
  | "no_facts_unknowns_split"
  | "no_priority"
  | "hollow_asks"
  | "causal_claim"
  | "family_as_primary"
  | "no_continuity_hooks";

export type UnderstandingAcceptanceResult = {
  ok: boolean;
  failures: UnderstandingAcceptanceFailure[];
  reasons: string[];
};

const ECHO_SUMMARY = [
  /\bhere is (?:a |my |your )?summary\b/i,
  /\bin summary\b/i,
  /\byou (?:said|mentioned|wrote)\b/i,
  /\bto summarize\b/i,
];

const HOLLOW_ASKS = [
  /^tell me more\.?$/i,
  /^how are you feeling\.?$/i,
  /^can you (?:share|tell) more\.?$/i,
  /^has something changed with care recently\??$/i,
];

const CAUSAL = [
  /\bmedication (?:caused|caused the|is causing)\b/i,
  /\bcaused (?:the )?(?:confusion|fall|decline)\b/i,
  /\bdefinitely (?:from|because of) (?:the )?medication\b/i,
];

/**
 * Structural acceptance for a built understanding object.
 * Multi-signal captures must separate facts/unknowns and prioritize.
 */
export function acceptCareSituationUnderstanding(
  u: CareSituationUnderstanding,
  opts?: { requireMultiSignal?: boolean },
): UnderstandingAcceptanceResult {
  const failures: UnderstandingAcceptanceFailure[] = [];
  const reasons: string[] = [];

  if (!u.can_orient) {
    failures.push("no_orient");
    reasons.push("Understanding cannot orient the caregiver.");
  }

  const requireMulti = opts?.requireMultiSignal ?? false;
  if (requireMulti) {
    if (u.facts.length < 2) {
      failures.push("no_facts_unknowns_split");
      reasons.push("Multi-signal capture should surface multiple care facts.");
    }
    if (u.unknowns.length < 1 && u.follow_up_questions.length < 1) {
      failures.push("no_facts_unknowns_split");
      reasons.push("Multi-signal capture with stated uncertainty must preserve unknowns.");
    }
    if (u.matters_now.length < 1) {
      failures.push("no_priority");
      reasons.push("Multi-signal capture must identify what matters now.");
    }
    if (u.can_wait.length < 1 && u.context_only.length < 1) {
      failures.push("no_priority");
      reasons.push("Multi-signal capture should identify what can wait (admin/load/retelling).");
    }
  }

  if (u.matters_now.length === 0 && u.facts.length > 0) {
    failures.push("no_priority");
    reasons.push("Facts exist but nothing was prioritized.");
  }

  for (const q of u.follow_up_questions) {
    if (HOLLOW_ASKS.some((p) => p.test(q.trim()))) {
      failures.push("hollow_asks");
      reasons.push(`Hollow ask: ${q}`);
    }
  }

  const blob = [
    ...u.matters_now,
    ...u.possible_links.map((l) => l.text),
    ...u.follow_up_questions,
  ].join("\n");

  if (CAUSAL.some((p) => p.test(blob))) {
    failures.push("causal_claim");
    reasons.push("Causation claimed — only possible links allowed.");
  }
  if (u.possible_links.some((l) => l.causation_claimed !== false)) {
    failures.push("causal_claim");
    reasons.push("possible_links must set causation_claimed: false.");
  }

  // Family/load must not be the only matters_now when recipient facts exist
  if (
    u.facts.some((f) => f.kind === "event" || f.kind === "observation") &&
    u.matters_now.length > 0 &&
    u.matters_now.every((m) =>
      /\b(?:brother|sister|only person|mixed together|papers?)\b/i.test(m),
    )
  ) {
    failures.push("family_as_primary");
    reasons.push("Family/admin must not outrank recipient care facts.");
  }

  if (requireMulti && u.continuity_hooks.length < 1) {
    failures.push("no_continuity_hooks");
    reasons.push("Multi-signal capture must leave continuity hooks for return.");
  }

  const projection = projectCareSituationOrientation(u);
  const projBlob = [
    projection.what_is_happening,
    projection.what_matters_now ?? "",
    projection.recognition_line ?? "",
  ].join("\n");
  if (ECHO_SUMMARY.some((p) => p.test(projBlob))) {
    failures.push("echo_summary");
    reasons.push("Projection looks like a summary of the caregiver's words.");
  }

  return {
    ok: failures.length === 0,
    failures: [...new Set(failures)],
    reasons,
  };
}
