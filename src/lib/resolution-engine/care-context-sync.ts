/**
 * Sync TrackedSituation from CareContext / MVP situation ingest.
 * Locked B: durableCareKey === care_recipient_id (shared Care Reality).
 * Contributor attribution uses userId; never fork TrackedSituation per contributor.
 *
 * Note: does not import solenos-layers (avoids circular load with situation-entry).
 */

import type { Situation } from "../ui-runtime/types";
import {
  appendPreservedRefs,
  ensureActiveSituation,
  listSituationsForSession,
  upsertSituation,
} from "./persistence";
import { getActiveSituations, countByStatus } from "./filters";
import { runResolutionEngineGuarantee } from "./guarantee";
import { resolveSituation } from "./resolve";
import type { ResolutionEngineLayerPayload, TrackedSituation } from "./types";
import { mapLifecycleToUiStatus } from "./ui-bridge";

function titleFromInput(raw: string): string {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Care situation";
  return cleaned.length > 100 ? `${cleaned.slice(0, 97)}…` : cleaned;
}

function toPayload(situations: readonly TrackedSituation[]): ResolutionEngineLayerPayload {
  const counts = countByStatus(situations);
  const active = getActiveSituations(situations);
  const guarantee = runResolutionEngineGuarantee({ situations });
  return {
    activeCount: counts.active,
    resolvedCount: counts.resolved,
    archivedCount: counts.archived,
    activeSituationIds: active.map((s) => s.id),
    signals: {
      proposedEvidenceKind: null,
      rejectedForbiddenTriggers: [],
      supersedeRecommended: false,
    },
    guaranteeOk: guarantee.ok,
  };
}

export type CareContextSyncResult = {
  care_key: string;
  situations: TrackedSituation[];
  active: TrackedSituation[];
  resolution_engine_layer: ResolutionEngineLayerPayload;
  ui_situations: Situation[];
};

function buildResult(durableCareKey: string): CareContextSyncResult {
  const situations = listSituationsForSession(durableCareKey);
  const active = getActiveSituations(situations);
  return {
    care_key: durableCareKey,
    situations,
    active: [...active],
    resolution_engine_layer: toPayload(situations),
    ui_situations: situations.map(trackedSituationToUiSituation),
  };
}

/** Upsert Active TrackedSituation on every successful MVP care write. */
export function upsertTrackedSituationFromCareInput(params: {
  durableCareKey: string;
  rawInput: string;
  eventIds: readonly string[];
  documentIds?: readonly string[];
  userId?: string;
  /** When ACS opens a new situation, retire sticky ACTIVE titles from a prior event. */
  opensNewSituation?: boolean;
}): CareContextSyncResult {
  const careSessionId = params.durableCareKey;
  const title = titleFromInput(params.rawInput);
  const userId = params.userId ?? params.durableCareKey;

  if (params.opensNewSituation) {
    retireActiveTrackedSituationsForSupersede(careSessionId, {
      detail: "New care situation opened — prior active situation superseded.",
    });
  }

  const ensured = ensureActiveSituation({
    careSessionId,
    userId,
    title,
  });

  let active = appendPreservedRefs(ensured.active, {
    timelineEntryIds: params.eventIds,
    documentIds: params.documentIds,
  });

  if (
    params.opensNewSituation ||
    ensured.created ||
    active.title === "Care situation" ||
    active.title === "Untitled situation"
  ) {
    active = upsertSituation({
      ...active,
      title: title || active.title,
      updatedAt: new Date().toISOString(),
    });
  } else {
    active = upsertSituation({
      ...active,
      updatedAt: new Date().toISOString(),
    });
  }

  return buildResult(params.durableCareKey);
}

/**
 * Done for now — pause only. Keep TrackedSituations ACTIVE.
 * Never resolve on the Done button (solenos-done-for-now-continuity).
 */
export function pauseActiveTrackedSituationsForCareKey(
  durableCareKey: string,
  options?: { detail?: string },
): CareContextSyncResult {
  const now = new Date().toISOString();
  const detail = options?.detail ?? "Caregiver paused — Done for now.";
  const existing = listSituationsForSession(durableCareKey);
  for (const s of existing) {
    if (s.status !== "ACTIVE") continue;
    const version = (s.history[s.history.length - 1]?.version ?? 0) + 1;
    upsertSituation({
      ...s,
      updatedAt: now,
      lastReevaluatedAt: now,
      history: [
        ...s.history,
        {
          version,
          fromStatus: "ACTIVE",
          toStatus: "ACTIVE",
          at: now,
          reason: detail,
        },
      ],
    });
  }
  return buildResult(durableCareKey);
}

/**
 * When a new ACS thread opens, supersede prior ACTIVE TrackedSituations (engine-owned).
 * Not used by Done for now.
 */
export function retireActiveTrackedSituationsForSupersede(
  durableCareKey: string,
  options?: { detail?: string },
): CareContextSyncResult {
  const now = new Date().toISOString();
  const detail =
    options?.detail ?? "New care situation opened — prior active situation superseded.";
  const existing = listSituationsForSession(durableCareKey);
  for (const s of existing) {
    if (s.status !== "ACTIVE") continue;
    const resolved = resolveSituation(
      s,
      {
        kind: "SUPERSEDING_EVENT",
        detail,
        source: "system_event",
        recordedAt: now,
      },
      Date.now(),
    );
    if (resolved.ok) {
      upsertSituation(resolved.situation);
    }
  }
  return buildResult(durableCareKey);
}

/**
 * If CareContext has events but TrackedSituation store is empty,
 * create one ACTIVE situation so the sidebar is not amnesiac.
 */
export function hydrateTrackedSituationsFromCareContext(params: {
  durableCareKey: string;
  events: readonly {
    id: string;
    raw_input: string;
    document_id?: string | null;
  }[];
  userId?: string;
}): CareContextSyncResult {
  const existing = listSituationsForSession(params.durableCareKey);
  if (existing.length > 0 || params.events.length === 0) {
    return buildResult(params.durableCareKey);
  }

  const latest = params.events[params.events.length - 1]!;
  return upsertTrackedSituationFromCareInput({
    durableCareKey: params.durableCareKey,
    rawInput: latest.raw_input,
    eventIds: params.events.map((e) => e.id),
    documentIds: params.events
      .map((e) => e.document_id)
      .filter((id): id is string => Boolean(id)),
    userId: params.userId ?? params.durableCareKey,
  });
}

export function trackedSituationToUiSituation(t: TrackedSituation): Situation {
  return {
    id: t.id,
    title: t.title,
    status: mapLifecycleToUiStatus(t.status),
    riskLevel: "MEDIUM",
    documents: [],
    openQuestions: [],
    nextActions: [],
    risks: [],
    responsibilities: [],
    contextSummary: t.title,
    updatedAt: t.updatedAt,
  };
}

export function listActiveUiSituationsForCareKey(durableCareKey: string): Situation[] {
  return listSituationsForSession(durableCareKey)
    .filter((s) => s.status === "ACTIVE")
    .map(trackedSituationToUiSituation);
}
