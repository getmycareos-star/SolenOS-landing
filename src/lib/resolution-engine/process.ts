import { DEFAULT_RETENTION_DAYS } from "./contract-constants";
import { nowIso } from "./defaults";
import { evaluateResolutionSignals } from "./evaluate-signals";
import {
  countByStatus,
  getActiveSituations,
  getArchivedSituations,
  getResolvedSituations,
} from "./filters";
import { runResolutionEngineGuarantee } from "./guarantee";
import {
  ensureActiveSituation,
  listSituationsForSession,
  replaceSessionSituations,
  upsertSituation,
} from "./persistence";
import {
  archiveSituation,
  buildArchiveEligibility,
  createNewSituationFromSupersede,
  resolveSituation,
} from "./resolve";
import type {
  ResolutionEngineLayerPayload,
  ResolutionEngineLayerResult,
  TrackedSituation,
} from "./types";

export type ProcessResolutionEngineLayerParams = {
  input: string;
  careSessionId: string;
  userId?: string;
  sourceType?: "text" | "document";
  /** When true, apply detected valid evidence (confirmation/completion/etc). Idle never applies. */
  applyDetectedEvidence?: boolean;
  /** Attempt archive on eligible RESOLVED after resolve. */
  attemptArchive?: boolean;
  retentionDays?: number;
  /** Explicit forbidden trigger attempt (must never resolve). */
  attemptedTrigger?: string;
  situationTitle?: string;
  nowMs?: number;
};

function touchReevaluation(
  situations: TrackedSituation[],
  nowMs?: number,
): TrackedSituation[] {
  const ts = nowIso(nowMs);
  return situations.map((s) =>
    s.status === "ACTIVE"
      ? { ...s, lastReevaluatedAt: ts, updatedAt: ts }
      : s,
  );
}

/**
 * RESOLUTION ENGINE — evaluate evidence signals, apply lifecycle transitions,
 * reevaluate ACTIVE situations, never auto-resolve on time/inactivity.
 */
export function processResolutionEngineLayer(
  params: ProcessResolutionEngineLayerParams,
): ResolutionEngineLayerResult {
  const nowMs = params.nowMs ?? Date.now();
  const apply = params.applyDetectedEvidence !== false;

  const ensured = ensureActiveSituation({
    careSessionId: params.careSessionId,
    userId: params.userId,
    title: params.situationTitle ?? (params.input.slice(0, 120) || "Care situation"),
    nowMs,
  });

  let situations = touchReevaluation(ensured.situations, nowMs);
  replaceSessionSituations(params.careSessionId, situations);

  const signals = evaluateResolutionSignals({
    input: params.input,
    sourceType: params.sourceType,
    attemptedTrigger: params.attemptedTrigger,
    nowMs,
  });

  let lastTransition: ResolutionEngineLayerResult["lastTransition"];

  // Forbidden triggers alone never resolve — even if apply is true.
  const forbiddenOnly =
    signals.rejectedForbiddenTriggers.length > 0 && !signals.proposedEvidence;

  if (apply && !forbiddenOnly && signals.proposedEvidence) {
    const active = situations.find((s) => s.status === "ACTIVE");
    if (active) {
      if (signals.supersedeRecommended) {
        const supersede = createNewSituationFromSupersede({
          prior: active,
          newTitle:
            params.situationTitle ??
            (params.input.slice(0, 120) || "Updated care situation"),
          detail: signals.proposedEvidence.detail,
          nowMs,
          source: signals.proposedEvidence.source,
        });
        if (supersede.ok) {
          upsertSituation(supersede.resolved);
          upsertSituation(supersede.created);
          situations = listSituationsForSession(params.careSessionId);
          lastTransition = {
            situationId: supersede.resolved.id,
            fromStatus: "ACTIVE",
            toStatus: "RESOLVED",
            evidenceKind: "SUPERSEDING_EVENT",
          };
        }
      } else {
        const resolved = resolveSituation(active, signals.proposedEvidence, nowMs);
        if (resolved.ok) {
          upsertSituation(resolved.situation);
          situations = listSituationsForSession(params.careSessionId);
          lastTransition = {
            situationId: resolved.situation.id,
            fromStatus: "ACTIVE",
            toStatus: "RESOLVED",
            evidenceKind: signals.proposedEvidence.kind,
          };

          // Ensure a fresh ACTIVE situation remains for ongoing care work after resolution,
          // unless catalog still has another ACTIVE (it won't after resolving the only one).
          // Spec: after resolve, remove from active queue — do NOT auto-create unless
          // user continues with new input in a later turn (ensureActiveSituation on next call).
          // For this turn after resolve: leave without ACTIVE — priority filters empty.
        }
      }
    }
  }

  if (params.attemptArchive) {
    const retentionDays = params.retentionDays ?? DEFAULT_RETENTION_DAYS;
    const next: TrackedSituation[] = [];
    for (const s of situations) {
      if (s.status !== "RESOLVED") {
        next.push(s);
        continue;
      }
      const checks = buildArchiveEligibility(s, situations, retentionDays, nowMs);
      const archived = archiveSituation(s, checks, nowMs);
      if (archived.ok) {
        next.push(archived.situation);
        if (!lastTransition) {
          lastTransition = {
            situationId: archived.situation.id,
            fromStatus: "RESOLVED",
            toStatus: "ARCHIVED",
            evidenceKind: archived.situation.resolutionEvidence?.kind,
          };
        }
      } else {
        next.push(s);
      }
    }
    replaceSessionSituations(params.careSessionId, next);
    situations = next;
  }

  situations = listSituationsForSession(params.careSessionId);
  const active = getActiveSituations(situations);
  const resolved = getResolvedSituations(situations);
  const archived = getArchivedSituations(situations);

  const guarantee = runResolutionEngineGuarantee({ situations, nowMs });

  const preservedRefs = {
    timelineEntryIds: situations.flatMap((s) => s.timelineEntryIds),
    memoryNodeIds: situations.flatMap((s) => s.memoryNodeIds),
    documentIds: situations.flatMap((s) => s.documentIds),
  };

  return {
    situations,
    active,
    resolved,
    archived,
    signals,
    lastTransition,
    guarantee,
    preservedRefs,
  };
}

export function toResolutionEngineLayerPayload(
  layer: ResolutionEngineLayerResult,
): ResolutionEngineLayerPayload {
  const counts = countByStatus(layer.situations);
  return {
    activeCount: counts.active,
    resolvedCount: counts.resolved,
    archivedCount: counts.archived,
    activeSituationIds: layer.active.map((s) => s.id),
    lastTransition: layer.lastTransition,
    signals: {
      proposedEvidenceKind: layer.signals.proposedEvidence?.kind ?? null,
      rejectedForbiddenTriggers: layer.signals.rejectedForbiddenTriggers,
      supersedeRecommended: layer.signals.supersedeRecommended,
    },
    guaranteeOk: layer.guarantee.ok,
  };
}

export function formatResolutionEngineObservation(
  layer: ResolutionEngineLayerResult,
): string {
  const counts = countByStatus(layer.situations);
  const trans = layer.lastTransition
    ? ` transition=${layer.lastTransition.fromStatus}→${layer.lastTransition.toStatus}`
    : "";
  const evidence = layer.signals.proposedEvidence
    ? ` evidence=${layer.signals.proposedEvidence.kind}`
    : "";
  return `OBSERVATION: RESOLUTION_ENGINE active=${counts.active} resolved=${counts.resolved} archived=${counts.archived}${evidence}${trans}`;
}
