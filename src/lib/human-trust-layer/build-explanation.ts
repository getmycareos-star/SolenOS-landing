import {
  DEFAULT_CHOOSE_ALTERNATIVE_LABEL,
  DEFAULT_IGNORE_LABEL,
  DEFAULT_UNDO_LABEL,
} from "./contract-constants";
import type {
  AlternativeOption,
  DecisionExplanationContext,
  RecommendationExplanation,
  ReversibilityAffordance,
} from "./types";
import {
  simplifyExplanationForLoad,
  stripSystemJargon,
} from "./emotional-readability";

function humanLabel(id: string, label?: string): string {
  const raw = (label ?? id).trim();
  if (!raw) return "another option";
  return stripSystemJargon(raw.replace(/[_-]+/g, " "));
}

function buildWhyThisWasChosen(ctx: DecisionExplanationContext): string {
  const chosen = humanLabel(ctx.chosenActionId, ctx.chosenActionLabel);
  const clarification = ctx.conflictClarifications?.[0];
  const failSafeAsk = ctx.failSafeMustClarify?.[0];

  if (ctx.loadFirstMode && ctx.burdenSummary?.trim()) {
    const contributors =
      ctx.primaryContributors && ctx.primaryContributors.length > 0
        ? ` Largest contributors: ${ctx.primaryContributors.join("; ")}.`
        : "";
    return `${ctx.burdenSummary.trim()}${contributors} SolenOS led with burden recognition — not care technique — because that is what you reported first.`;
  }

  if (ctx.failSafeEngaged) {
    const open = clarification ?? failSafeAsk;
    return open
      ? `SolenOS paused in fail-safe mode because critical truth is incomplete or conflicted. Clarify first: ${open}`
      : `SolenOS paused in fail-safe mode because critical truth is incomplete or conflicted — no next action until gaps are clarified.`;
  }

  if (ctx.containmentMode?.engaged) {
    if (ctx.emotionalValidation?.message) {
      return ctx.emotionalValidation.message;
    }
    return `"${chosen}" is the only action surfaced today — one steady step, everything else can wait.`;
  }

  if (ctx.caregiverProtectionMode) {
    return `"${chosen}" was kept as one simple step — protecting capacity matters more than speed right now.`;
  }

  if (ctx.highMissingInfoBlocked) {
    return clarification
      ? `Important details are still missing, so clarifying first was preferred over taking an irreversible step with "${chosen}". Open question: ${clarification}`
      : `Important details are still missing, so clarifying first was preferred over taking an irreversible step with "${chosen}".`;
  }

  if (ctx.priorityOverrideApplied) {
    return `"${chosen}" was chosen first because the harm risk is critical and the time pressure is immediate.`;
  }

  const topDemand = ctx.demandRanking?.[0];
  if (topDemand && topDemand.id === ctx.chosenActionId) {
    return `"${chosen}" ranked highest among active demands, so it is the next step that most reduces harm or uncertainty now.`;
  }

  if (ctx.topSituationId) {
    return `"${chosen}" was selected as the next best action for the highest-ranked situation based on risk, timing, missing details, and how much is already done.`;
  }

  return `"${chosen}" was selected as the next best action from the current ranking of risks and demands.`;
}

function buildWhatWasIgnored(ctx: DecisionExplanationContext): string[] {
  const ignored: string[] = [];

  for (const alt of ctx.rejectedAlternatives ?? []) {
    ignored.push(humanLabel(alt.id, alt.label));
  }

  if (ignored.length === 0 && ctx.demandRanking && ctx.demandRanking.length > 1) {
    for (const d of ctx.demandRanking.slice(1, 4)) {
      ignored.push(humanLabel(d.id, d.title));
    }
  }

  for (const title of ctx.deferredDemandTitles ?? []) {
    const label = humanLabel(title, title);
    if (!ignored.includes(label)) ignored.push(label);
  }

  for (const item of ctx.containmentMode?.whatNotToDoToday ?? []) {
    const label = stripSystemJargon(item);
    if (!ignored.includes(label)) ignored.push(label);
  }

  if (ignored.length === 0) {
    return ["No competing higher-pressure options were deferred for this pass."];
  }

  return ignored.slice(0, 5);
}

function buildRiskIfIgnored(ctx: DecisionExplanationContext): string {
  const risk = (ctx.outputRiskLevel ?? "").toLowerCase();
  const chosen = humanLabel(ctx.chosenActionId, ctx.chosenActionLabel);

  if (ctx.priorityOverrideApplied || risk === "critical" || risk === "high") {
    return `Ignoring "${chosen}" raises the chance that harm, delay, or confusion grows while time pressure is already high.`;
  }

  if (ctx.failSafeEngaged || ctx.highMissingInfoBlocked) {
    return `Skipping clarification leaves key unknowns open, which can lead to the wrong irreversible step later.`;
  }

  if (risk === "medium") {
    return `Putting off "${chosen}" can leave moderate risk unaddressed and make the next decision harder.`;
  }

  return `If "${chosen}" is skipped without a reason, the same pressure items remain and the situation may stay unresolved longer.`;
}

/**
 * Deterministic explanation from the decision graph — NO free LLM generation.
 * Same DecisionExplanationContext → same RecommendationExplanation (byte-stable).
 */
export function buildRecommendationExplanation(
  decisionContext: DecisionExplanationContext,
): RecommendationExplanation {
  const base: RecommendationExplanation = {
    whyThisWasChosen: buildWhyThisWasChosen(decisionContext),
    whatWasIgnored: buildWhatWasIgnored(decisionContext),
    riskIfIgnored: buildRiskIfIgnored(decisionContext),
  };

  return simplifyExplanationForLoad(base, {
    caregiverLoadState: decisionContext.caregiverLoadState,
    emotionalStress: decisionContext.emotionalStress,
  });
}

export function buildReversibilityAffordance(
  alternatives: readonly AlternativeOption[],
): ReversibilityAffordance {
  const alts = alternatives.map((a) => ({
    id: a.id,
    label: humanLabel(a.id, a.label),
  }));
  const canChoose = alts.length > 0;
  return {
    canUndo: true,
    canIgnore: true,
    canChooseAlternative: canChoose,
    undoLabel: DEFAULT_UNDO_LABEL,
    ignoreLabel: DEFAULT_IGNORE_LABEL,
    chooseAlternativeLabel: DEFAULT_CHOOSE_ALTERNATIVE_LABEL,
    alternatives: alts,
    supportedActions: canChoose
      ? ["undo", "ignore", "choose_alternative"]
      : ["undo", "ignore"],
  };
}

/** Stable fingerprint for multi-user consistency checks (no timing, no LLM). */
export function fingerprintDecisionContext(
  ctx: DecisionExplanationContext,
): string {
  const parts = [
    ctx.chosenActionId,
    ctx.chosenActionLabel,
    ...(ctx.rejectedAlternatives ?? []).map((a) => `${a.id}:${a.label}`),
    ...(ctx.priorityExplanationLines ?? []),
    String(Boolean(ctx.priorityOverrideApplied)),
    ctx.topSituationId ?? "",
    ...(ctx.demandRanking ?? []).map(
      (d) => `${d.id}:${d.title}:${d.pressureScore ?? ""}`,
    ),
    ...(ctx.conflictClarifications ?? []),
    ctx.caregiverLoadState ?? "",
    String(Boolean(ctx.emotionalStress)),
    String(Boolean(ctx.highMissingInfoBlocked)),
    String(Boolean(ctx.failSafeEngaged)),
    ...(ctx.failSafeMustClarify ?? []),
    ...(ctx.assumptionsUsed ?? []),
    ...(ctx.missingInfoImpact ?? []),
    ctx.outputRiskLevel ?? "",
    ...(ctx.deferredDemandTitles ?? []),
  ];
  return parts.join("|");
}
