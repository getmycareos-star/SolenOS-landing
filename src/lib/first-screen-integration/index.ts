/**
 * First-Screen Integration — Phase 3 TODO
 * 
 * Surfaces the four first-screen answers from structured data in the Living Care Record projection:
 * 1. What changed?
 * 2. What needs attention?
 * 3. What should we prepare for?
 * 4. What is missing?
 * 
 * Every statement traceable to evidence; expose confidence internally.
 */

import type { CanonicalCareEvent, CareContextRoot } from "../situation-entry/types";
import type { ContinuityTruthSlice } from "../presentation-engine";
import type { LongitudinalReasoningOutput } from "../longitudinal-reasoning";
import type { AggregatedConfidence } from "../confidence-aggregation";
import { projectPresentation, projectCareMoment } from "../presentation-engine";
import { quickLongitudinalCheck } from "../longitudinal-reasoning";

export type FirstScreenInput = {
  /** Current care context */
  current_context: CareContextRoot;
  /** Prior care context */
  prior_context: CareContextRoot | null;
  /** New events from current interaction */
  events_created: CanonicalCareEvent[];
  /** Longitudinal reasoning output (optional) */
  longitudinal_reasoning?: LongitudinalReasoningOutput;
  /** Aggregated confidence */
  aggregated_confidence?: AggregatedConfidence;
  /** Presentation preference */
  presentation_preference?: { mode: "essential" | "standard" | "detailed" };
  /** Caregiver ID */
  caregiver_id: string;
  /** Care recipient ID */
  care_recipient_id: string;
  /** Timestamp */
  timestamp: string;
};

export type FirstScreenOutput = {
  /** 1. What changed? */
  what_changed: {
    items: string[];
    evidence: Array<{ claim: string; event_ids: string[]; confidence: number }>;
    confidence: number;
  };
  /** 2. What needs attention? */
  what_needs_attention: {
    items: string[];
    evidence: Array<{ claim: string; event_ids: string[]; confidence: number }>;
    urgency: "immediate" | "soon" | "routine";
    confidence: number;
  };
  /** 3. What should we prepare for? */
  what_to_prepare: {
    items: string[];
    evidence: Array<{ claim: string; event_ids: string[]; confidence: number }>;
    timeline: "today" | "this_week" | "this_month" | "ongoing";
    confidence: number;
  };
  /** 4. What is missing? */
  what_is_missing: {
    items: Array<{ question: string; reason_it_matters: string; priority: "critical" | "high" | "medium" | "low" }>;
    evidence: Array<{ claim: string; event_ids: string[]; confidence: number }>;
    confidence: number;
  };
  /** Presentation view */
  presentation_view: ReturnType<typeof projectPresentation>;
  /** Care moment view */
  care_moment_view: ReturnType<typeof projectCareMoment>;
  /** Metadata */
  metadata: {
    generated_at: string;
    overall_confidence: number;
    data_quality: "high" | "medium" | "low";
    source_events_count: number;
  };
};

/**
 * Build first-screen answers from structured data
 */
export function buildFirstScreenAnswers(input: FirstScreenInput): FirstScreenOutput {
  const {
    current_context,
    prior_context,
    events_created,
    longitudinal_reasoning,
    aggregated_confidence,
    presentation_preference,
    timestamp,
  } = input;
  
  // Use longitudinal reasoning if available, otherwise quick check
  let longitudinal = longitudinal_reasoning;
  if (!longitudinal) {
    const quick = quickLongitudinalCheck(prior_context, current_context, events_created);
    longitudinal = {
      care_state_changes: {
        generated_at: timestamp,
        has_meaningful_change: quick.has_meaningful_change,
        primary_changes: [],
        all_changes: [],
        compound_signals: [],
        attention_required: quick.attention_required,
        can_wait: !quick.attention_required,
        unresolved_questions: [],
        trajectory_summary: quick.trajectory,
      },
      contradiction_timeline: { merged_contradictions: [], contradiction_groups: [] },
      baseline_deviations: [],
      priority_reasoning: { explanationLines: [], confidenceCap: 0.7 } as any,
      aggregated_confidence: aggregated_confidence!,
      source_reliability: { weighted_events: [], reasoning_events: [], filtered_events: [], source_transparency: { by_source: {}, total_events: 0, reasoning_events_count: 0, filtered_count: 0 }, reliability_conflicts: [], overall_reliability: 0 },
      longitudinal_insights: {
        what_changed: quick.primary_changes,
        what_matters_now: [],
        what_is_stable: [],
        what_we_are_uncertain_about: quick.primary_changes.map(c => `Confirm: ${c}`),
        what_questions_reduce_uncertainty: [],
        trajectory_summary: quick.trajectory,
        attention_required: quick.attention_required,
        can_wait: !quick.attention_required,
      },
      presentation_view: projectPresentation(buildEmptyTruthSlice(), { mode: "essential" }),
      care_moment_view: projectCareMoment(buildEmptyTruthSlice()),
    } as LongitudinalReasoningOutput;
  }
  
  // Build truth slice for presentation
  const truth_slice = buildTruthSliceFromLongitudinal(longitudinal, events_created, timestamp);
  
  // 1. What changed?
  const what_changed = buildWhatChanged(longitudinal, events_created);
  
  // 2. What needs attention?
  const what_needs_attention = buildWhatNeedsAttention(longitudinal, events_created);
  
  // 3. What to prepare for?
  const what_to_prepare = buildWhatToPrepare(longitudinal, events_created, current_context);
  
  // 4. What is missing?
  const what_is_missing = buildWhatIsMissing(longitudinal, events_created);
  
  // Presentation views
  const presentation_view = projectPresentation(truth_slice, presentation_preference ?? { mode: "standard" });
  const care_moment_view = projectCareMoment(truth_slice);
  
  return {
    what_changed,
    what_needs_attention,
    what_to_prepare,
    what_is_missing,
    presentation_view,
    care_moment_view,
    metadata: {
      generated_at: timestamp,
      overall_confidence: aggregated_confidence?.overall ?? 0.5,
      data_quality: current_context.events.length > 10 ? "high" : current_context.events.length > 3 ? "medium" : "low",
      source_events_count: current_context.events.length,
    },
  };
}

/**
 * Build "What changed?" section
 */
function buildWhatChanged(
  longitudinal: LongitudinalReasoningOutput,
  events_created: CanonicalCareEvent[]
): FirstScreenOutput["what_changed"] {
  const items = longitudinal.longitudinal_insights.what_changed;
  const evidence = events_created.map(e => ({
    claim: `${e.extracted_type}: ${e.raw_input.slice(0, 100)}`,
    event_ids: [e.id],
    confidence: e.integrity?.field_confidence?.extracted_fact?.extraction ?? 0.7,
  }));
  
  const avg_confidence = evidence.length > 0
    ? evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length
    : 0.5;
  
  return {
    items: items.length > 0 ? items : ["No significant changes detected"],
    evidence,
    confidence: avg_confidence,
  };
}

/**
 * Build "What needs attention?" section
 */
function buildWhatNeedsAttention(
  longitudinal: LongitudinalReasoningOutput,
  events_created: CanonicalCareEvent[]
): FirstScreenOutput["what_needs_attention"] {
  const items = longitudinal.longitudinal_insights.what_matters_now;
  const evidence = events_created
    .filter(e => (e.integrity?.field_confidence?.extracted_fact?.extraction ?? 0) > 0.6)
    .map(e => ({
      claim: e.raw_input.slice(0, 100),
      event_ids: [e.id],
      confidence: e.integrity?.field_confidence?.extracted_fact?.extraction ?? 0.7,
    }));
  
  const avg_confidence = evidence.length > 0
    ? evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length
    : 0.5;
  
  // Determine urgency
  const has_immediate = items.some(i => 
    i.toLowerCase().includes("urgent") || 
    i.toLowerCase().includes("crisis") ||
    i.toLowerCase().includes("emergency") ||
    i.toLowerCase().includes("immediate")
  );
  const has_soon = items.some(i =>
    i.toLowerCase().includes("soon") ||
    i.toLowerCase().includes("follow") ||
    i.toLowerCase().includes("appointment")
  );
  
  const urgency = has_immediate ? "immediate" : has_soon ? "soon" : "routine";
  
  return {
    items: items.length > 0 ? items : ["No items needing immediate attention"],
    evidence,
    urgency,
    confidence: avg_confidence,
  };
}

/**
 * Build "What to prepare for?" section
 */
function buildWhatToPrepare(
  longitudinal: LongitudinalReasoningOutput,
  events_created: CanonicalCareEvent[],
  current_context: CareContextRoot
): FirstScreenOutput["what_to_prepare"] {
  // Look for appointments, follow-ups, deadlines in events
  const preparation_items: string[] = [];
  const evidence: Array<{ claim: string; event_ids: string[]; confidence: number }> = [];
  
  for (const event of current_context.events) {
    const text = event.raw_input.toLowerCase();
    if (text.includes("appointment") || text.includes("follow up") || text.includes("follow-up")) {
      preparation_items.push(`Prepare for appointment: ${event.raw_input.slice(0, 100)}`);
      evidence.push({
        claim: event.raw_input.slice(0, 100),
        event_ids: [event.id],
        confidence: event.integrity?.field_confidence?.extracted_fact?.extraction ?? 0.7,
      });
    }
    if (text.includes("deadline") || text.includes("by ") || text.includes("before ")) {
      preparation_items.push(`Deadline: ${event.raw_input.slice(0, 100)}`);
      evidence.push({
        claim: event.raw_input.slice(0, 100),
        event_ids: [event.id],
        confidence: event.integrity?.field_confidence?.extracted_fact?.extraction ?? 0.7,
      });
    }
    if (text.includes("refill") || text.includes("refill")) {
      preparation_items.push(`Refill medication: ${event.raw_input.slice(0, 100)}`);
      evidence.push({
        claim: event.raw_input.slice(0, 100),
        event_ids: [event.id],
        confidence: event.integrity?.field_confidence?.extracted_fact?.extraction ?? 0.7,
      });
    }
  }
  
  // Add from longitudinal insights
  for (const item of longitudinal.longitudinal_insights.what_questions_reduce_uncertainty) {
    preparation_items.push(`Clarify: ${item}`);
  }
  
  const avg_confidence = evidence.length > 0
    ? evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length
    : 0.5;
  
  // Determine timeline
  const timeline = preparation_items.some(i => i.toLowerCase().includes("today") || i.toLowerCase().includes("now"))
    ? "today"
    : preparation_items.some(i => i.toLowerCase().includes("week"))
      ? "this_week"
      : preparation_items.some(i => i.toLowerCase().includes("month"))
        ? "this_month"
        : "ongoing";
  
  return {
    items: preparation_items.length > 0 ? preparation_items.slice(0, 4) : ["No upcoming items to prepare for"],
    evidence,
    timeline,
    confidence: avg_confidence,
  };
}

/**
 * Build "What is missing?" section
 */
function buildWhatIsMissing(
  longitudinal: LongitudinalReasoningOutput,
  events_created: CanonicalCareEvent[]
): FirstScreenOutput["what_is_missing"] {
  const items = longitudinal.longitudinal_insights.what_we_are_uncertain_about.map(q => ({
    question: q,
    reason_it_matters: "Resolving this reduces uncertainty in care understanding",
    priority: "high" as const,
  }));
  
  // Add from compound signals
  for (const signal of longitudinal.care_state_changes.compound_signals) {
    if (signal.attention_required) {
      items.push({
        question: signal.description,
        reason_it_matters: "Multiple domains changing simultaneously requires attention",
        priority: "critical" as const,
      });
    }
  }
  
  // Add from unresolved questions
  for (const question of longitudinal.care_state_changes.unresolved_questions) {
    items.push({
      question,
      reason_it_matters: "Needed for complete care understanding",
      priority: "high" as const,
    });
  }
  
  // Deduplicate
  const unique = new Map<string, typeof items[0]>();
  for (const item of items) {
    const key = item.question.toLowerCase().slice(0, 100);
    if (!unique.has(key)) unique.set(key, item);
  }
  
  const final_items = Array.from(unique.values()).slice(0, 5);
  
  // Evidence for missing items - events that triggered the uncertainty
  const evidence = events_created
    .filter(e => (e.integrity?.field_confidence?.extracted_fact?.extraction ?? 0) < 0.7)
    .map(e => ({
      claim: `Uncertain: ${e.raw_input.slice(0, 100)}`,
      event_ids: [e.id],
      confidence: 1 - (e.integrity?.field_confidence?.extracted_fact?.extraction ?? 0.7),
    }));
  
  const avg_confidence = evidence.length > 0
    ? evidence.reduce((sum, e) => sum + e.confidence, 0) / evidence.length
    : 0.5;
  
  return {
    items: final_items.length > 0 ? final_items : [
      { question: "No critical gaps identified", reason_it_matters: "Understanding is complete for now", priority: "low" as const }
    ],
    evidence,
    confidence: avg_confidence,
  };
}

/**
 * Build truth slice from longitudinal output
 */
function buildTruthSliceFromLongitudinal(
  longitudinal: LongitudinalReasoningOutput,
  events_created: CanonicalCareEvent[],
  timestamp: string
): ContinuityTruthSlice {
  return {
    what_changed: longitudinal.longitudinal_insights.what_changed,
    what_is_happening: longitudinal.longitudinal_insights.what_matters_now,
    what_needs_attention: longitudinal.longitudinal_insights.what_matters_now,
    what_is_stable: longitudinal.longitudinal_insights.what_is_stable,
    known: events_created
      .filter(e => (e.integrity?.field_confidence?.extracted_fact?.extraction ?? 0) > 0.7)
      .map(e => e.raw_input.slice(0, 100)),
    inferred: longitudinal.longitudinal_insights.what_matters_now,
    explicit_unknowns: longitudinal.longitudinal_insights.what_we_are_uncertain_about.map(q => ({
      missing_information: q,
      priority: "high" as const,
      reason_it_matters: "Reduces uncertainty in care understanding",
    })),
    confidence_notes: [
      `Overall confidence: ${Math.round(longitudinal.aggregated_confidence.overall * 100)}% (${longitudinal.aggregated_confidence.label})`,
      `Trajectory: ${longitudinal.care_state_changes.trajectory_summary}`,
    ],
    evidence_summaries: longitudinal.source_reliability.weighted_events
      .filter(w => w.include_in_reasoning)
      .slice(0, 3)
      .map(w => `${w.source_reliability.source_type}: ${w.event.raw_input.slice(0, 80)}`),
    reasoning_summary: longitudinal.care_state_changes.trajectory_summary,
    baseline_comparison: longitudinal.baseline_deviations.map(d => ({
      domain: d.domain,
      baseline_statement: d.baseline_statement,
      current_observation: d.current_observation,
      deviation_type: d.deviation_type,
      confidence: d.confidence,
    })),
  };
}

function buildEmptyTruthSlice(): ContinuityTruthSlice {
  return {
    what_changed: [],
    what_is_happening: [],
    what_needs_attention: [],
    what_is_stable: [],
    known: [],
    inferred: [],
    explicit_unknowns: [],
    confidence_notes: [],
    evidence_summaries: [],
  };
}

/**
 * Quick first-screen check without full longitudinal reasoning
 */
export function quickFirstScreen(
  prior: CareContextRoot | null,
  current: CareContextRoot,
  newEvents: CanonicalCareEvent[],
  timestamp: string
): FirstScreenOutput {
  const quick = quickLongitudinalCheck(prior, current, newEvents);
  
  const truth_slice: ContinuityTruthSlice = {
    what_changed: quick.primary_changes,
    what_is_happening: [],
    what_needs_attention: quick.primary_changes,
    what_is_stable: [],
    known: [],
    inferred: [],
    explicit_unknowns: [],
    confidence_notes: [`Trajectory: ${quick.trajectory}`],
    evidence_summaries: [],
  };
  
  return {
    what_changed: {
      items: quick.primary_changes.length > 0 ? quick.primary_changes : ["No significant changes"],
      evidence: newEvents.map(e => ({
        claim: e.raw_input.slice(0, 100),
        event_ids: [e.id],
        confidence: e.integrity?.field_confidence?.extracted_fact?.extraction ?? 0.7,
      })),
      confidence: 0.7,
    },
    what_needs_attention: {
      items: quick.primary_changes.length > 0 ? quick.primary_changes : ["No items needing attention"],
      evidence: [],
      urgency: quick.attention_required ? "immediate" : "routine",
      confidence: 0.7,
    },
    what_to_prepare: {
      items: ["No upcoming items to prepare for"],
      evidence: [],
      timeline: "ongoing",
      confidence: 0.5,
    },
    what_is_missing: {
      items: [{ question: "No critical gaps identified", reason_it_matters: "Understanding is complete", priority: "low" }],
      evidence: [],
      confidence: 0.5,
    },
    presentation_view: projectPresentation(truth_slice, { mode: "essential" }),
    care_moment_view: projectCareMoment(truth_slice),
    metadata: {
      generated_at: timestamp,
      overall_confidence: 0.7,
      data_quality: current.events.length > 10 ? "high" : "medium",
      source_events_count: current.events.length,
    },
  };
}