import type {
  CASE_DECISION_SNAPSHOT_KEYS,
  CASE_EVENT_TYPES,
  CASE_RISK_LEVELS,
  PATTERN_MATCH_STRENGTHS,
  PATTERN_RESPONSE_STATES,
} from "./contract-constants";

export type CaseRiskLevel = (typeof CASE_RISK_LEVELS)[number];
export type CaseEventType = (typeof CASE_EVENT_TYPES)[number];
export type PatternMatchStrength = (typeof PATTERN_MATCH_STRENGTHS)[number];
export type PatternResponseState = (typeof PATTERN_RESPONSE_STATES)[number];
export type CaseDecisionSnapshotKey = (typeof CASE_DECISION_SNAPSHOT_KEYS)[number];

export type CaseStatus = "active" | "paused" | "archived";

export type CaseProfile = {
  displayName: string;
  relationship?: string;
  preferredName?: string;
  notes?: string;
};

export type Condition = {
  id: string;
  name: string;
  status: "active" | "resolved" | "suspected";
  notedAt: string;
  source: string;
};

export type Medication = {
  id: string;
  name: string;
  dose?: string;
  schedule?: string;
  status: "active" | "stopped" | "unknown";
  notedAt: string;
  source: string;
};

export type Provider = {
  id: string;
  name: string;
  role?: string;
  notedAt: string;
  source: string;
};

export type Facility = {
  id: string;
  name: string;
  kind?: string;
  notedAt: string;
  source: string;
};

export type CaseDocument = {
  id: string;
  title: string;
  kind?: string;
  notedAt: string;
  source: string;
  ref?: string;
};

export type CaseIntervention = {
  id: string;
  label: string;
  description?: string;
  technique?: string;
  eventId?: string;
  appliedAt: string;
  outcome?: CaseOutcomeSummary;
};

export type CaseOutcomeSummary = {
  success: boolean;
  summary: string;
  recordedAt: string;
};

export type CaseEvent = {
  id: string;
  caseId: string;
  timestamp: string;
  eventType: CaseEventType;
  source: string;
  summary: string;
  location?: string;
  riskLevel?: CaseRiskLevel;
  tags: string[];
  intervention?: CaseIntervention;
  outcome?: CaseOutcomeSummary;
  situationId?: string;
};

export type FamilyContext = {
  primaryCaregiverHint?: string;
  householdNotes?: string[];
  supportNetworkHints?: string[];
};

export type CaseUnderstanding = {
  summary: string;
  activePatterns: string[];
  successfulInterventions: string[];
  openRisks: string[];
  updatedAt: string;
};

/**
 * Core product entity — everything durable attaches to Case (care recipient).
 * Situations (ADR-001 runtime) attach to Case; they do not replace Case.
 */
export type Case = {
  id: string;
  profile: CaseProfile;
  status: CaseStatus;
  createdAt: string;
  updatedAt: string;
  conditions: Condition[];
  medications: Medication[];
  providers: Provider[];
  facilities: Facility[];
  documents: CaseDocument[];
  familyContext: FamilyContext;
  understanding: CaseUnderstanding;
  /** Runtime Situation ids currently/formerly attached to this Case. */
  situationIds: string[];
};

/** Fixed output contract — exactly these keys. Temporal info embedded in text only. */
export type CaseDecisionSnapshot = {
  what_is_happening: string;
  what_matters_now: string;
  what_to_ask_next: string;
  risk_level: CaseRiskLevel;
  what_can_wait: string;
  follow_up_items: string[];
};

export type RankedCaseEvent = {
  event: CaseEvent;
  score: number;
  reasons: string[];
};

export type SelectiveRecallResult = {
  shouldRecall: boolean;
  triggerReasons: string[];
  ranked: RankedCaseEvent[];
  matchStrength: PatternMatchStrength;
};

export type PatternResponsePolicyResult = {
  state: PatternResponseState;
  matchStrength: PatternMatchStrength;
  fieldWeighting: {
    what_is_happening: "present_only" | "minimal_history" | "light_past";
    what_matters_now: "immediate_action" | "cautious_suggestion" | "intervention_logic";
    what_to_ask_next: "clarify_present" | "cautious_compare" | "validate_change";
    follow_up_items: "present_tasks" | "light_continuity" | "action_replication";
  };
  preferredIntervention?: CaseIntervention;
  topEvents: RankedCaseEvent[];
};

export type ExtractedCaseFacts = {
  careRecipientHints: string[];
  relationshipHint?: string;
  conditions: Array<{ name: string }>;
  medications: Array<{ name: string; dose?: string }>;
  providers: Array<{ name: string; role?: string }>;
  facilities: Array<{ name: string }>;
  events: Array<{
    eventType: CaseEventType;
    summary: string;
    tags: string[];
    riskLevel?: CaseRiskLevel;
    location?: string;
  }>;
  interventions: Array<{
    label: string;
    technique?: string;
    success?: boolean;
    outcomeSummary?: string;
  }>;
};

export type CaseMemoryLayerResult = {
  caseEntity: Case;
  identified: boolean;
  extracted: ExtractedCaseFacts;
  newEvents: CaseEvent[];
  recall: SelectiveRecallResult;
  policy: PatternResponsePolicyResult;
  snapshot: CaseDecisionSnapshot;
  guarantee: CaseMemoryGuaranteeResult;
};

export type CaseMemoryGuaranteeResult = {
  ok: boolean;
  violations: string[];
};

export type CaseMemoryLayerPayload = {
  caseId: string;
  displayName: string;
  relationship?: string;
  status: CaseStatus;
  patternState: PatternResponseState;
  matchStrength: PatternMatchStrength;
  shouldRecall: boolean;
  recalledEventCount: number;
  conditionCount: number;
  timelineEventCount: number;
  preferredInterventionLabel?: string;
  /** Full 6-field Case Decision Snapshot (product contract). */
  decision_snapshot: CaseDecisionSnapshot;
};

/** Persistence adapter — Postgres stub / noop default. */
export type CaseMemoryPersistenceAdapter = {
  loadCase: (caseId: string) => Promise<Case | null>;
  saveCase: (caseEntity: Case) => Promise<void>;
  loadEvents: (caseId: string) => Promise<CaseEvent[]>;
  saveEvent: (event: CaseEvent) => Promise<void>;
  status: "noop" | "postgres_stub" | "postgres";
};
