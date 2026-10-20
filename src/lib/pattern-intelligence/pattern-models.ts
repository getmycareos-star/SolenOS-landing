/**
 * Enhanced Pattern Recognition Models for SolenOS
 * Implements longitudinal pattern recognition with strict separation
 * between repetition, pattern, and causation as per specification.
 */

import type { JourneyGraphEvent } from "../care-journey-graph/types";
import type { EvidenceRelation } from "../event-identity/contract-constants";

/**
 * Pattern Identity - unique identifier for a pattern
 */
export type PatternIdentity = {
  id: string; // Unique pattern ID
  version: number; // Version for tracking evolution
  created_at: string; // When pattern was first detected
  updated_at: string; // When pattern was last updated
};

/**
* Pattern Category - type of pattern being detected
*/
export type PatternCategory =
  | "frequency" // Same event repeatedly occurs
  | "duration" // Event repeatedly lasts for similar/changing duration
  | "recurrence" // Event returns after periods of absence
  | "contextual" // Event repeatedly appears alongside documented context
  | "routine" // Routine repeatedly deviates from baseline
  | "responsibility" // Same responsibility repeatedly fails
  | "appointment" // Continuity problem repeatedly affects appointments
  | "medication_continuity" // Medication continuity issue repeatedly appears
  | "caregiver_concern" // Same concern repeatedly raised
  | "outcome" // Similar outcomes follow similar actions/situations
  | "behavior" // Behavioral occurrence repeatedly observed
  | "symptom" // Symptom repeatedly reported
  | "routine_disruption" // Repeated deviation from routine;

/**
 * Pattern Status - lifecycle state of a pattern
 */
export type PatternStatus =
  | "candidate" // Detected enough evidence to suggest recurring pattern
  | "verified" // Caregiver reviewed and accepted the pattern
  | "rejected" // Caregiver determined observations should not be treated as one pattern
  | "uncertain" // Evidence suggestive but insufficient for pattern
  | "contradicted" // Evidence challenged by contradictory evidence;

/**
 * Pattern Confidence - confidence in the pattern relationship (not causation)
 */
export type PatternConfidence = "high" | "medium" | "low";

/**
 * Supporting Evidence - individual observation that supports the pattern
 */
export type SupportingEvidence = {
  event_id: string; // Reference to the care journey graph event
  date: string; // When the observation occurred
  description: string; // Original observation text
  source: string; // Source of observation (caregiver_note, document, etc.)
  source_type: string; // Type of source
  confidence: number; // Confidence in this observation (0-1)
  attributes: Record<string, unknown>; // Event attributes
  evidence_relation?: EvidenceRelation; // How this evidence relates to others in pattern
};

/**
 * Pattern Context - documented context surrounding the pattern
 */
export type PatternContext = {
  description: string; // Context description
  timing: string; // When context was documented
  source: string; // Source of context information
};

/**
 * Baseline Comparison - comparison against established baseline (if available)
 */
export type BaselineComparison = {
  has_baseline: boolean; // Whether a reliable baseline exists
  baseline_description?: string; // Description of baseline if available
  baseline_period?: string; // Period over which baseline was established
  deviation_measure?: number; // Quantitative measure of deviation from baseline
};

/**
 * Recurrence Characteristics - details about how the pattern recurs
 */
export type RecurrenceCharacteristics = {
  occurrence_count: number; // Number of independent occurrences
  first_occurrence: string; // Date of first occurrence
  last_occurrence: string; // Date of most recent occurrence
  occurrence_dates: string[]; // All occurrence dates
  average_interval_days?: number; // Average days between occurrences
  interval_variance?: number; // Variance in intervals
  clustering_score?: number; // Score indicating temporal clustering (0-1)
  persistence_score?: number; // Score indicating persistent vs temporary (0-1)
};

/**
 * Alternative Interpretations - other explanations that remain possible
 */
export type AlternativeInterpretation = {
  description: string; // Description of alternative interpretation
  supporting_evidence: string[]; // Event IDs supporting this interpretation
  confidence: number; // Confidence in this interpretation (0-1)
};

/**
 * Audit History - tracking changes to the pattern over time
 */
export type AuditEntry = {
  timestamp: string; // When the change occurred
  action: string; // What action was taken (created, updated, verified, etc.)
  actor: string; // Who took the action (caregiver_id, system)
  details: string; // Description of what changed
  previous_version?: number; // Previous version number if applicable
};

/**
 * Pattern Permissions - access control for the pattern
 */
export type PatternPermissions = {
  caregiver_id: string; // Owner caregiver
  accessible_by: string[]; // List of caregiver IDs who can access
  readonly: boolean; // Whether pattern is read-only for some users
};

/**
 * Enhanced Pattern - complete pattern representation per specification
 */
export type EnhancedPattern = {
  // Core identity
  identity: PatternIdentity;
  
  // Pattern classification
  category: PatternCategory;
  status: PatternStatus;
  
  // Evidence and observations
  supporting_evidence: SupportingEvidence[];
  occurrence_count: number;
  
  // Temporal analysis
  recurrence_characteristics: RecurrenceCharacteristics;
  
  // Context and baseline
  context?: PatternContext;
  baseline_comparison: BaselineComparison;
  
  // Confidence and uncertainty
  confidence: PatternConfidence;
  uncertainty: string; // Description of what we don't know
  
  // Alternative explanations (per specification point 37)
  alternative_interpretations: AlternativeInterpretation[];
  
  // Causation status - MUST remain "not established" per specification
  causation_status: "not established";
  
  // Verification and user interaction
  verification_status: PatternStatus; // Current verification state
  user_response: {
    confirmed: boolean;
    rejected: boolean;
    not_sure: boolean;
    corrections_made: boolean;
    context_added: boolean;
    last_verification_date: string | null;
  };
  
  // Connections to other systems (per specification points 29-35)
  related_open_loop_ids: string[]; // IDs of related open loops
  related_decision_ids: string[]; // IDs of related decisions
  related_outcome_ids: string[]; // IDs of related outcomes
  
  // Provenance and metadata
  provenance: string; // Description of how pattern was derived
  permissions: PatternPermissions;
  
  // Audit trail
  audit_history: AuditEntry[];
  
  // Human-readable labels (for UI)
  label: string; // Short human-readable label
  description: string; // Detailed human-readable description
};

/**
 * Pattern Detection Result - output from pattern detection algorithms
 */
export type PatternDetectionResult = {
  patterns: EnhancedPattern[];
  analysis_timestamp: string;
  events_analyzed: number;
  caregiver_id: string;
};

/**
 * Pattern Verification Input - input from caregiver verification
 */
export type PatternVerificationInput = {
  pattern_id: string;
  action: "confirm" | "reject" | "not_sure" | "correct" | "add_context";
  corrections?: {
    event_ids?: string[]; // Corrected event IDs
    dates?: Record<string, string>; // Event ID -> corrected date
    context?: string; // Added context
    interpretation?: string; // Corrected interpretation
  };
  caregiver_id: string;
  timestamp: string;
};

/**
 * Pattern Threshold Criteria - configurable thresholds for pattern detection
 */
export type PatternThresholdCriteria = {
  min_occurrences: number; // Minimum independent occurrences
  min_confidence: number; // Minimum confidence score (0-1)
  consistency_threshold: number; // Minimum consistency score (0-1)
  source_diversity_min: number; // Minimum number of different sources
  temporal_distribution_weight: number; // Weight for temporal distribution factor
  baseline_required: boolean; // Whether baseline is required for pattern
  max_duplicate_risk: number; // Maximum allowed duplicate evidence risk (0-1)
};

/**
 * Pattern Category Specific Configuration
 */
export type PatternCategoryConfig = Partial<Record<PatternCategory, PatternThresholdCriteria>>;