import { randomUUID } from "node:crypto";
import type { PriorityConflictFlag } from "../priority-engine/types";
import { buildClarificationForConflict } from "./clarification";
import {
  CONFLICT_SEVERITY_CONFIDENCE_REDUCTION,
} from "./contract-constants";
import {
  detectConflicts,
  extractFactCandidates,
} from "./detect";
import { computeConflictDetectionEnvelope } from "./influence";
import {
  createEmptyConflictRegistry,
  getConflictRegistry,
  registerConflicts,
  setConflictRegistry,
} from "./registry";
import type {
  Conflict,
  ConflictDetectionLayerPayload,
  ConflictDetectionResult,
  ConflictSeverity,
  ConflictType,
  FactCandidate,
  RuntimeConflictFlag,
} from "./types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function conflictToFlag(c: Conflict): RuntimeConflictFlag {
  return {
    id: c.id,
    layers: ["conflict_registry"],
    summary: `${c.type}: "${c.statementA}" vs "${c.statementB}"`,
    confidenceReduction: CONFLICT_SEVERITY_CONFIDENCE_REDUCTION[c.severity],
    triggerReEvaluation: c.severity === "HIGH" || c.severity === "CRITICAL",
    unresolved: c.status === "open",
    conflictType: c.type,
    severity: c.severity,
  };
}

/**
 * Detect cross-layer contradictions + fold Priority Engine conflict flags.
 * Registers Conflicts into the operational registry (scope-scoped).
 * Flag / clarify only — does not pick winners.
 */
export function processConflictDetection(params: {
  scopeId?: string;
  situationId?: string;
  userInput?: string;
  memoryLabels?: readonly string[];
  assumptionHints?: readonly string[];
  responsibilityHints?: readonly string[];
  factCandidates?: readonly FactCandidate[];
  priorityConflicts?: readonly PriorityConflictFlag[];
  assumptionInvalidations?: readonly { assumptionId: string; reason: string }[];
  assumptionContradictionHints?: readonly string[];
  memoryContradictionHints?: readonly string[];
  /** Emotional contradiction loops from caregiver-psychological-load — behavior trigger. */
  emotionalContradictionHints?: readonly string[];
  documentAmbiguityFlags?: readonly string[];
  situationStatusConflicts?: readonly string[];
  highMissingInfoCount?: number;
  nowIso?: string;
}): ConflictDetectionResult {
  const scopeId = params.scopeId ?? "default";
  const nowIso = params.nowIso ?? new Date().toISOString();
  const flags: RuntimeConflictFlag[] = [];
  const detected: Conflict[] = [];

  const candidates = [
    ...(params.factCandidates ?? []),
    ...extractFactCandidates({
      userInput: params.userInput,
      memoryLabels: [
        ...(params.memoryLabels ?? []),
        ...(params.memoryContradictionHints ?? []),
      ],
      assumptionHints: [
        ...(params.assumptionHints ?? []),
        ...(params.assumptionContradictionHints ?? []),
      ],
      responsibilityHints: params.responsibilityHints,
      documentFlags: params.documentAmbiguityFlags,
    }),
  ];

  for (const c of detectConflicts({
    candidates,
    situationId: params.situationId,
    nowIso,
  })) {
    detected.push(c);
  }

  for (const c of params.priorityConflicts ?? []) {
    if (!c.unresolved) continue;
    flags.push({
      id: randomUUID(),
      layers: ["priority"],
      summary: c.detail,
      confidenceReduction: 0.08,
      triggerReEvaluation: true,
      unresolved: true,
      severity: "MEDIUM",
    });
  }

  for (const inv of params.assumptionInvalidations ?? []) {
    flags.push({
      id: `inv_${inv.assumptionId}`,
      layers: ["assumption"],
      summary: `assumption invalidated: ${inv.reason}`,
      confidenceReduction: 0.12,
      triggerReEvaluation: true,
      unresolved: true,
      severity: "HIGH",
    });
  }

  for (const hint of params.assumptionContradictionHints ?? []) {
    flags.push({
      id: randomUUID(),
      layers: ["assumption"],
      summary: hint,
      confidenceReduction: 0.1,
      triggerReEvaluation: true,
      unresolved: true,
      severity: "MEDIUM",
    });
  }

  for (const hint of params.memoryContradictionHints ?? []) {
    flags.push({
      id: randomUUID(),
      layers: ["memory"],
      summary: hint,
      confidenceReduction: 0.1,
      triggerReEvaluation: true,
      unresolved: true,
      severity: "MEDIUM",
    });
  }

  for (const hint of params.emotionalContradictionHints ?? []) {
    flags.push({
      id: randomUUID(),
      layers: ["assumption"],
      summary: hint,
      confidenceReduction: 0.18,
      triggerReEvaluation: true,
      unresolved: true,
      severity: "HIGH",
    });
  }

  for (const flag of params.documentAmbiguityFlags ?? []) {
    flags.push({
      id: randomUUID(),
      layers: ["document"],
      summary: `document ambiguity: ${flag}`,
      confidenceReduction: 0.08,
      triggerReEvaluation: false,
      unresolved: true,
      severity: "LOW",
    });
  }

  for (const s of params.situationStatusConflicts ?? []) {
    flags.push({
      id: randomUUID(),
      layers: ["situation"],
      summary: s,
      confidenceReduction: 0.15,
      triggerReEvaluation: true,
      unresolved: true,
      severity: "HIGH",
    });
  }

  if ((params.highMissingInfoCount ?? 0) > 0) {
    flags.push({
      id: "high_missing_info",
      layers: ["missing_information"],
      summary: `${params.highMissingInfoCount} HIGH missing-information gap(s) — block high-confidence irreversible decisions`,
      confidenceReduction: Math.min(0.45, (params.highMissingInfoCount ?? 0) * 0.15),
      triggerReEvaluation: true,
      unresolved: true,
      severity: "HIGH",
    });
  }

  // Promote leftover legacy flags that look like statement pairs into registry Conflicts when possible.
  for (const f of flags) {
    if (f.layers.includes("conflict_registry")) continue;
    // Keep as soft flags only — primary Conflicts come from detectConflicts.
  }

  let registry = getConflictRegistry(scopeId);
  if (
    registry.openConflicts.length === 0 &&
    registry.resolvedConflicts.length === 0 &&
    registry.ignoredConflicts.length === 0
  ) {
    registry = createEmptyConflictRegistry();
  }
  registry = registerConflicts(registry, detected);
  setConflictRegistry(scopeId, registry);

  for (const c of registry.openConflicts) {
    flags.push(conflictToFlag(c));
  }

  // Ensure clarification question exists on open conflicts.
  registry = {
    ...registry,
    openConflicts: registry.openConflicts.map((c) => {
      if (c.clarificationQuestion) return c;
      const built = buildClarificationForConflict(c);
      return {
        ...c,
        clarificationQuestion: built.question,
        clarificationOptions: built.options,
      };
    }),
  };
  setConflictRegistry(scopeId, registry);

  const envelope = computeConflictDetectionEnvelope(registry);
  const flagReduction = clamp01(
    flags.reduce((sum, f) => sum + f.confidenceReduction, 0),
  );
  const totalConfidenceReduction = clamp01(
    Math.max(envelope.confidencePenalty, flagReduction),
  );
  const reEvaluationRequired =
    flags.some((f) => f.triggerReEvaluation) ||
    envelope.criticalDecisionRestricted ||
    envelope.highOrCriticalOpenCount > 0;

  return {
    registry,
    conflicts: registry.openConflicts,
    flags,
    totalConfidenceReduction,
    reEvaluationRequired,
    criticalDecisionRestricted: envelope.criticalDecisionRestricted,
    envelope,
  };
}

export type ProcessConflictDetectionLayerParams = Parameters<
  typeof processConflictDetection
>[0];

export function processConflictDetectionLayer(
  params: ProcessConflictDetectionLayerParams,
): ConflictDetectionResult {
  return processConflictDetection(params);
}

export function toConflictDetectionLayerPayload(
  result: ConflictDetectionResult,
): ConflictDetectionLayerPayload {
  return {
    openCount: result.envelope.openCount,
    resolvedCount: result.registry.resolvedConflicts.length,
    criticalDecisionRestricted: result.criticalDecisionRestricted,
    totalConfidenceReduction: result.totalConfidenceReduction,
    reEvaluationRequired: result.reEvaluationRequired,
    conflictLoadContribution: result.envelope.conflictLoadContribution,
    clarification: result.envelope.clarification,
    openConflictTypes: result.conflicts.map((c) => c.type) as ConflictType[],
  };
}

export function formatConflictDetectionObservation(
  result: ConflictDetectionResult,
): string {
  const clar = result.envelope.clarification;
  if (clar) {
    return `${clar.headline}: ${clar.question}`;
  }
  if (result.envelope.openCount === 0) {
    return "No open conflicts requiring clarification.";
  }
  // Never announce "N conflicts detected" to caregivers — keep soft.
  return "Clarify unstable facts before high-confidence action.";
}

/** Severity ranking helper for tests / UI. */
export function severityAtLeast(
  severity: ConflictSeverity,
  minimum: ConflictSeverity,
): boolean {
  const rank: Record<ConflictSeverity, number> = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    CRITICAL: 3,
  };
  return rank[severity] >= rank[minimum];
}
