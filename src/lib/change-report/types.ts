/**
 * Change Report — structured composition of what changed, why it may matter,
 * and what the caregiver should consider next.
 *
 * Dementia Wedge Core Intelligence:
 * "Transform weeks of behavior into a decision-ready understanding."
 *
 * This module does NOT diagnose, predict, or recommend medical action.
 * It surfaces context and questions — never conclusions or causal claims.
 */
import type { BaselineComparisonResult, BaselineState } from "../care-reality-intelligence/baseline-comparison-engine";
import type { CareRealityState } from "../care-reality-state/types";
import type { CareRealityMemoryObject } from "../care-reality-intelligence/care-reality-memory";

/**
 * A single piece of relevant timeline context.
 */
export type ChangeReportTimelineItem = {
  date: string;
  description: string;
  type: "observation" | "event" | "decision";
  domain?: string;
};

/**
 * A possible non-causal connection between events.
 * Never asserts causation — only temporal or contextual proximity.
 */
export type PossibleContextLink = {
  observation: string;
  related_to: string;
  connection: "temporal_proximity" | "same_domain" | "recurring_pattern";
};

/**
 * The Change Report — structured understanding of a reported change.
 *
 * Core product thesis:
 * "Transform weeks of behavior into a decision-ready understanding."
 *
 * Not: "Store dementia information."
 * Caregivers do not need another place to store notes.
 * They need help understanding:
 * - What changed?
 * - Why might it matter?
 * - What information is important?
 * - What decision needs to happen next?
 */
export type ChangeReport = {
  /** What the caregiver reported as different (raw input) */
  reported_change: string;
  /** The named care recipient */
  care_recipient: string | null;
  /** What changed, extracted from baseline comparison + input analysis */
  what_changed: string[];
  /** What was normal before (baseline context) */
  prior_baseline: string[];
  /** Relevant timeline of events leading up to and including the change */
  relevant_timeline: ChangeReportTimelineItem[];
  /** Related history from memory (same domain, previous occurrences) */
  related_history: string[];
  /** Whether this pattern has happened before */
  is_recurring_pattern: boolean;
  /** How many times this pattern has been observed */
  recurrence_count: number;
  /** Non-causal possible context links */
  possible_context: PossibleContextLink[];
  /** Open uncertainties related to this change */
  open_uncertainties: string[];
  /** Questions worth discussing with a clinician */
  questions_for_clinician: string[];
  /** What the caregiver should watch for next */
  what_to_watch_for: string[];
  /** Suggested next steps (not medical advice — care coordination) */
  suggested_next_steps: string[];
  /** Information worth sharing with other caregivers or family */
  information_for_caregivers: string[];
  /** Decision readiness — what decisions might be needed */
  decision_context: string[];
  /** Confidence in the report's assessments */
  confidence: "low" | "medium" | "high";
  /** When this report was generated */
  generated_at: string;
};

/**
 * Input context needed to build a Change Report.
 */
export type ChangeReportInput = {
  /** The raw caregiver input describing the change */
  raw_input: string;
  /** Current Care Reality State */
  crs: CareRealityState | null;
  /** Care reality memory objects */
  memory_objects: CareRealityMemoryObject[];
  /** Baseline comparison result (if available) */
  baseline: BaselineComparisonResult | null;
  /** Subject label for the care recipient */
  care_recipient_label: string | null;
  /** Care recipient durable id */
  care_recipient_id: string;
};

