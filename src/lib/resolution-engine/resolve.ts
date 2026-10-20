import { nowIso } from "./defaults";
import { validateResolutionEvidence } from "./evidence";
import { validateLifecycleTransition } from "./lifecycle";
import type {
  ArchiveEligibilityChecks,
  ArchiveSituationResult,
  ResolutionEvidence,
  ResolveSituationResult,
  SupersedeSituationResult,
  TrackedSituation,
} from "./types";
import { createEmptyTrackedSituation } from "./defaults";

function appendHistory(
  situation: TrackedSituation,
  entry: Omit<TrackedSituation["history"][number], "version">,
): TrackedSituation["history"] {
  const version = (situation.history[situation.history.length - 1]?.version ?? 0) + 1;
  return [...situation.history, { ...entry, version }];
}

/**
 * ACTIVE → RESOLVED with validated evidence.
 * Never deletes timeline / memory / document refs.
 */
export function resolveSituation(
  situation: TrackedSituation,
  evidence: ResolutionEvidence,
  nowMs?: number,
): ResolveSituationResult {
  const transition = validateLifecycleTransition(situation.status, "RESOLVED");
  if (!transition.ok) {
    return { ok: false, violations: transition.violations };
  }

  const validated = validateResolutionEvidence(evidence);
  if (!validated.ok) {
    return { ok: false, violations: validated.violations };
  }

  const ts = nowIso(nowMs);
  const next: TrackedSituation = {
    ...situation,
    status: "RESOLVED",
    updatedAt: ts,
    resolvedAt: ts,
    lastReevaluatedAt: ts,
    resolutionEvidence: validated.evidence,
    // Preserve all refs — explicit copy for clarity
    timelineEntryIds: [...situation.timelineEntryIds],
    memoryNodeIds: [...situation.memoryNodeIds],
    documentIds: [...situation.documentIds],
    history: appendHistory(situation, {
      fromStatus: situation.status,
      toStatus: "RESOLVED",
      at: ts,
      reason: "evidence_based_resolution",
      evidenceKind: validated.evidence.kind,
    }),
  };

  return { ok: true, situation: next };
}

/**
 * RESOLVED → ARCHIVED when archival checks pass.
 * Archive is storage/reasoning optimization — NOT deletion.
 */
export function archiveSituation(
  situation: TrackedSituation,
  checks: ArchiveEligibilityChecks,
  nowMs?: number,
): ArchiveSituationResult {
  const transition = validateLifecycleTransition(situation.status, "ARCHIVED");
  if (!transition.ok) {
    return { ok: false, violations: transition.violations };
  }

  const violations: string[] = [];
  if (!checks.noActiveReferences) {
    violations.push("still referenced by active situations");
  }
  if (!checks.retentionSatisfied) {
    violations.push("retention window not satisfied");
  }
  if (!checks.noUnresolvedDependencies) {
    violations.push("unresolved dependencies remain");
  }
  if (violations.length > 0) {
    return { ok: false, violations };
  }

  const ts = nowIso(nowMs);
  const next: TrackedSituation = {
    ...situation,
    status: "ARCHIVED",
    updatedAt: ts,
    archivedAt: ts,
    lastReevaluatedAt: ts,
    timelineEntryIds: [...situation.timelineEntryIds],
    memoryNodeIds: [...situation.memoryNodeIds],
    documentIds: [...situation.documentIds],
    history: appendHistory(situation, {
      fromStatus: situation.status,
      toStatus: "ARCHIVED",
      at: ts,
      reason: "archival_optimization",
      evidenceKind: situation.resolutionEvidence?.kind,
    }),
  };

  return { ok: true, situation: next };
}

/**
 * Superseding event: resolve prior ACTIVE with SUPERSEDING_EVENT evidence,
 * then create a NEW ACTIVE situation (never resurrect).
 */
export function createNewSituationFromSupersede(params: {
  prior: TrackedSituation;
  newTitle: string;
  detail: string;
  nowMs?: number;
  source?: ResolutionEvidence["source"];
}): SupersedeSituationResult {
  if (params.prior.status !== "ACTIVE") {
    return {
      ok: false,
      violations: ["only ACTIVE situations can be superseded"],
    };
  }

  const ts = nowIso(params.nowMs);
  const evidence: ResolutionEvidence = {
    kind: "SUPERSEDING_EVENT",
    detail: params.detail,
    source: params.source ?? "document",
    recordedAt: ts,
  };

  const resolvedResult = resolveSituation(params.prior, evidence, params.nowMs);
  if (!resolvedResult.ok) {
    return resolvedResult;
  }

  const created = createEmptyTrackedSituation({
    title: params.newTitle,
    careSessionId: params.prior.careSessionId,
    userId: params.prior.userId,
    nowMs: params.nowMs,
    // Do not move prior docs/memory into deletion — new situation starts fresh refs;
    // prior keeps its preserved refs.
  });

  const linkedCreated: TrackedSituation = {
    ...created,
    supersedesId: params.prior.id,
  };

  const linkedResolved: TrackedSituation = {
    ...resolvedResult.situation,
    supersededById: linkedCreated.id,
  };

  return {
    ok: true,
    resolved: linkedResolved,
    created: linkedCreated,
  };
}

/**
 * Build archive eligibility from situation + catalog context.
 */
export function buildArchiveEligibility(
  situation: TrackedSituation,
  catalog: readonly TrackedSituation[],
  retentionDays: number,
  nowMs: number = Date.now(),
): ArchiveEligibilityChecks {
  const stillReferenced = catalog.some(
    (s) =>
      s.status === "ACTIVE" &&
      (s.referencedBySituationIds.includes(situation.id) ||
        s.supersedesId === situation.id ||
        situation.referencedBySituationIds.includes(s.id)),
  );

  const resolvedAt = situation.resolvedAt ? Date.parse(situation.resolvedAt) : NaN;
  const retentionMs = retentionDays * 24 * 60 * 60 * 1000;
  const retentionSatisfied =
    Number.isFinite(resolvedAt) && nowMs - resolvedAt >= retentionMs;

  return {
    noActiveReferences: !stillReferenced,
    retentionSatisfied,
    noUnresolvedDependencies: situation.unresolvedDependencyIds.length === 0,
  };
}
