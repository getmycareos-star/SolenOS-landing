/**
 * Care Attention Model — Canonical representation for a Care Attention Item.
 * 
 * Per Specification Chapter 11: "WHAT MATTERS?" — THE CARE ATTENTION LAYER
 * 
 * It must not become an independent competing truth system.
 * Conceptually, an attention item should reference canonical evidence/entities 
 * rather than copying their substantive content.
 */

import type { CareContext } from "../care-context/types";
import type { OpenLoop } from "../open-loop-manager/types";
import type { CanonicalCareEvent } from "../../situation-entry/types";
import type { DecisionMemoryEntry } from "../decision-memory/index";
import type { OutcomeMeasurementResult } from "../oml/types";

/**
 * Identity of the attention item.
 */
export interface AttentionItemIdentity {
  /** Unique identifier for this attention item */
  id: string;
  /** Version for tracking changes */
  version: number;
  /** When this attention item was created */
  created_at: string;
  /** When this attention item was last updated */
  updated_at: string;
}

/**
 * Source/provenance information.
 */
export interface AttentionProvenance {
  /** How this attention item was generated/detected */
  source: 'ai_generated' | 'user_marked' | 'system_detected';
  /** Additional metadata about the source */
  metadata?: Record<string, unknown>;
  /** Validation/correction history */
  validationHistory?: AttentionValidation[];
}

/**
 * Validation/correction history for caregiver verification.
 */
export interface AttentionValidation {
  /** Who validated/corrected this item */
  validator_id: string;
  /** When validation occurred */
  validated_at: string;
  /** What action was taken */
  action: 'confirmed' | 'rejected' | 'reclassified' | 'marked_important' | 
          'marked_informational' | 'marked_resolved' | 'marked_awaiting_confirmation' |
          'marked_low_priority' | 'identified_professional_followup' | 'identified_can_wait';
  /** Previous state before validation */
  previous_state: Partial<AttentionItem>;
  /** Reason for validation/correction */
  reason: string;
}

/**
 * Care Attention States (separate from User Importance as per spec).
 */
export type AttentionState = 
  | 'NEEDS_ATTENTION'
  | 'AWAITING_CONFIRMATION'
  | 'PROFESSIONAL_FOLLOW_UP'
  | 'CAN_WAIT'
  | 'RESOLVED'
  | 'INFORMATIONAL'
  | 'UNKNOWN';

/**
 * User Importance (separate dimension from Attention State).
 */
export type UserImportance = 
  | 'IMPORTANT'
  | 'INFORMATIONAL'
  | 'LOW_PRIORITY';

/**
 * Resolution state for tracking history.
 */
export type ResolutionState = 
  | 'UNRESOLVED'
  | 'RESOLVED_BY_EVIDENCE'
  | 'RESOLVED_BY_USER'
  | 'REOPENED';

/**
 * Canonical reference to related care objects.
 * Rather than duplicating data, we reference the canonical objects.
 */
export interface AttentionRelatedObjects {
  /** Related CareContext state */
  careContext?: string; // Reference to CareContext ID
  /** Related change that triggered attention */
  relatedChange?: string; // Reference to ChangeRecord ID
  /** Related Open Loop */
  openLoop?: string; // Reference to OpenLoop ID
  /** Related appointment */
  appointment?: string; // Reference to care event ID
  /** Related responsibility */
  responsibility?: string; // Reference to responsibility ID
  /** Related observation */
  observation?: string; // Reference to care event ID
  /** Related medication */
  medication?: string; // Reference to medication ID
  /** Related decision */
  decision?: string; // Reference to DecisionMemoryEntry ID
  /** Related outcome */
  outcome?: string; // Reference to OutcomeMeasurementResult ID
  /** Related professional interaction */
  professionalInteraction?: string; // Reference to care event ID
}

/**
 * Main Care Attention Item - the canonical representation.
 */
export interface AttentionItem extends AttentionItemIdentity {
  /** Why this item deserves attention - evidence-based reason */
  attentionReason: string;
  /** Current attention state (system-determined) */
  attentionState: AttentionState;
  /** User-assigned importance (separate dimension) */
  userImportance: UserImportance;
  /** Current status of the underlying issue */
  currentStatus: string;
  /** What remains unknown/uncertain */
  uncertainty: string[];
  /** Supporting evidence (references to canonical objects) */
  evidence: string[]; // Array of care event IDs or other canonical references
  /** Related canonical objects */
  relatedObjects: AttentionRelatedObjects;
  /** Provenance and source information */
  provenance: AttentionProvenance;
  /** Priority level (higher = more urgent) */
  priority: number;
  /** Dependencies that affect this attention item */
  dependencies: string[]; // IDs of other attention items this depends on
  /** Resolution state */
  resolutionState: ResolutionState;
  /** When this item became relevant/effective */
  effectiveDate?: string;
  /** When this item should be re-evaluated */
  reviewDate?: string;
  /** Confirmation state */
  confirmationState: 'CONFIRMED' | 'UNCONFIRMED' | 'CONFLICTING';
  /** Professional follow-up state */
  professionalFollowupState: 'NONE' | 'PENDING' | 'SCHEDULED' | 'COMPLETED';
  /** Audit history */
  auditHistory: AttentionAuditEntry[];
}

/**
 * Audit entry for tracking changes to attention items.
 */
export interface AttentionAuditEntry {
  /** When the change occurred */
  timestamp: string;
  /** What changed */
  changes: Partial<AttentionItem>;
  /** Who made the change (user or system) */
  changedBy: string;
  /** Reason for the change */
  reason: string;
}

/**
 * Input for creating a new attention item.
 */
export interface CreateAttentionItemInput {
  /** Why this item deserves attention */
  attentionReason: string;
  /** Related canonical objects */
  relatedObjects: AttentionRelatedObjects;
  /** Supporting evidence */
  evidence: string[];
  /** Initial priority */
  priority?: number;
  /** Initial attention state */
  attentionState?: AttentionState;
  /** Initial user importance */
  userImportance?: UserImportance;
  /** Provenance/source information */
  provenance?: AttentionProvenance;
}

/**
 * Input for updating an attention item.
 */
export interface UpdateAttentionItemInput {
  /** Why this item deserves attention */
  attentionReason?: string;
  /** Current attention state */
  attentionState?: AttentionState;
  /** User-assigned importance */
  userImportance?: UserImportance;
  /** Current status */
  currentStatus?: string;
  /** What remains unknown */
  uncertainty?: string[];
  /** Supporting evidence */
  evidence?: string[];
  /** Related objects */
  relatedObjects?: AttentionRelatedObjects;
  /** Priority level */
  priority?: number;
  /** Dependencies */
  dependencies?: string[];
  /** Resolution state */
  resolutionState?: ResolutionState;
  /** Effective date */
  effectiveDate?: string;
  /** Review date */
  reviewDate?: string;
  /** Confirmation state */
  confirmationState?: 'CONFIRMED' | 'UNCONFIRMED' | 'CONFLICTING';
  /** Professional follow-up state */
  professionalFollowupState?: 'NONE' | 'PENDING' | 'SCHEDULED' | 'COMPLETED';
}

/**
 * Result of attention item operations.
 */
export interface AttentionItemResult {
  /** The attention item */
  item: AttentionItem;
  /** Whether the operation was successful */
  success: boolean;
  /** Error message if unsuccessful */
  error?: string;
}

/**
 * Response for fetching multiple attention items with grouping.
 */
export interface AttentionItemsResponse {
  /** Items that need immediate attention */
  needsAttention: AttentionItem[];
  /** Items awaiting confirmation */
  awaitingConfirmation: AttentionItem[];
  /** Items requiring professional follow-up */
  professionalFollowUp: AttentionItem[];
  /** Upcoming items */
  upcoming: AttentionItem[];
  /** Important context items (user-marked important but not urgent) */
  importantContext: AttentionItem[];
  /** Can wait / low priority items */
  canWait: AttentionItem[];
  /** Unknowns */
  unknowns: AttentionItem[];
  /** Conflicts */
  conflicts: AttentionItem[];
  /** Recent changes */
  recentChanges: AttentionItem[];
}