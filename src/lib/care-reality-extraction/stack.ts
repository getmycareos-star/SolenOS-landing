/**
 * Care Reality extraction stack — Observation → Event → Decision → Relationship → Response Contract.
 * Unknown is the knowledge-boundary layer that runs alongside — never fill gaps.
 *
 * SoT: docs/02-product/solenos-*-extraction.md · solenos-response-contract.md
 * Doc examples are illustrations only — never product if-branches.
 */

import { DECISION_EXTRACTION_ASK } from "./decisions";
import { RELATIONSHIP_EXTRACTION_ASK } from "./relationships";
import { UNKNOWN_EXTRACTION_ASK } from "./unknowns";

export const EXTRACTION_STACK_PIPELINE = [
  "observation",
  "event",
  "decision",
  "relationship",
  "response_contract",
] as const;

export type ExtractionStackStage = (typeof EXTRACTION_STACK_PIPELINE)[number];

/** Core asks — Relationship is fourth; Unknown preserves knowledge boundaries throughout. */
export const EXTRACTION_STACK_ASKS = {
  observation: "What was directly witnessed about the person receiving care?",
  event: "What happened, when, who was involved?",
  decision: DECISION_EXTRACTION_ASK,
  relationship: RELATIONSHIP_EXTRACTION_ASK,
  unknown: UNKNOWN_EXTRACTION_ASK,
} as const;

export const EXTRACTION_STACK_PURPOSE =
  "Observation → Event → Decision → Relationship → Response Contract — with Unknown preserving what is not known (never fill gaps).";
