/**
 * User Trust System — four mechanisms over family intelligence assets.
 * Remember / Explain / Reduce Guilt / Prevent Mistakes.
 */

import type { FamilyMemory } from "./family-memory";
import type { CareGraph } from "./care-graph";
import type { StrategicDecisionRecord } from "./decision-history";
import type { CrisisSignal } from "./crisis-prediction";
import type { ConfidenceState } from "./confidence-state";
import { TRUST_MECHANISMS } from "./contract-constants";

export type TrustMechanism = (typeof TRUST_MECHANISMS)[number];

export type TrustHookResult = {
  mechanism: TrustMechanism;
  active: boolean;
  message: string;
  evidence: string[];
};

export type TrustMechanismsSnapshot = {
  remember: TrustHookResult;
  explain: TrustHookResult;
  reduceGuilt: TrustHookResult;
  preventMistakes: TrustHookResult;
};

/**
 * Remember — appointments, obligations, responsibilities, family patterns.
 * Surfaces: "SolenOS remembered that for me"
 */
export function buildRememberHook(memory: FamilyMemory): TrustHookResult {
  const evidence: string[] = [];
  if (memory.people.length > 0) {
    evidence.push(`${memory.people.length} people in family memory`);
  }
  if (memory.relationships.length > 0) {
    evidence.push(`${memory.relationships.length} care relationships tracked`);
  }
  if (memory.historicalEvents.length > 0) {
    const last = memory.historicalEvents[memory.historicalEvents.length - 1]!;
    evidence.push(`last care event: ${last.summary}`);
  }
  if (memory.recurringPatterns.length > 0) {
    evidence.push(
      `${memory.recurringPatterns.length} recurring patterns remembered`,
    );
  }

  const active = evidence.length > 0;
  return {
    mechanism: "Remember",
    active,
    message: active
      ? "SolenOS remembered that for me"
      : "Family memory is still accumulating",
    evidence,
  };
}

/**
 * Explain — never unexplained scores; always causal explanation.
 */
export function buildExplainHook(params: {
  decision?: StrategicDecisionRecord | null;
  confidence?: ConfidenceState | null;
  crises?: readonly CrisisSignal[];
}): TrustHookResult {
  const evidence: string[] = [];
  if (params.decision?.reasoningSummary) {
    evidence.push(params.decision.reasoningSummary);
  } else if (params.decision?.recommendation) {
    evidence.push(`Recommended: ${params.decision.recommendation}`);
  }
  if (params.confidence?.explanation) {
    evidence.push(params.confidence.explanation);
  }
  for (const c of params.crises ?? []) {
    if (c.explanation) evidence.push(c.explanation);
  }

  const active = evidence.length > 0;
  return {
    mechanism: "Explain",
    active,
    message: active
      ? "Every score and recommendation has a causal explanation"
      : "No explanations recorded yet this session",
    evidence: evidence.slice(0, 5),
  };
}

/**
 * Reduce Guilt — Confidence Engine answers "Am I doing enough?"
 */
export function buildReduceGuiltHook(
  confidence: ConfidenceState | null,
): TrustHookResult {
  if (!confidence) {
    return {
      mechanism: "Reduce Guilt",
      active: false,
      message: "Confidence state not yet computed",
      evidence: [],
    };
  }
  return {
    mechanism: "Reduce Guilt",
    active: true,
    message: confidence.explanation,
    evidence: [
      `confidence=${confidence.confidence}`,
      ...(confidence.missingCriticalActions !== undefined
        ? [`missingCriticalActions=${confidence.missingCriticalActions}`]
        : []),
    ],
  };
}

/**
 * Prevent Mistakes — forgotten responsibilities, missed care, escalating crises.
 */
export function buildPreventMistakesHook(params: {
  careGraph: CareGraph;
  crises: readonly CrisisSignal[];
  overdueHints?: readonly string[];
}): TrustHookResult {
  const evidence: string[] = [];
  const owns = params.careGraph.edges.filter(
    (e) => e.kind === "owns_responsibility" || e.kind === "absorbs_workload",
  );
  if (owns.length > 0) {
    evidence.push(`${owns.length} active responsibility edges monitored`);
  }
  for (const c of params.crises.slice(0, 3)) {
    evidence.push(`[${c.category}] ${c.explanation}`);
  }
  for (const h of params.overdueHints ?? []) {
    evidence.push(h);
  }

  const active = evidence.length > 0;
  return {
    mechanism: "Prevent Mistakes",
    active,
    message: active
      ? "Watching for forgotten care, overload, and future failures"
      : "No prevention signals yet",
    evidence: evidence.slice(0, 5),
  };
}

export function buildTrustMechanismsSnapshot(input: {
  memory: FamilyMemory;
  careGraph: CareGraph;
  decision?: StrategicDecisionRecord | null;
  confidence?: ConfidenceState | null;
  crises?: readonly CrisisSignal[];
  overdueHints?: readonly string[];
}): TrustMechanismsSnapshot {
  return {
    remember: buildRememberHook(input.memory),
    explain: buildExplainHook({
      decision: input.decision,
      confidence: input.confidence,
      crises: input.crises,
    }),
    reduceGuilt: buildReduceGuiltHook(input.confidence ?? null),
    preventMistakes: buildPreventMistakesHook({
      careGraph: input.careGraph,
      crises: input.crises ?? [],
      overdueHints: input.overdueHints,
    }),
  };
}
