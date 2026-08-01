/**
 * Open Loop Manager — types.
 *
 * Open loops are unresolved care threads that require follow-up:
 * unanswered questions, pending decisions, things being monitored,
 * and topics to revisit.
 *
 * The Open Loop Manager tracks, resolves, and archives these loops
 * to prevent fragmentation and ensure nothing is forgotten.
 */

/**
 * Loop status lifecycle:
 *   open → (resolved | reconnected | archived)
 */
export type OpenLoopStatus = "open" | "resolved" | "reconnected" | "archived";

/**
 * Category of open loop — why it was created.
 */
export type OpenLoopCategory =
  | "unanswered_question"
  | "pending_decision"
  | "monitoring_item"
  | "revisit_topic"
  | "continuity_hook"
  | "unresolved_uncertainty";

/**
 * An open loop — a thread that needs follow-up attention.
 */
export type OpenLoop = {
  id: string;
  category: OpenLoopCategory;
  /** Human-readable description of the loop */
  description: string;
  /** When the loop was created */
  created_at: string;
  /** When the loop was last updated */
  updated_at: string;
  /** Current status */
  status: OpenLoopStatus;
  /** Priority: higher = more urgent */
  priority: number;
  /** Caregiver id who owns this loop */
  caregiver_id: string;
  /** Care recipient id this loop is about */
  care_recipient_id: string;
  /** Source event id that created this loop */
  source_event_id: string | null;
  /** Event id that resolved this loop */
  resolved_by_event_id: string | null;
  /** How the loop was resolved */
  resolution: string | null;
  /** Tags for categorization */
  tags: string[];
};

/**
 * Input for tracking a new open loop.
 */
export type TrackOpenLoopInput = {
  category: OpenLoopCategory;
  description: string;
  caregiver_id: string;
  care_recipient_id: string;
  source_event_id?: string | null;
  priority?: number;
  tags?: string[];
};

/**
 * Input for resolving an open loop.
 */
export type ResolveOpenLoopInput = {
  loop_id: string;
  resolved_by_event_id: string;
  resolution: string;
};

/**
 * Input for reconnecting an open loop (re-opening after resolution).
 */
export type ReconnectOpenLoopInput = {
  loop_id: string;
  source_event_id: string;
  reason: string;
};

/**
 * Result of an open loop operation.
 */
export type OpenLoopManagerResult = {
  active: boolean;
  open_loops: OpenLoop[];
  resolved_loops: OpenLoop[];
  reconnected_loops: OpenLoop[];
  archived_loops: OpenLoop[];
  total_count: number;
  open_count: number;
  resolved_count: number;
  reconnection_detected: boolean;
  reconnection_details: string | null;
};
