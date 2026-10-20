/**
 * SolenOS Intelligence Layer — shared types.
 *
 * These types define the explicit boundary between raw caregiver input
 * and structured care understanding. Every stage in the intelligence
 * pipeline consumes and produces these types.
 */

export type SolenOSInput = {
  raw: string;
  source: "user_input" | "document" | "voice";
  caregiverId: string;
  careRecipientId?: string;
  contributorId?: string;
  documents?: Array<{
    id: string;
    name: string;
    extracted_text: string;
    mime_type?: string | null;
    ocr_confidence?: number | null;
  }>;
  timestamp?: string;
};

export type SolenOSMemory = {
  careRealityState: import("../care-reality-state/types").CareRealityState | null;
  activeSituation: import("../active-care-situation/types").ActiveCareSituation | null;
  continuityDecision: import("../care-identity").ContinuityDecision | null;
  recentEvents: import("../situation-entry").CanonicalCareEvent[];
};

export type IntelligenceStage = {
  name: string;
  durationMs: number;
};

export type UnderstandingResult = {
  understanding: import("../care-situation-understanding").CareSituationUnderstanding;
  appliedContinuity: boolean;
};

export type ReasoningResult = {
  questionsAnswered: boolean;
  prioritySet: boolean;
  uncertaintiesIdentified: boolean;
};

export type MemoryStrategyResult = {
  willRemember: boolean;
  memoryReason: string;
  openLoopsIdentified: number;
  memoryProposals?: Array<{
    type: string;
    description: string;
    priority: number;
    evidence_ref?: string | null;
  }>;
  continuityHooks?: string[];
  decayCandidates?: Array<{
    type: string;
    description: string;
    priority: number;
  }>;
};

export type IntelligenceOptions = {
  applyMemoryStrategy?: boolean;
  composeResponse?: boolean;
};

export type IntelligenceResult = {
  input: SolenOSInput;
  memory: SolenOSMemory;
  understanding: UnderstandingResult;
  reasoning: ReasoningResult;
  memoryStrategy: MemoryStrategyResult;
  situationResponse: import("../situation-entry").SituationResponse;
  activeSituation: import("../active-care-situation/types").ActiveCareSituation;
  activeTurn: import("../active-care-situation/types").ActiveSituationTurn;
  careRealityState: import("../care-reality-state/types").CareRealityState | null;
  composedResponse: import("../caregiver-response-composer").ComposedCaregiverResponse | null;
  stages: IntelligenceStage[];
};
