/**
 * Contradiction Materialization — Convert detected contradictions into 
 * actionable clarification questions and caregiver-facing unknowns.
 * 
 * Bridges: contradiction-detection-engine → input-classification → reasoning
 * 
 * Principle: Every contradiction must surface as a question the caregiver
 * can answer, not as hidden system state.
 */

import type { OpenContradiction, TransitionEvent, ContradictionDetectionResult } from "../contradiction-detection-engine";
import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ExplicitUnknown } from "../continuity-properties";

export type MaterializedContradiction = {
  contradiction_id: string;
  original_contradiction: OpenContradiction;
  /** What the caregiver needs to clarify */
  clarification_question: string;
  /** Why this matters for care */
  reason_it_matters: string;
  /** Priority for resolution */
  priority: "critical" | "high" | "medium" | "low";
  /** Suggested sources to resolve */
  suggested_sources: ("caregiver_observation" | "clinical_document" | "provider_conversation" | "family_member")[];
  /** Events involved */
  event_ids: string[];
  /** Current state if known */
  current_state?: string;
  /** Previous state if known */
  previous_state?: string;
  /** Safety implication */
  affects_safety: boolean;
  /** Can this wait or needs immediate attention */
  urgency: "immediate" | "soon" | "routine";
};

export type ContradictionMaterializationResult = {
  /** Materialized contradictions ready for caregiver clarification */
  materialized: MaterializedContradiction[];
  /** Converted to explicit unknowns for continuity tracking */
  as_explicit_unknowns: ExplicitUnknown[];
  /** Input classification behavior profile adjustments */
  behavior_profile_hints: {
    escalation_sensitivity?: "aggressive" | "balanced" | "conservative";
    uncertainty_strictness?: "permissive" | "moderate" | "rigorous";
    prioritization_aggressiveness?: "bold" | "balanced" | "cautious";
  };
  /** Summary for reasoning layer */
  reasoning_summary: string;
  /** Count by priority */
  counts_by_priority: Record<string, number>;
};

/**
 * Generate a caregiver-facing clarification question from a contradiction
 */
function generateClarificationQuestion(
  contradiction: OpenContradiction,
  events: CanonicalCareEvent[],
  transitions: TransitionEvent[]
): string {
  const relevantEvents = events.filter(e => contradiction.event_ids.includes(e.id));
  const relevantTransitions = transitions.filter(t => contradiction.event_ids.includes(t.linked_events[0]));
  
  if (relevantTransitions.length > 0) {
    const t = relevantTransitions[0];
    return `Earlier you mentioned "${t.from_state}" but now it seems "${t.to_state}". Which is more accurate right now?`;
  }
  
  if (relevantEvents.length >= 2) {
    const e1 = relevantEvents[0];
    const e2 = relevantEvents[1];
    return `You previously noted "${e1.raw_input.slice(0, 80)}" but the new information suggests "${e2.raw_input.slice(0, 80)}". Can you help clarify?`;
  }
  
  return `There appears to be a discrepancy in ${contradiction.field}: ${contradiction.shared_message}. What's the current situation?`;
}

/**
 * Determine why this contradiction matters for care
 */
function generateReasonItMatters(
  contradiction: OpenContradiction,
  transitions: TransitionEvent[]
): string {
  if (contradiction.affects_safety) {
    return "This affects safety decisions and care planning.";
  }
  
  const relevantTransitions = transitions.filter(t => contradiction.event_ids.includes(t.linked_events[0]));
  if (relevantTransitions.length > 0) {
    const t = relevantTransitions[0];
    if (t.type === "decline") {
      return "A decline in function may need medical attention or care adjustment.";
    }
    if (t.type === "improvement") {
      return "An improvement may mean we can reduce support or adjust the plan.";
    }
    if (t.type === "fluctuation") {
      return "Fluctuating symptoms need tracking to understand the pattern.";
    }
  }
  
  return "Understanding this helps us track the right things and avoid confusion.";
}

/**
 * Determine priority based on contradiction properties
 */
function determinePriority(
  contradiction: OpenContradiction,
  transitions: TransitionEvent[]
): "critical" | "high" | "medium" | "low" {
  if (contradiction.affects_safety) return "critical";
  
  const relevantTransitions = transitions.filter(t => contradiction.event_ids.includes(t.linked_events[0]));
  if (relevantTransitions.some(t => t.confidence > 0.8 && t.type === "decline")) return "high";
  if (relevantTransitions.some(t => t.confidence > 0.8 && t.type === "improvement")) return "medium";
  if (relevantTransitions.some(t => t.type === "fluctuation")) return "high";
  
  return "medium";
}

/**
 * Determine urgency for resolution
 */
function determineUrgency(
  contradiction: OpenContradiction,
  priority: "critical" | "high" | "medium" | "low"
): "immediate" | "soon" | "routine" {
  if (contradiction.affects_safety) return "immediate";
  if (priority === "critical") return "immediate";
  if (priority === "high") return "soon";
  return "routine";
}

/**
 * Suggest sources to resolve the contradiction
 */
function suggestSources(
  contradiction: OpenContradiction,
  events: CanonicalCareEvent[]
): ("caregiver_observation" | "clinical_document" | "provider_conversation" | "family_member")[] {
  const sources = new Set<"caregiver_observation" | "clinical_document" | "provider_conversation" | "family_member">();
  
  // Check existing event sources
  const relevantEvents = events.filter(e => contradiction.event_ids.includes(e.id));
  for (const event of relevantEvents) {
    if (event.source === "document") sources.add("clinical_document");
    else if (event.source === "user_input") sources.add("caregiver_observation");
  }
  
  // Always suggest caregiver observation as primary
  sources.add("caregiver_observation");
  
  // For safety-critical, suggest provider conversation
  if (contradiction.affects_safety) {
    sources.add("provider_conversation");
  }
  
  // For mobility/cognition changes, clinical document helps
  if (contradiction.field.includes("mobility") || 
      contradiction.field.includes("cognition") ||
      contradiction.field.includes("medication")) {
    sources.add("clinical_document");
  }
  
  return Array.from(sources);
}

/**
 * Convert materialized contradiction to explicit unknown for continuity tracking
 */
function toExplicitUnknown(
  materialized: MaterializedContradiction,
  careRecipientId: string
): ExplicitUnknown {
  return {
    missing_information: materialized.clarification_question,
    priority: materialized.priority,
    reason_it_matters: materialized.reason_it_matters,
    could_be_answered_by: materialized.suggested_sources,
    related_events: materialized.event_ids,
    status: "open",
    first_detected_at: new Date().toISOString(),
    last_reviewed_at: new Date().toISOString(),
  };
}

/**
 * Generate behavior profile hints for input classification
 */
function generateBehaviorProfileHints(
  materialized: MaterializedContradiction[]
): ContradictionMaterializationResult["behavior_profile_hints"] {
  const criticalCount = materialized.filter(m => m.priority === "critical").length;
  const highCount = materialized.filter(m => m.priority === "high").length;
  const safetyCount = materialized.filter(m => m.affects_safety).length;
  
  if (safetyCount > 0 || criticalCount > 0) {
    return {
      escalation_sensitivity: "aggressive",
      uncertainty_strictness: "rigorous",
      prioritization_aggressiveness: "bold",
    };
  }
  
  if (highCount > 1) {
    return {
      escalation_sensitivity: "balanced",
      uncertainty_strictness: "moderate",
      prioritization_aggressiveness: "balanced",
    };
  }
  
  return {
    escalation_sensitivity: "conservative",
    uncertainty_strictness: "permissive",
    prioritization_aggressiveness: "cautious",
  };
}

/**
 * Main function: Materialize contradictions from detection result
 */
export function materializeContradictions(params: {
  contradictionResult: ContradictionDetectionResult;
  events: CanonicalCareEvent[];
  careRecipientId: string;
  asOf: string;
}): ContradictionMaterializationResult {
  const { contradictionResult, events, careRecipientId, asOf } = params;
  
  if (!contradictionResult.active || contradictionResult.open_contradictions.length === 0) {
    return {
      materialized: [],
      as_explicit_unknowns: [],
      behavior_profile_hints: {},
      reasoning_summary: "No contradictions detected in current care reality.",
      counts_by_priority: { critical: 0, high: 0, medium: 0, low: 0 },
    };
  }
  
  const materialized: MaterializedContradiction[] = contradictionResult.open_contradictions
    .map(contradiction => {
      const clarification_question = generateClarificationQuestion(contradiction, events, contradictionResult.transitions);
      const reason_it_matters = generateReasonItMatters(contradiction, contradictionResult.transitions);
      const priority = determinePriority(contradiction, contradictionResult.transitions);
      const urgency = determineUrgency(contradiction, priority);
      const suggested_sources = suggestSources(contradiction, events);
      
      // Find current/previous states from transitions
      const relevantTransitions = contradictionResult.transitions.filter(t => 
        contradiction.event_ids.includes(t.linked_events[0])
      );
      const current_state = relevantTransitions[0]?.to_state;
      const previous_state = relevantTransitions[0]?.from_state;
      
      return {
        contradiction_id: contradiction.contradiction_id,
        original_contradiction: contradiction,
        clarification_question,
        reason_it_matters,
        priority,
        suggested_sources,
        event_ids: contradiction.event_ids,
        current_state,
        previous_state,
        affects_safety: contradiction.affects_safety,
        urgency,
      };
    })
    // Sort by priority and urgency
    .sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const urgencyOrder = { immediate: 0, soon: 1, routine: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
  
  const as_explicit_unknowns = materialized.map(m => toExplicitUnknown(m, careRecipientId));
  const behavior_profile_hints = generateBehaviorProfileHints(materialized);
  
  const counts_by_priority = {
    critical: materialized.filter(m => m.priority === "critical").length,
    high: materialized.filter(m => m.priority === "high").length,
    medium: materialized.filter(m => m.priority === "medium").length,
    low: materialized.filter(m => m.priority === "low").length,
  };
  
  const reasoning_summary = materialized.length === 1
    ? `1 contradiction materialized for clarification: ${materialized[0].clarification_question}`
    : `${materialized.length} contradictions materialized. Top priority: ${materialized[0]?.clarification_question ?? "none"}`;
  
  return {
    materialized,
    as_explicit_unknowns,
    behavior_profile_hints,
    reasoning_summary,
    counts_by_priority,
  };
}

/**
 * Get clarification questions for immediate caregiver prompt
 * Returns max 2 questions (per communication framework)
 */
export function getClarificationQuestionsForCaregiver(
  materialized: MaterializedContradiction[],
  max: number = 2
): string[] {
  return materialized
    .filter(m => m.urgency === "immediate" || m.priority === "critical" || m.priority === "high")
    .slice(0, max)
    .map(m => m.clarification_question);
}

/**
 * Check if any contradictions require immediate safety attention
 */
export function hasSafetyCriticalContradictions(
  materialized: MaterializedContradiction[]
): boolean {
  return materialized.some(m => m.affects_safety && m.urgency === "immediate");
}