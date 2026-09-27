/**
 * Extended Capabilities — Scalable Clinical Profiles + Multi-caregiver + Long-thread + Emotional inputs + Done-for-now
 * 
 * Implements the remaining capabilities from the roadmap:
 * - Scalable Clinical Profiles: Condition-specific reasoning templates
 * - Multi-caregiver: Family group context and shared care reality
 * - Long-thread: Extended conversation continuity
 * - Emotional inputs: Caregiver state signals (not emotional support)
 * - Done-for-now: Item resolution tracking
 */

import type { CanonicalCareEvent, CareContextRoot } from "../situation-entry/types";
import type { ContinuityTruthSlice } from "../presentation-engine";
import type { AggregatedConfidence } from "../confidence-aggregation";
import { extractHumanContextFromEvents, getRelevantHumanContext, HumanContextInsight } from "../future-capabilities/human-context";
import { projectPresentation } from "../presentation-engine";

/* ============================================================
 * 1. SCALABLE CLINICAL PROFILES
 * ============================================================ */

export type ClinicalProfileType = 
  | "dementia_alzheimers"
  | "dementia_vascular"
  | "dementia_lewy_body"
  | "dementia_frontotemporal"
  | "mci"
  | "parkinsons"
  | "stroke_recovery"
  | "heart_failure"
  | "copd"
  | "diabetes"
  | "cancer"
  | "palliative"
  | "general_frail_elderly"
  | "custom";

export type ClinicalProfile = {
  type: ClinicalProfileType;
  name: string;
  key_domains: string[];
  typical_baseline_patterns: Record<string, string>;
  high_priority_signals: string[];
  communication_adaptations: {
    what_calms_typically: string[];
    what_distresses_typically: string[];
    preferred_approaches: string[];
  };
  monitoring_questions: string[];
  care_transition_considerations: string[];
};

export const CLINICAL_PROFILES: Record<ClinicalProfileType, ClinicalProfile> = {
  dementia_alzheimers: {
    type: "dementia_alzheimers",
    name: "Alzheimer's Disease",
    key_domains: ["cognition", "memory", "mood", "routine", "communication", "safety"],
    typical_baseline_patterns: {
      cognition: "Gradual decline in short-term memory, preserved long-term memory",
      mood: "May have anxiety, depression, or apathy",
      routine: "Strong preference for familiar routines",
      communication: "Word-finding difficulty, repetition",
      safety: "Wandering risk, medication management needs",
    },
    high_priority_signals: [
      "Sudden confusion increase",
      "New wandering behavior",
      "Medication refusal",
      "Fall or injury",
      "Increased agitation at sundown",
    ],
    communication_adaptations: {
      what_calms_typically: [
        "Simple choices (this or that)",
        "Familiar routines and objects",
        "Calm, slow speech with eye contact",
        "One instruction at a time",
      ],
      what_distresses_typically: [
        "Complex questions",
        "Rushed interactions",
        "Environmental changes",
        "Being corrected or argued with",
      ],
      preferred_approaches: [
        "Validation over correction",
        "Redirection instead of confrontation",
        "Offering choices",
        "Using visual cues",
      ],
    },
    monitoring_questions: [
      "Is the person more confused than usual?",
      "Are they sleeping through the night?",
      "Are they eating and drinking adequately?",
      "Any new falls or near-falls?",
      "Any medication changes or side effects?",
    ],
    care_transition_considerations: [
      "Ensure medication list is current",
      "Share communication preferences with new caregivers",
      "Maintain familiar routines during transitions",
      "Plan for orientation support in new environments",
    ],
  },
  mci: {
    type: "mci",
    name: "Mild Cognitive Impairment",
    key_domains: ["cognition", "memory", "mood", "medication_adherence", "routine"],
    typical_baseline_patterns: {
      cognition: "Mild forgetfulness, mostly independent",
      memory: "May need reminders for appointments",
      mood: "Aware of changes, may feel frustrated",
    },
    high_priority_signals: [
      "Difficulty managing medications independently",
      "Getting lost in familiar places",
      "Significant mood changes",
      "Difficulty with complex tasks (finances, cooking)",
    ],
    communication_adaptations: {
      what_calms_typically: [
        "Written reminders and lists",
        "Technology aids (phone reminders)",
        "Maintaining independence where possible",
      ],
      what_distresses_typically: [
        "Being treated as incapable",
        "Over-monitoring",
      ],
      preferred_approaches: [
        "Collaborative planning",
        "Respecting autonomy",
        "Focus on strengths",
      ],
    },
    monitoring_questions: [
      "Can they manage medications without help?",
      "Any difficulty with finances or bills?",
      "Changes in driving ability?",
      "Social withdrawal?",
    ],
    care_transition_considerations: [
      "Assess need for medication management support",
      "Plan for cognitive monitoring",
    ],
  },
  general_frail_elderly: {
    type: "general_frail_elderly",
    name: "General Frail Elderly",
    key_domains: ["mobility", "appetite", "medication_adherence", "mood", "routine", "social"],
    typical_baseline_patterns: {
      mobility: "May use assistive device, some unsteadiness",
      appetite: "Variable, may have decreased intake",
      medication_adherence: "Multiple medications, adherence challenges",
    },
    high_priority_signals: [
      "New fall or injury",
      "Significant appetite loss",
      "Medication confusion",
      "New or worsening pain",
      "Social isolation",
    ],
    communication_adaptations: {
      what_calms_typically: [
        "Clear, respectful communication",
        "Acknowledging their experience",
        "Involving them in decisions",
      ],
      what_distresses_typically: [
        "Being talked down to",
        "Rushed care",
        "Ignoring their preferences",
      ],
      preferred_approaches: [
        "Shared decision-making",
        "Pacing conversations",
        "Addressing comfort first",
      ],
    },
    monitoring_questions: [
      "Any falls or balance issues?",
      "Eating and drinking enough?",
      "Managing medications okay?",
      "Pain well-controlled?",
      "Social contact adequate?",
    ],
    care_transition_considerations: [
      "Fall risk assessment",
      "Medication reconciliation",
      "Nutritional support",
    ],
  },
  // ... other profiles would be defined similarly
  custom: {
    type: "custom",
    name: "Custom Profile",
    key_domains: [],
    typical_baseline_patterns: {},
    high_priority_signals: [],
    communication_adaptations: {
      what_calms_typically: [],
      what_distresses_typically: [],
      preferred_approaches: [],
    },
    monitoring_questions: [],
    care_transition_considerations: [],
  },
};

/**
 * Get clinical profile by type
 */
export function getClinicalProfile(type: ClinicalProfileType): ClinicalProfile {
  return CLINICAL_PROFILES[type] ?? CLINICAL_PROFILES.custom;
}

/**
 * Match events to clinical profile signals
 */
export function matchClinicalProfileSignals(
  events: CanonicalCareEvent[],
  profile: ClinicalProfile
): { matched_signals: string[]; urgency: "high" | "medium" | "low" } {
  const matched: string[] = [];
  const text = events.map(e => e.raw_input.toLowerCase()).join(" ");
  
  for (const signal of profile.high_priority_signals) {
    const keywords = signal.toLowerCase().split(/\s+/);
    if (keywords.some(k => text.includes(k))) {
      matched.push(signal);
    }
  }
  
  const urgency = matched.length >= 2 ? "high" : matched.length === 1 ? "medium" : "low";
  
  return { matched_signals: matched, urgency };
}

/* ============================================================
 * 2. MULTI-CAREGIVER SUPPORT
 * ============================================================ */

export type CaregiverRole = "primary" | "secondary" | "professional" | "coordinator" | "observer";

export type FamilyCareTeam = {
  care_recipient_id: string;
  caregivers: Array<{
    id: string;
    name: string;
    role: CaregiverRole;
    relationship: string;
    added_at: string;
    last_active: string;
    permissions: {
      can_view_full_record: boolean;
      can_add_events: boolean;
      can_communicate_externally: boolean;
      can_manage_team: boolean;
    };
  }>;
  communication_preferences: {
    shared_updates: boolean;
    individual_updates: boolean;
    emergency_contacts: string[];
  };
};

/**
 * Build family care team from events
 */
export function buildFamilyCareTeam(
  events: CanonicalCareEvent[],
  care_recipient_id: string
): FamilyCareTeam {
  // Extract unique caregivers from events
  const caregiver_map = new Map<string, { name: string; role: CaregiverRole; relationship: string }>();
  
  for (const event of events) {
    // Extract caregiver info from event attribution
    if (event.contributor_id && !caregiver_map.has(event.contributor_id)) {
      // Would need to look up actual names/roles from care identity
      caregiver_map.set(event.contributor_id, {
        name: event.contributor_id,
        role: "secondary",
        relationship: "family",
      });
    }
  }
  
  // Default primary caregiver
  const primary_id = events[0]?.contributor_id ?? "primary";
  if (!caregiver_map.has(primary_id)) {
    caregiver_map.set(primary_id, { name: primary_id, role: "primary", relationship: "primary_caregiver" });
  }
  
  return {
    care_recipient_id,
    caregivers: Array.from(caregiver_map.entries()).map(([id, info]) => ({
      id,
      name: info.name,
      role: info.role,
      relationship: info.relationship,
      added_at: new Date().toISOString(),
      last_active: new Date().toISOString(),
      permissions: {
        can_view_full_record: info.role === "primary" || info.role === "coordinator",
        can_add_events: true,
        can_communicate_externally: info.role === "primary" || info.role === "professional",
        can_manage_team: info.role === "primary",
      },
    })),
    communication_preferences: {
      shared_updates: true,
      individual_updates: false,
      emergency_contacts: [],
    },
  };
}

/**
 * Filter events by caregiver role for multi-caregiver views
 */
export function filterEventsByCaregiverRole(
  events: CanonicalCareEvent[],
  team: FamilyCareTeam,
  viewer_role: CaregiverRole
): CanonicalCareEvent[] {
  const viewer = team.caregivers.find(c => c.role === viewer_role);
  if (!viewer) return [];
  
  if (viewer.permissions.can_view_full_record) {
    return events;
  }
  
  // Filter to events they contributed or shared events
  return events.filter(e => 
    e.contributor_id === viewer.id || 
    (e.metadata?.shared_with?.includes(viewer.id) ?? false)
  );
}

/* ============================================================
 * 3. LONG-THREAD SUPPORT
 * ============================================================ */

export type LongThreadContext = {
  care_recipient_id: string;
  thread_id: string;
  started_at: string;
  last_updated: string;
  message_count: number;
  participant_ids: string[];
  key_topics: string[];
  open_loops: Array<{
    id: string;
    description: string;
    created_at: string;
    status: "open" | "monitoring" | "resolved";
    related_events: string[];
  }>;
  continuity_anchors: Array<{
    event_id: string;
    description: string;
    timestamp: string;
  }>;
};

/**
 * Build long-thread context from events
 */
export function buildLongThreadContext(
  events: CanonicalCareEvent[],
  care_recipient_id: string,
  thread_id: string
): LongThreadContext {
  const sorted = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Extract key topics from events
  const topics = new Set<string>();
  for (const event of sorted) {
    topics.add(event.extracted_type);
    // Add domain from extracted type
    const domain = event.extracted_type.split("_")[0];
    topics.add(domain);
  }
  
  // Identify open loops (unresolved questions, pending actions)
  const open_loops = sorted
    .filter(e => e.status === "pending" || e.extracted_type.includes("follow_up") || e.extracted_type.includes("question"))
    .slice(-10)
    .map(e => ({
      id: e.id,
      description: e.raw_input.slice(0, 200),
      created_at: e.timestamp,
      status: "open" as const,
      related_events: [e.id],
    }));
  
  // Continuity anchors - key events that define the care journey
  const continuity_anchors = sorted
    .filter(e => 
      ["hospital_admission", "hospital_discharge", "diagnosis", "medication_change", "family_decision"]
        .includes(e.extracted_type)
    )
    .slice(-5)
    .map(e => ({
      event_id: e.id,
      description: `${e.extracted_type}: ${e.raw_input.slice(0, 150)}`,
      timestamp: e.timestamp,
    }));
  
  return {
    care_recipient_id,
    thread_id,
    started_at: sorted[0]?.timestamp ?? new Date().toISOString(),
    last_updated: new Date().toISOString(),
    message_count: events.length,
    participant_ids: [...new Set(events.map(e => e.contributor_id).filter(Boolean))],
    key_topics: Array.from(topics).slice(0, 20),
    open_loops,
    continuity_anchors,
  };
}

/* ============================================================
 * 4. EMOTIONAL INPUTS (Caregiver State Signals)
 * ============================================================ */

export type CaregiverEmotionalSignal = 
  | "overwhelmed"
  | "anxious"
  | "exhausted"
  | "frustrated"
  | "guilty"
  | "grieving"
  | "hopeful"
  | "confident"
  | "uncertain"
  | "relieved";

export type CaregiverStateSignal = {
  signal: CaregiverEmotionalSignal;
  confidence: number;
  source_text: string;
  event_id: string;
  timestamp: string;
  /** Not emotional support - these are signals for reasoning */
  reasoning_note: string;
};

const EMOTIONAL_SIGNAL_PATTERNS: Record<CaregiverEmotionalSignal, RegExp[]> = {
  overwhelmed: [/\b(overwhelmed|too much|can't handle|drowning|swamped)\b/i],
  anxious: [/\b(anxious|worried|nervous|scared|fear)\b/i],
  exhausted: [/\b(exhausted|burnout|burned out|tired|drained|no energy)\b/i],
  frustrated: [/\b(frustrated|angry|irritated|fed up|at my limit)\b/i],
  guilty: [/\b(guilty|guilt|should have|failed|letting down)\b/i],
  grieving: [/\b(grieving|grief|loss|mourning|miss them)\b/i],
  hopeful: [/\b(hopeful|optimistic|better|improving|progress)\b/i],
  confident: [/\b(confident|sure|know what to do|handling it)\b/i],
  uncertain: [/\b(uncertain|unsure|don't know|confused|lost)\b/i],
  relieved: [/\b(relieved|relief|thankful|grateful|weight lifted)\b/i],
};

/**
 * Detect caregiver emotional signals from input
 * These are NOT for emotional support - they are signals for reasoning priority
 */
export function detectCaregiverEmotionalSignals(
  raw_input: string,
  event_id: string
): CaregiverStateSignal[] {
  const signals: CaregiverStateSignal[] = [];
  const lower = raw_input.toLowerCase();
  
  for (const [signal, patterns] of Object.entries(EMOTIONAL_SIGNAL_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(lower)) {
        signals.push({
          signal: signal as CaregiverEmotionalSignal,
          confidence: 0.7,
          source_text: raw_input.slice(0, 200),
          event_id,
          timestamp: new Date().toISOString(),
          reasoning_note: `Caregiver ${signal} signal detected - adjusts priority and communication approach`,
        });
      }
    }
  }
  
  return signals;
}

/**
 * Adjust reasoning based on caregiver state
 */
export function adjustReasoningForCaregiverState(
  signals: CaregiverStateSignal[],
  current_priority: string[]
): { adjusted_priority: string[]; communication_adjustments: string[] } {
  const has_overwhelmed = signals.some(s => s.signal === "overwhelmed" || s.signal === "exhausted");
  const has_anxious = signals.some(s => s.signal === "anxious" || s.signal === "uncertain");
  const has_confident = signals.some(s => s.signal === "confident" || s.signal === "hopeful");
  
  const adjusted = [...current_priority];
  const adjustments: string[] = [];
  
  if (has_overwhelmed) {
    adjustments.push("Reduce information density - essential mode only");
    adjustments.push("Defer non-critical items");
    // Move urgent items to top, limit to 1-2
    adjusted.sort((a, b) => {
      const a_urgent = a.toLowerCase().includes("urgent") || a.toLowerCase().includes("immediate");
      const b_urgent = b.toLowerCase().includes("urgent") || b.toLowerCase().includes("immediate");
      return (b_urgent ? 1 : 0) - (a_urgent ? 1 : 0);
    });
  }
  
  if (has_anxious) {
    adjustments.push("Provide clear next steps and timeline");
    adjustments.push("Explicitly address what is known vs unknown");
  }
  
  if (has_confident) {
    adjustments.push("Can handle more detail if requested");
  }
  
  return { adjusted_priority: adjusted, communication_adjustments: adjustments };
}

/* ============================================================
 * 5. DONE-FOR-NOW TRACKING
 * ============================================================ */

export type DoneForNowItem = {
  id: string;
  description: string;
  reason: "resolved" | "monitoring" | "deferred" | "no_action_needed" | "handed_off";
  resolved_at: string;
  resolved_by: string;
  related_event_ids: string[];
  /** Can be reopened if situation changes */
  reopen_trigger?: string;
  confidence: "high" | "medium" | "low";
};

export type DoneForNowTracker = {
  care_recipient_id: string;
  items: DoneForNowItem[];
  last_reviewed: string;
};

/**
 * Mark an item as done-for-now
 */
export function markDoneForNow(
  tracker: DoneForNowTracker,
  description: string,
  reason: DoneForNowItem["reason"],
  resolved_by: string,
  related_event_ids: string[],
  reopen_trigger?: string
): DoneForNowTracker {
  const item: DoneForNowItem = {
    id: `done_${Date.now()}`,
    description,
    reason,
    resolved_at: new Date().toISOString(),
    resolved_by,
    related_event_ids,
    reopen_trigger,
    confidence: reason === "resolved" ? "high" : "medium",
  };
  
  return {
    ...tracker,
    items: [...tracker.items, item],
    last_reviewed: new Date().toISOString(),
  };
}

/**
 * Check if any done-for-now items should be reopened
 */
export function checkDoneForNowReopen(
  tracker: DoneForNowTracker,
  new_events: CanonicalCareEvent[]
): DoneForNowItem[] {
  const to_reopen: DoneForNowItem[] = [];
  
  for (const item of tracker.items) {
    if (item.reopen_trigger) {
      const text = new_events.map(e => e.raw_input.toLowerCase()).join(" ");
      if (text.includes(item.reopen_trigger.toLowerCase())) {
        to_reopen.push({ ...item, confidence: "low" });
      }
    }
  }
  
  return to_reopen;
}

/* ============================================================
 * COMBINED INTEGRATION
 * ============================================================ */

export type ExtendedCapabilitiesInput = {
  events: CanonicalCareEvent[];
  care_context: CareContextRoot;
  care_recipient_id: string;
  caregiver_id: string;
  clinical_profile_type?: ClinicalProfileType;
  thread_id?: string;
  done_for_now_tracker?: DoneForNowTracker;
};

export type ExtendedCapabilitiesOutput = {
  clinical_profile: ClinicalProfile;
  profile_signals: { matched_signals: string[]; urgency: "high" | "medium" | "low" };
  family_team: FamilyCareTeam;
  long_thread: LongThreadContext;
  emotional_signals: CaregiverStateSignal[];
  adjusted_priority: string[];
  communication_adjustments: string[];
  done_for_now: DoneForNowTracker;
  reopened_items: DoneForNowItem[];
  presentation_view: ReturnType<typeof projectPresentation>;
};

/**
 * Process all extended capabilities
 */
export function processExtendedCapabilities(
  input: ExtendedCapabilitiesInput
): ExtendedCapabilitiesOutput {
  const { events, care_context, care_recipient_id, caregiver_id, clinical_profile_type, thread_id, done_for_now_tracker } = input;
  
  // Clinical profile
  const profile = getClinicalProfile(clinical_profile_type ?? "general_frail_elderly");
  const profile_signals = matchClinicalProfileSignals(events, profile);
  
  // Family team
  const family_team = buildFamilyCareTeam(events, care_recipient_id);
  
  // Long thread
  const long_thread = buildLongThreadContext(events, care_recipient_id, thread_id ?? `thread_${Date.now()}`);
  
  // Emotional signals from latest events
  let all_emotional_signals: CaregiverStateSignal[] = [];
  for (const event of events.slice(-5)) { // Check recent 5 events
    all_emotional_signals.push(...detectCaregiverEmotionalSignals(event.raw_input, event.id));
  }
  
  // Adjust reasoning
  const { adjusted_priority, communication_adjustments } = adjustReasoningForCaregiverState(
    all_emotional_signals,
    profile.high_priority_signals
  );
  
  // Done-for-now
  const tracker = done_for_now_tracker ?? {
    care_recipient_id,
    items: [],
    last_reviewed: new Date().toISOString(),
  };
  const reopened_items = checkDoneForNowReopen(tracker, events);
  
  // Truth slice for presentation
  const truth_slice = buildTruthSliceFromExtended({
    events,
    profile,
    family_team,
    long_thread,
    emotional_signals: all_emotional_signals,
  });
  
  const presentation_view = projectPresentation(truth_slice, { mode: "standard" });
  
  return {
    clinical_profile: profile,
    profile_signals,
    family_team,
    long_thread,
    emotional_signals: all_emotional_signals,
    adjusted_priority,
    communication_adjustments,
    done_for_now: tracker,
    reopened_items,
    presentation_view,
  };
}

function buildTruthSliceFromExtended(params: {
  events: CanonicalCareEvent[];
  profile: ClinicalProfile;
  family_team: FamilyCareTeam;
  long_thread: LongThreadContext;
  emotional_signals: CaregiverStateSignal[];
}): ContinuityTruthSlice {
  const { events, profile, family_team, long_thread, emotional_signals } = params;
  
  return {
    what_changed: events.slice(-3).map(e => `${e.extracted_type}: ${e.raw_input.slice(0, 100)}`),
    what_is_happening: [
      `Clinical profile: ${profile.name}`,
      `Care team: ${family_team.caregivers.length} caregivers`,
      `Thread: ${long_thread.message_count} messages, ${long_thread.open_loops.length} open loops`,
      ...emotional_signals.slice(0, 2).map(s => `Caregiver signal: ${s.signal}`),
    ],
    what_needs_attention: profile.high_priority_signals.slice(0, 3),
    what_is_stable: [],
    known: [],
    inferred: [],
    explicit_unknowns: long_thread.open_loops.map(l => ({
      missing_information: l.description,
      priority: "high" as const,
      reason_it_matters: "Open loop in care continuity",
    })),
    confidence_notes: [],
    evidence_summaries: [],
    reasoning_summary: `Extended capabilities active: ${profile.type}, ${family_team.caregivers.length} caregivers`,
  };
}