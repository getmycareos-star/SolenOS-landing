/**
 * Presentation Engine — PURE projection over a single shared CareContext.
 * Never mutates facts, events, unknowns, confidence, or timeline order.
 * 
 * Implements multi-view projection for different cognitive load contexts:
 * - essential: Headlines only for overwhelmed caregivers
 * - standard: Balanced presentation for everyday use
 * - detailed: Full picture with reasoning for professional/clinical review
 */

export const PRESENTATION_MODES = ["essential", "standard", "detailed"] as const;
export type PresentationMode = (typeof PRESENTATION_MODES)[number];

export type PresentationPreference = {
  mode: PresentationMode;
  /** Optional role hint for future institutional projection — does NOT change truth. */
  actor_role?:
    | "primary_caregiver"
    | "secondary_caregiver"
    | "professional_caregiver"
    | "clinician"
    | "institutional_observer";
};

export type ContinuityTruthSlice = {
  what_changed: string[];
  what_is_happening: string[];
  what_needs_attention: string[];
  what_is_stable: string[];
  known: string[];
  inferred: string[];
  explicit_unknowns: Array<{
    missing_information: string;
    priority: "critical" | "high" | "medium" | "low";
    reason_it_matters: string;
    related_event_ids?: string[];
  }>;
  confidence_notes: string[];
  evidence_summaries: string[];
  evidence_chains?: Array<{
    claim: string;
    event_ids: string[];
    confidence: number;
    source_reliability: number;
  }>;
  reasoning_summary?: string;
  baseline_comparison?: Array<{
    domain: string;
    baseline_statement: string;
    current_observation: string;
    deviation_type: "improvement" | "decline" | "fluctuation" | "transition";
    confidence: "high" | "medium" | "low";
  }>;
};

export type PresentedContinuityView = {
  mode: PresentationMode;
  /** Same underlying reality — filtered for cognitive load only. */
  sections: {
    what_changed: string[];
    what_matters_now: string[];
    what_is_unknown: string[];
    next_considerations: string[];
    reasoning_summary: string[];
    full_detail?: ContinuityTruthSlice;
  };
  invariants: {
    single_care_context: true;
    presentation_only: true;
    does_not_mutate_truth: true;
  };
  metadata: {
    cognitive_load: "low" | "medium" | "high";
    item_count: number;
    generated_at: string;
  };
};

/**
 * Cognitive load estimation — how many items can caregiver reasonably process?
 * Considers both item count and uncertainty weight.
 */
function estimateCognitiveLoad(truth: ContinuityTruthSlice): "low" | "medium" | "high" {
  const item_count =
    truth.what_changed.length +
    truth.what_is_happening.length +
    truth.what_needs_attention.length +
    truth.explicit_unknowns.length;
  
  // Weight critical unknowns more heavily
  const criticalUnknowns = truth.explicit_unknowns.filter(
    (u) => u.priority === "critical" || u.priority === "high"
  ).length;
  
  const weighted_count = item_count + (criticalUnknowns * 2);
  
  if (weighted_count > 12) return "high";
  if (weighted_count > 6) return "medium";
  return "low";
}

/**
 * Filter items by relevance to care recipient impact
 */
function filterByRelevance(items: string[], max: number): string[] {
  return items.slice(0, max);
}

/**
 * Build essential mode - headlines only for overwhelmed caregivers
 * Target: Overwhelmed caregiver, immediate decisions only
 */
function projectEssential(truth: ContinuityTruthSlice): PresentedContinuityView["sections"] {
  const highUnknowns = truth.explicit_unknowns.filter(
    (u) => u.priority === "critical" || u.priority === "high"
  );
  const criticalItems = truth.what_needs_attention.filter(
    (item) => 
      item.toLowerCase().includes("urgent") || 
      item.toLowerCase().includes("crisis") ||
      item.toLowerCase().includes("immediate") ||
      item.toLowerCase().includes("emergency")
  );
  
  return {
    what_changed: truth.what_changed.slice(0, 1),
    what_matters_now: (criticalItems.length > 0 ? criticalItems : truth.what_needs_attention).slice(0, 1),
    what_is_unknown: highUnknowns.slice(0, 1).map((u) => u.missing_information),
    next_considerations: (criticalItems.length > 0 ? criticalItems : truth.what_needs_attention).slice(0, 1),
    reasoning_summary: [],
  };
}

/**
 * Build standard mode - balanced presentation for everyday use
 * Target: Regular caregiver, everyday use
 */
function projectStandard(truth: ContinuityTruthSlice): PresentedContinuityView["sections"] {
  const highUnknowns = truth.explicit_unknowns.filter(
    (u) => u.priority === "critical" || u.priority === "high"
  );
  
  return {
    what_changed: truth.what_changed.slice(0, 3),
    what_matters_now: truth.what_needs_attention.slice(0, 3),
    what_is_unknown: highUnknowns.slice(0, 2).map(
      (u) => `${u.missing_information} — ${u.reason_it_matters}`
    ),
    next_considerations: truth.what_needs_attention.slice(0, 2),
    reasoning_summary: [
      ...truth.confidence_notes.slice(0, 2),
      ...truth.evidence_summaries.slice(0, 2),
    ],
    full_detail: truth,
  };
}

/**
 * Build detailed mode - full picture with reasoning
 * Target: Professional caregiver, clinic staff, comprehensive understanding
 */
function projectDetailed(truth: ContinuityTruthSlice): PresentedContinuityView["sections"] {
  return {
    what_changed: truth.what_changed,
    what_matters_now: [
      ...truth.what_is_happening.slice(0, 5),
      ...truth.what_needs_attention.slice(0, 5),
    ],
    what_is_unknown: truth.explicit_unknowns.map(
      (u) => `${u.missing_information} (${u.priority}): ${u.reason_it_matters}`
    ),
    next_considerations: truth.what_needs_attention,
    reasoning_summary: [
      ...truth.inferred,
      ...truth.confidence_notes,
      ...truth.evidence_summaries,
      ...(truth.reasoning_summary ? [truth.reasoning_summary] : []),
    ],
    full_detail: truth,
  };
}

/**
 * Main projection function — deterministic, reversible, non-destructive.
 * 
 * @param truth - The complete continuity truth slice from reasoning
 * @param preference - Presentation mode and optional role hint
 * @returns PresentedContinuityView with filtered sections for the mode
 */
export function projectPresentation(
  truth: ContinuityTruthSlice,
  preference: PresentationPreference = { mode: "standard" },
): PresentedContinuityView {
  const mode = preference.mode;
  const load = estimateCognitiveLoad(truth);
  
  const totalItems = 
    truth.what_changed.length +
    truth.what_is_happening.length +
    truth.what_needs_attention.length +
    truth.explicit_unknowns.length;
  
  let sections: PresentedContinuityView["sections"];
  
  switch (mode) {
    case "essential":
      sections = projectEssential(truth);
      break;
    case "detailed":
      sections = projectDetailed(truth);
      break;
    case "standard":
    default:
      sections = projectStandard(truth);
      break;
  }
  
  return {
    mode,
    sections,
    invariants: {
      single_care_context: true,
      presentation_only: true,
      does_not_mutate_truth: true,
    },
    metadata: {
      cognitive_load: load,
      item_count: totalItems,
      generated_at: new Date().toISOString(),
    },
  };
}

/**
 * Project a Care Understanding Confidence view (Phase 2 capability)
 * Maps truth slice to area-level clarity with evidence
 */
export function projectCareUnderstandingConfidence(
  truth: ContinuityTruthSlice,
): {
  clear_areas: Array<{ area: string; clarity: "clear"; reliability: "high"; evidence: string[] }>;
  limited_areas: Array<{ area: string; clarity: "limited"; reliability: "medium"; evidence: string[]; missing_context: string }>;
  unknown_areas: Array<{ area: string; clarity: "unknown"; reliability: "low"; evidence: string[]; missing_context: string }>;
  computed_at: string;
} {
  const clear_areas: Array<{ area: string; clarity: "clear"; reliability: "high"; evidence: string[] }> = [];
  const limited_areas: Array<{ area: string; clarity: "limited"; reliability: "medium"; evidence: string[]; missing_context: string }> = [];
  const unknown_areas: Array<{ area: string; clarity: "unknown"; reliability: "low"; evidence: string[]; missing_context: string }> = [];
  
  // Map what_changed + what_is_happening to clear areas
  for (const item of truth.what_changed) {
    clear_areas.push({
      area: item,
      clarity: "clear",
      reliability: "high",
      evidence: truth.evidence_summaries.slice(0, 2),
    });
  }
  
  for (const item of truth.what_is_happening) {
    clear_areas.push({
      area: item,
      clarity: "clear",
      reliability: "high",
      evidence: truth.evidence_summaries.slice(0, 2),
    });
  }
  
  // Map what_needs_attention to limited areas
  for (const item of truth.what_needs_attention) {
    limited_areas.push({
      area: item,
      clarity: "limited",
      reliability: "medium",
      evidence: truth.evidence_summaries.slice(0, 1),
      missing_context: "Monitoring needed to confirm trend",
    });
  }
  
  // Map explicit_unknowns to unknown areas
  for (const u of truth.explicit_unknowns) {
    unknown_areas.push({
      area: u.missing_information,
      clarity: "unknown",
      reliability: u.priority === "critical" ? "low" : "low",
      evidence: [],
      missing_context: u.reason_it_matters,
    });
  }
  
  // Add baseline comparison areas
  if (truth.baseline_comparison) {
    for (const bc of truth.baseline_comparison) {
      const area = bc.domain;
      if (bc.confidence === "high") {
        clear_areas.push({
          area,
          clarity: "clear",
          reliability: "high",
          evidence: [bc.baseline_statement, bc.current_observation],
        });
      } else if (bc.confidence === "medium") {
        limited_areas.push({
          area,
          clarity: "limited",
          reliability: "medium",
          evidence: [bc.baseline_statement, bc.current_observation],
          missing_context: `What would confirm: ${bc.current_observation}`,
        });
      } else {
        unknown_areas.push({
          area,
          clarity: "unknown",
          reliability: "low",
          evidence: [bc.current_observation],
          missing_context: `Baseline deviation detected, clinical confirmation needed`,
        });
      }
    }
  }
  
  return {
    clear_areas,
    limited_areas,
    unknown_areas,
    computed_at: new Date().toISOString(),
  };
}

/**
 * Project a Care Moment view (Phase 2 capability)
 * Bridges to moment-of-need-engine for in-the-moment capture
 */
export function projectCareMoment(
  truth: ContinuityTruthSlice,
): {
  what_changed: string[];
  what_do_we_know: string[];
  why_might_this_matter: string[];
  what_should_be_remembered: string[];
  what_questions_to_consider: string[];
} {
  return {
    what_changed: truth.what_changed.slice(0, 3),
    what_do_we_know: [
      ...truth.known.slice(0, 3),
      ...truth.what_is_happening.slice(0, 2),
    ],
    why_might_this_matter: truth.inferred.slice(0, 3),
    what_should_be_remembered: truth.what_is_stable.slice(0, 3),
    what_questions_to_consider: truth.explicit_unknowns
      .filter((u) => u.priority === "critical" || u.priority === "high")
      .slice(0, 2)
      .map((u) => u.missing_information),
  };
}

/**
 * Project a Care Communication Support view (Phase 3 capability)
 * Neutral situation summary with evidence from care reality
 */
export function projectCareCommunicationSupport(
  truth: ContinuityTruthSlice,
  draftType?: "message_to_sibling" | "family_group_update" | "questions_for_doctor" | "care_transition_explanation" | "support_conversation_with_parent",
): {
  current_situation_summary: string;
  evidence_from_care_reality: Array<{ claim: string; source_type: string; event_ids: string[] }>;
  conversation_preparation: string[];
  draft_type?: string;
  draft_text?: string;
  uncertainties: string[];
} {
  const evidence = truth.evidence_chains?.map((ec) => ({
    claim: ec.claim,
    source_type: ec.source_reliability > 0.8 ? "document" : "caregiver_observation",
    event_ids: ec.event_ids,
  })) ?? [];
  
  const summary_parts = [
    truth.what_changed.slice(0, 2).join("; "),
    truth.what_is_happening.slice(0, 2).join("; "),
  ].filter(Boolean);
  
  let draft_text: string | undefined;
  if (draftType) {
    const templates: Record<string, string> = {
      message_to_sibling: `Hi, wanted to update you on [care recipient]. ${summary_parts.join(" ")}. There are a few things we're still figuring out: ${truth.explicit_unknowns.slice(0, 2).map(u => u.missing_information).join(", ")}.`,
      family_group_update: `Family update on [care recipient]: ${summary_parts.join(" ")}. Current priorities: ${truth.what_needs_attention.slice(0, 2).join(", ")}. Questions for the team: ${truth.explicit_unknowns.slice(0, 2).map(u => u.missing_information).join(", ")}.`,
      questions_for_doctor: `Questions for upcoming appointment:\n${truth.explicit_unknowns.slice(0, 3).map(u => `- ${u.missing_information} (${u.reason_it_matters})`).join("\n")}`,
      care_transition_explanation: `Care transition summary for [care recipient]: ${summary_parts.join(" ")}. What's stable: ${truth.what_is_stable.slice(0, 2).join(", ")}. What needs attention: ${truth.what_needs_attention.slice(0, 2).join(", ")}.`,
      support_conversation_with_parent: `Talking points for conversation with [care recipient]: ${summary_parts.join(" ")}. Remember: ${truth.what_is_stable.slice(0, 2).join("; ")}. Be mindful of: ${truth.explicit_unknowns.slice(0, 2).map(u => u.missing_information).join(", ")}.`,
    };
    draft_text = templates[draftType] ?? templates.message_to_sibling;
  }
  
  return {
    current_situation_summary: summary_parts.join(" ") || "No significant changes detected.",
    evidence_from_care_reality: evidence,
    conversation_preparation: [
      "Review what changed and what's stable",
      "Note uncertainties to discuss",
      "Prepare specific questions for care team",
    ],
    draft_type: draftType,
    draft_text,
    uncertainties: truth.explicit_unknowns.map((u) => u.missing_information),
  };
}