/**
 * Conflict Detection Engine — evaluates whether facts can coexist.
 * Operational registry (not a 4th persistent truth layer).
 */

export type ConflictType =
  | "fact_conflict"
  | "responsibility_conflict"
  | "preference_conflict"
  | "timeline_conflict"
  | "medical_conflict";

export type ConflictSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ConflictStatus = "open" | "resolved" | "ignored";

export type Conflict = {
  id: string;
  type: ConflictType;
  statementA: string;
  statementB: string;
  confidence: number;
  severity: ConflictSeverity;
  status: ConflictStatus;
  createdAt: string;
  /** Clarification question generated once at detection. */
  clarificationQuestion?: string;
  clarificationOptions?: readonly string[];
  /** Optional situation scope — registry is operational state tied to situations. */
  situationId?: string;
  resolvedAt?: string;
  resolutionNote?: string;
};

export type ConflictRegistry = {
  openConflicts: Conflict[];
  resolvedConflicts: Conflict[];
  ignoredConflicts: Conflict[];
};

/** Candidate statements for pairwise coexistence checks. */
export type FactCandidate = {
  statement: string;
  source?: "memory" | "input" | "assumption" | "document" | "responsibility";
};

export type ConflictClarification = {
  conflictId: string;
  type: ConflictType;
  severity: ConflictSeverity;
  /** Single caregiver-facing question — never a conflict count. */
  question: string;
  options?: readonly string[];
  headline: "Important clarification needed";
};

export type ConflictDetectionEnvelope = {
  openCount: number;
  highOrCriticalOpenCount: number;
  criticalMedicalOpen: boolean;
  /** Soft confidence reduction [0,1] from open conflicts. */
  confidencePenalty: number;
  /** When true, restrict high-confidence irreversible decision generation. */
  criticalDecisionRestricted: boolean;
  /** 0–100 contribution toward Caregiver Load conflictLoad. */
  conflictLoadContribution: number;
  /** ONE primary clarification — never a conflict dump. */
  clarification: ConflictClarification | null;
  influenceHints: readonly string[];
};

/** Legacy cross-layer flag shape (preserved for core-runtime / analyze callers). */
export type ConflictSourceLayer =
  | "assumption"
  | "memory"
  | "situation"
  | "document"
  | "priority"
  | "missing_information"
  | "conflict_registry";

export type RuntimeConflictFlag = {
  id: string;
  layers: readonly ConflictSourceLayer[];
  summary: string;
  /** Soft confidence reduction [0,1]. */
  confidenceReduction: number;
  /** When true, orchestration should re-evaluate before irreversible action. */
  triggerReEvaluation: boolean;
  unresolved: boolean;
  conflictType?: ConflictType;
  severity?: ConflictSeverity;
};

export type ConflictDetectionResult = {
  registry: ConflictRegistry;
  conflicts: readonly Conflict[];
  flags: readonly RuntimeConflictFlag[];
  totalConfidenceReduction: number;
  reEvaluationRequired: boolean;
  criticalDecisionRestricted: boolean;
  envelope: ConflictDetectionEnvelope;
};

export type ConflictDetectionLayerPayload = {
  openCount: number;
  resolvedCount: number;
  criticalDecisionRestricted: boolean;
  totalConfidenceReduction: number;
  reEvaluationRequired: boolean;
  conflictLoadContribution: number;
  clarification: ConflictClarification | null;
  openConflictTypes: readonly ConflictType[];
};
