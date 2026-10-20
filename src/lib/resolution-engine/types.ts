import type {
  FORBIDDEN_RESOLUTION_TRIGGERS,
  RESOLUTION_EVIDENCE_KINDS,
  SITUATION_LIFECYCLE_STATUSES,
} from "./contract-constants";

export type SituationStatus = (typeof SITUATION_LIFECYCLE_STATUSES)[number];

export type ResolutionEvidenceKind = (typeof RESOLUTION_EVIDENCE_KINDS)[number];

export type ForbiddenResolutionTrigger = (typeof FORBIDDEN_RESOLUTION_TRIGGERS)[number];

/** Evidence required for ACTIVE → RESOLVED. */
export type ResolutionEvidence = {
  kind: ResolutionEvidenceKind;
  detail: string;
  source: "user_input" | "document" | "approval" | "fulfillment" | "system_event";
  recordedAt: string;
  /** Optional confidence 0–1 — NEVER alone sufficient to resolve. */
  confidence?: number;
};

export type LifecycleHistoryEntry = {
  version: number;
  fromStatus: SituationStatus | null;
  toStatus: SituationStatus;
  at: string;
  reason: string;
  evidenceKind?: ResolutionEvidenceKind;
};

/**
 * Tracked operational situation — primary object for resolution lifecycle.
 * Timeline / memory / document refs are preserved on resolve and archive (never deleted).
 */
export type TrackedSituation = {
  id: string;
  title: string;
  status: SituationStatus;
  careSessionId: string;
  userId?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  archivedAt?: string;
  /** Touched on each resolution-engine evaluation while ACTIVE. */
  lastReevaluatedAt: string;
  resolutionEvidence?: ResolutionEvidence;
  supersededById?: string;
  supersedesId?: string;
  /** Preserved refs — NO deletion on resolve/archive. */
  timelineEntryIds: string[];
  memoryNodeIds: string[];
  documentIds: string[];
  /** Other ACTIVE situations that still reference this one. */
  referencedBySituationIds: string[];
  unresolvedDependencyIds: string[];
  history: LifecycleHistoryEntry[];
};

export type ArchiveEligibilityChecks = {
  /** No longer referenced by any ACTIVE situation. */
  noActiveReferences: boolean;
  /** Retention window satisfied. */
  retentionSatisfied: boolean;
  /** No outstanding unresolved dependencies. */
  noUnresolvedDependencies: boolean;
};

export type ResolveSituationResult =
  | { ok: true; situation: TrackedSituation }
  | { ok: false; violations: string[] };

export type ArchiveSituationResult =
  | { ok: true; situation: TrackedSituation }
  | { ok: false; violations: string[] };

export type SupersedeSituationResult =
  | {
      ok: true;
      resolved: TrackedSituation;
      created: TrackedSituation;
    }
  | { ok: false; violations: string[] };

export type ResolutionSignalDetection = {
  /** Proposed evidence when surface language matches a valid kind. */
  proposedEvidence: ResolutionEvidence | null;
  /** Explicitly rejected if request looked like a forbidden trigger. */
  rejectedForbiddenTriggers: ForbiddenResolutionTrigger[];
  /** True when superseding language / new discharge docs detected. */
  supersedeRecommended: boolean;
};

export type ResolutionEngineGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type ResolutionEngineLayerPayload = {
  activeCount: number;
  resolvedCount: number;
  archivedCount: number;
  activeSituationIds: readonly string[];
  lastTransition?: {
    situationId: string;
    fromStatus: SituationStatus | null;
    toStatus: SituationStatus;
    evidenceKind?: ResolutionEvidenceKind;
  };
  signals: {
    proposedEvidenceKind: ResolutionEvidenceKind | null;
    rejectedForbiddenTriggers: readonly ForbiddenResolutionTrigger[];
    supersedeRecommended: boolean;
  };
  guaranteeOk: boolean;
};

export type ResolutionEngineLayerResult = {
  situations: readonly TrackedSituation[];
  active: readonly TrackedSituation[];
  resolved: readonly TrackedSituation[];
  archived: readonly TrackedSituation[];
  signals: ResolutionSignalDetection;
  lastTransition?: ResolutionEngineLayerPayload["lastTransition"];
  guarantee: ResolutionEngineGuaranteeResult;
  /** Refs that must survive — echo for consumers / audit. */
  preservedRefs: {
    timelineEntryIds: readonly string[];
    memoryNodeIds: readonly string[];
    documentIds: readonly string[];
  };
};
