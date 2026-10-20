import type {
  DECISION_RISK_LEVELS,
  DOCUMENT_SOURCE_TYPES,
  FEEDBACK_CORRECTION_KINDS,
  SIDEBAR_SECTION_IDS,
  SITUATION_STATUSES,
  TIMELINE_ENTRY_TYPES,
  UI_EVENT_LOOP_STAGES,
} from "./contract-constants";

export type DecisionRiskLevel = (typeof DECISION_RISK_LEVELS)[number];
export type SituationStatus = (typeof SITUATION_STATUSES)[number];
export type TimelineEntryType = (typeof TIMELINE_ENTRY_TYPES)[number];
export type DocumentSourceType = (typeof DOCUMENT_SOURCE_TYPES)[number];
export type SidebarSectionId = (typeof SIDEBAR_SECTION_IDS)[number];
export type FeedbackCorrectionKind = (typeof FEEDBACK_CORRECTION_KINDS)[number];
export type UiEventLoopStage = (typeof UI_EVENT_LOOP_STAGES)[number];

/** Highest-pressure demand shown on the Decision Surface (CLI-constrained). */
export type DecisionSurfaceDemand = {
  id: string;
  title: string;
  description: string;
  pressureScore: number;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  situationId: string;
  ownerName?: string | null;
};

/** Live decision surface — exactly one active card; new inference replaces it. */
export type DecisionCard = {
  situationId: string;
  whatIsHappening: string;
  whatMattersNow: string;
  nextBestAction: string;
  riskLevel: DecisionRiskLevel;
  unresolvedQuestions: string[];
  whatCanWait: string[];
  /** Knowledge gaps SolenOS needs — never task checklist items. */
  whatSolenOSNeedsNext?: string[];
  /**
   * Top pressure demands constrained by Caregiver Load Index state
   * (CRITICAL=1, HIGH=2, MODERATE=3, LOW≤4). Not a demand dashboard.
   */
  topDemands?: DecisionSurfaceDemand[];
  caregiverLoadState?: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  caregiverLoadScore?: number;
  /** Operational owner for next action — Responsibility Graph (STATE). */
  owner?: string | null;
  ownershipState?: "assigned" | "unassigned" | "shared" | "blocked" | null;
  /**
   * HUMAN TRUST LAYER — every successful recommendation must explain why,
   * what was ignored, and risk if ignored (EXPLANATION; not disclaimer text).
   */
  explanation?: {
    whyThisWasChosen: string;
    whatWasIgnored: string[];
    riskIfIgnored: string;
  };
  /** Undo / ignore / choose-alternative affordances from Human Trust Layer. */
  reversibility?: {
    canUndo: boolean;
    canIgnore: boolean;
    canChooseAlternative: boolean;
    undoLabel: string;
    ignoreLabel: string;
    chooseAlternativeLabel: string;
    alternatives: { id: string; label: string }[];
    supportedActions: ("undo" | "ignore" | "choose_alternative")[];
  };
  humanTrustEmotionalReadabilityApplied?: boolean;
  /** Emotional Load Signal — per-recommendation capacity metadata. */
  recommendationLoadMetadata?: {
    cognitiveLoadRequired: "LOW" | "MEDIUM" | "HIGH";
    emotionalImpact: "LOW" | "MEDIUM" | "HIGH";
    burnoutContribution: number;
  };
  cognitiveFatigueLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  caregiverProtectionMode?: boolean;
  /** Caregiver Confidence Layer — plain-English reassurance. */
  confidenceExplanation?: string;
  /** Crisis Prevention — subtle predictive warnings. */
  crisisWarnings?: readonly string[];
  /** Delegation — optional "could be handled by X". */
  delegationSuggestions?: readonly {
    task: string;
    recommendedPerson: string;
    reason: string;
    loadReductionEstimate?: number;
  }[];
  /** Retention-critical emotional normalization — EXPLANATION adjunct. */
  emotionalValidation?: {
    message: string;
    triggerReason: string;
    normalizeExperience: boolean;
  } | null;
  /** Containment mode — load reducer; max 1 action, emphasize deferrals. */
  containmentMode?: boolean;
  whatNotToDoToday?: readonly string[];
  /** Load-First Interpretation — burden recognition leads the Decision Surface. */
  loadFirstMode?: boolean;
  burdenSummary?: string;
  primaryContributors?: readonly string[];
  /** Caregiver Load Engine — five-dimension burden scores. */
  cognitiveLoadScore?: number;
  dependencyLoadScore?: number;
  burnoutTrend?: "stable" | "rising" | "critical";
  /** Interaction Load Signal — repetition fatigue / boundary stress. */
  interactionLoadFlags?: readonly {
    code: "repetition_fatigue" | "boundary_stress";
    description: string;
  }[];
  sleepProtectionMode?: boolean;
  outputStrategy?: "normal" | "interaction_survivability";
  boundaryViolationIndex?: number;
  interactionLoadInsight?: string;
  /** Attention Engine — Now / Watch / Later (Class A→Now, B→Watch, C→Later). */
  attentionPriority?: "Now" | "Watch" | "Later";
  attentionLabel?: string;
  attentionClass?: "A" | "B" | "C";
  burnoutTier?: "Low" | "Moderate" | "High" | "Critical";
};

export type DecisionSurface = {
  /** Sole active card; null when no inference has completed. */
  activeCard: DecisionCard | null;
};

/** Append-only audit log entry — immutable once recorded. */
export type TimelineEntry = {
  readonly id: string;
  readonly timestamp: string;
  readonly type: TimelineEntryType;
  readonly summary: string;
  readonly situationId: string;
};

export type TimelineLog = {
  readonly entries: readonly TimelineEntry[];
};

export type ActiveSituation = {
  id: string;
  title: string;
  status: SituationStatus;
  riskLevel: DecisionRiskLevel;
};

/** Primary system object — every other UI object belongs to a Situation. */
export type Situation = {
  id: string;
  title: string;
  status: SituationStatus;
  riskLevel: DecisionRiskLevel;
  documents: SituationDocument[];
  openQuestions: string[];
  nextActions: string[];
  risks: string[];
  responsibilities: string[];
  contextSummary: string;
  /** Current assumptions scoped to this situation — not a dedicated sidebar section. */
  currentAssumptions?: readonly {
    summary: string;
    status: "verified" | "active" | "stale";
  }[];
  /** Knowledge gaps for this situation — "Information Needed", not tasks. */
  informationNeeded?: readonly {
    question: string;
    importance: "LOW" | "MEDIUM" | "HIGH";
  }[];
  updatedAt: string;
};

export type SituationDocument = {
  id: string;
  situationId: string;
  title: string;
  sourceType: DocumentSourceType;
  summary: string;
};

export type CareProfileView = {
  roleInCareGraph: string;
  careRelationships: {
    dependents: string[];
    sharedCareWith: string[];
    externalCaregivers: string[];
  };
  caregivingPermissions: string[];
  delegationRights: string[];
  workloadIntensity?: string;
  timeSensitivity?: string;
  pendingConflictCount?: number;
  source: "care_profile_layer" | "defaults" | "stub";
};

export type CareContextView = {
  dependentProfiles: string[];
  conditions: string[];
  medications: string[];
  careConstraints: string[];
  environmentalFactors: string[];
  situationType?: string;
  urgencyLevel?: string;
  /** Assumptions influencing this situation — shown in situation details, not a new section. */
  currentAssumptions?: readonly {
    summary: string;
    status: "verified" | "active" | "stale";
  }[];
  /** Knowledge gaps — "Information Needed" inside situation/care context, not a sidebar section. */
  informationNeeded?: readonly {
    question: string;
    importance: "LOW" | "MEDIUM" | "HIGH";
  }[];
  /**
   * Single highest-severity conflict clarification — never a conflict count dump.
   * Prefer this over listing multiple open conflicts.
   */
  conflictClarification?: {
    headline: string;
    question: string;
    options?: readonly string[];
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  } | null;
  source: "care_context_layer" | "care_profile_layer" | "stub";
};

export type MemoryView = {
  identityMemory: string[];
  patternMemory: string[];
  operationalMemory: string[];
  correctionMemory: string[];
  compositeInfluence?: number;
  activeEntryCount?: number;
  source: "memory_influence_layer" | "stub";
};

export type ResponsibilityGraphView = {
  owner: string;
  delegates: string[];
  sharedCaregivers: string[];
  unresolvedOwnershipConflicts: string[];
  health?: string;
  unassignedCount?: number;
  criticalUnassignedCount?: number;
  escalate?: boolean;
  source: "responsibility_graph_layer" | "care_profile_layer" | "stub";
};

export type SafetySettingsView = {
  uncertaintyDisplay: boolean;
  medicalAdvisoryMode: string;
  riskSensitivity: string;
  escalationRules: string[];
  /** Assumptions surfaced during safety review — not a dedicated sidebar section. */
  currentAssumptions?: readonly {
    summary: string;
    status: "verified" | "active" | "stale";
  }[];
  source: "safety_layer" | "system_settings" | "defaults";
};

export type SystemSettingsView = {
  memoryBehavior: string;
  decisionAuthority: string;
  timeEngineBehavior: string;
  systemMode: string;
  languagePreference: string;
  source: "governance_layer" | "defaults";
};

export type FeedbackCorrection = {
  kind: FeedbackCorrectionKind;
  note: string;
  recordedAt: string;
  situationId: string;
};

export type SystemHealthView = {
  confidenceDrift: string;
  contextCompleteness: string;
  memoryQuality: string;
  contradictionCount: number;
  staleDocuments: number;
  unresolvedQuestions: number;
  /** Decision readiness band — Strong/Stable/Degraded/Unreliable. */
  band?: string;
  overallHealthScore?: number;
  issueBullets?: readonly string[];
  userFacingSummary?: string;
  /** Assumption registry health — shown inside System Health, not a sidebar section. */
  assumptionHealth?: {
    activeAssumptions: number;
    expiredAssumptions: number;
    invalidatedAssumptions: number;
    staleAssumptions: number;
  };
  currentAssumptions?: readonly {
    summary: string;
    status: "verified" | "active" | "stale";
  }[];
  /** Missing information health — Reasoning Quality Impact inside System Health. */
  missingInformationHealth?: {
    openItems: number;
    highPriorityItems: number;
    resolvedItems: number;
  };
  highPriorityGaps?: readonly string[];
  reasoningQualityWarning?: string;
  /** Caregiver Confidence Layer — plain-English reassurance in System Health. */
  caregiverConfidenceExplanation?: string;
  caregiverConfidenceScore?: number;
  source: "system_health_layer" | "derived" | "stub";
};

export type AboutSolenOSSection = {
  id: string;
  title: string;
  body: string[];
  linkHref?: string;
  linkLabel?: string;
};

export type AboutSolenOSView = {
  identity: string;
  principle: string;
  notProductOf: string[];
  /** Trust content — founder story, mission, beliefs, how it works, privacy. */
  sections: AboutSolenOSSection[];
};

export type InputBarState = {
  persistent: true;
  value: string;
  loading: boolean;
  error: string | null;
};

/** Top-level UI region composition. */
export type SolenOSUI = {
  liveDecisionSurface: DecisionSurface;
  timeline: TimelineLog;
  sidebar: {
    activeSection: SidebarSectionId;
    sections: readonly SidebarSectionId[];
  };
  inputBar: InputBarState;
};

export type UiRuntimeState = {
  situations: Situation[];
  activeSituationId: string | null;
  decisionSurface: DecisionSurface;
  timeline: TimelineLog;
  feedbackCorrections: FeedbackCorrection[];
};
