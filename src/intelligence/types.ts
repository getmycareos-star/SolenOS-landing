/**
 * SolenOS Intelligence Pipeline — shared types.
 *
 * These types define the explicit boundary between raw caregiver input
 * and structured care understanding. Every stage in the intelligence
 * pipeline consumes and produces these types.
 */

import type { CanonicalCareEvent, CareContextRoot, ProcessSituationInput, SituationResponse } from "../lib/situation-entry/types";
import type { CareSituationUnderstanding } from "../lib/care-situation-understanding/types";
import type { CareReasoningSnapshot } from "../lib/care-reasoning/types";
import type { FinalOutputContract } from "../lib/final-output-contract/types";
import type { ActiveCareSituation, ActiveSituationTurn } from "../lib/active-care-situation/types";
import type { CareRealityState } from "../lib/care-reality-state/types";
import type { ContinuityDecision } from "../lib/care-identity/continuity-detection";
import type { ComposedCaregiverResponse } from "../lib/caregiver-response-composer";
import type { DareIngestResult } from "../lib/data-acquisition-resilience/types";

// ============================================================
// Stage 1: Extraction
// ============================================================

export type ExtractionInput = {
  raw_input: string;
  documents?: ProcessSituationInput["documents"];
  caregiverId: string;
  timestamp?: string;
};

export type ExtractionResult = {
  events: CanonicalCareEvent[];
  dare: DareIngestResult | null;
  documentEventsCount: number;
  provisionalFromDare: string[];
};

// ============================================================
// Stage 2: Understanding
// ============================================================

export type UnderstandingInput = {
  extraction: ExtractionResult;
  priorContext: CareContextRoot | null;
  caregiverId: string;
  careRecipientId: string;
  raw_input: string;
  continuityDecision: ContinuityDecision | null;
  activeSituation: ActiveCareSituation | null;
  careRealityState: CareRealityState | null;
  timestamp?: string;
};

export type UnderstandingResult = {
  understanding: CareSituationUnderstanding;
  events_created: CanonicalCareEvent[];
  context: CareContextRoot;
  whatChanged: string[];
  mergedUncertain: string[];
  mergedClarification: string[];
  tracked: string[];
};

// ============================================================
// Stage 3: Reasoning
// ============================================================

export type ReasoningInput = {
  understanding: CareSituationUnderstanding;
  continuityDecision: ContinuityDecision | null;
  caregiverId: string;
  careRecipientId: string;
  events_created: CanonicalCareEvent[];
  context: CareContextRoot;
  whatChanged: string[];
  mergedUncertain: string[];
  mergedClarification: string[];
  raw_input: string;
  timestamp?: string;
};

export type ReasoningResult = {
  reasoningSnapshot: CareReasoningSnapshot;
  allQuestionsAnswered: boolean;
};

// ============================================================
// Stage 4: Communication
// ============================================================

export type CommunicationInput = {
  reasoning: ReasoningResult;
  understanding: CareSituationUnderstanding;
  caregiverId: string;
  careRecipientId: string;
  context: CareContextRoot;
  events_created: CanonicalCareEvent[];
  whatChanged: string[];
  mergedUncertain: string[];
  mergedClarification: string[];
  raw_input: string;
  continuityDecision: ContinuityDecision | null;
  activeSituation: ActiveCareSituation | null;
  careRealityState: CareRealityState | null;
  timestamp?: string;
};

export type CommunicationResult = {
  final_output: FinalOutputContract;
  composedResponse: ComposedCaregiverResponse | null;
};

// ============================================================
// Full Pipeline Result
// ============================================================

export type PipelineResult = {
  extraction: ExtractionResult;
  understanding: UnderstandingResult;
  reasoning: ReasoningResult;
  communication: CommunicationResult;
  situationResponse: SituationResponse;
  activeSituation: ActiveCareSituation | null;
  activeTurn: ActiveSituationTurn | null;
  careRealityState: CareRealityState | null;
  continuityDecision: ContinuityDecision | null;
};

