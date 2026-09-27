/**
 * Person-Specific Human Context — Care Reality Profile extension (principle + layers).
 * Preserves lived experience — not medical diagnosis.
 * 
 * Implementation: Extract human context insights from care events
 * and build person-specific profile for communication personalization.
 */

import type { CanonicalCareEvent } from "../situation-entry/types";
import type { CareContextRoot } from "../situation-entry/types";

export const HUMAN_CONTEXT_IDENTITY =
  "SolenOS understands my loved one — not just their condition.";

export const HUMAN_CONTEXT_PRINCIPLE =
  "The Care Reality Profile must capture who this person is, what works, what creates difficulty, and how they respond — from caregiver observations and documented outcomes.";

/** Human context layers — map to profile sections where implemented. */
export const HUMAN_CONTEXT_LAYERS = [
  "communication_patterns",
  "what_calms",
  "what_causes_distress",
  "preferred_routines",
  "important_relationships",
  "previous_successful_approaches",
  "previous_failed_approaches",
] as const;

export type HumanContextLayer = (typeof HUMAN_CONTEXT_LAYERS)[number];

/** Bridge: human context layer → care_reality_profile_engine PROFILE_SECTIONS */
export const HUMAN_CONTEXT_TO_PROFILE_SECTION = {
  communication_patterns: "family_observations",
  what_calms: "what_helped",
  what_causes_distress: "what_did_not_help",
  preferred_routines: "important_routines",
  important_relationships: "family_observations",
  previous_successful_approaches: "what_helped",
  previous_failed_approaches: "what_did_not_help",
} as const;

export const HUMAN_CONTEXT_BOUNDARIES = {
  is: ["preserving_lived_experience", "person_specific_patterns", "response_history"],
  is_not: [
    "medical_diagnosis_of_behavior",
    "reducing_person_to_condition",
    "symptom_category_labels",
    "generic_dementia_explanations",
  ],
} as const;

export const HUMAN_CONTEXT_WRONG_VS_RIGHT = {
  wrong: "Resistance to care can occur in dementia.",
  right:
    "Based on previous interactions, this person has responded better when choices were offered instead of direct instructions.",
} as const;

export type HumanContextInsight = {
  layer: HumanContextLayer;
  insight: string;
  source_event_ids: string[];
  confidence: "low" | "medium" | "high";
};

export type HumanContextProfile = {
  care_recipient_id: string;
  communication_patterns: HumanContextInsight[];
  what_calms: HumanContextInsight[];
  what_causes_distress: HumanContextInsight[];
  preferred_routines: HumanContextInsight[];
  important_relationships: HumanContextInsight[];
  previous_successful_approaches: HumanContextInsight[];
  previous_failed_approaches: HumanContextInsight[];
  last_updated: string;
};

/**
 * Extract human context insights from care events
 * Looks for patterns in caregiver observations about what works/doesn't work
 */
export function extractHumanContextFromEvents(
  events: CanonicalCareEvent[],
  care_recipient_id: string
): HumanContextProfile {
  const insights_by_layer: Record<HumanContextLayer, HumanContextInsight[]> = {
    communication_patterns: [],
    what_calms: [],
    what_causes_distress: [],
    preferred_routines: [],
    important_relationships: [],
    previous_successful_approaches: [],
    previous_failed_approaches: [],
  };
  
  // Keywords for each layer
  const layer_keywords: Record<HumanContextLayer, { positive: string[]; negative: string[] }> = {
    communication_patterns: {
      positive: ["responds well to", "understands when", "communicates by", "prefers when told"],
      negative: ["doesn't understand", "confused by", "gets frustrated when"],
    },
    what_calms: {
      positive: ["calms down with", "soothed by", "relaxes when", "peaceful with", "comforted by"],
      negative: [],
    },
    what_causes_distress: {
      positive: [],
      negative: ["upset by", "distressed by", "agitated when", "anxious about", "afraid of", "resists"],
    },
    preferred_routines: {
      positive: ["routine", "schedule", "usually", "always at", "prefers", "likes to", "habit of"],
      negative: ["disrupts routine", "change in schedule", "hates when"],
    },
    important_relationships: {
      positive: ["close to", "loves", "connected to", "visits from", "talks about", "mentions"],
      negative: ["doesn't recognize", "confused about", "upset by visit"],
    },
    previous_successful_approaches: {
      positive: ["worked well", "helped", "successful", "effective", "responded positively", "calmed with"],
      negative: [],
    },
    previous_failed_approaches: {
      positive: [],
      negative: ["didn't work", "failed", "made worse", "upset them", "resisted", "refused"],
    },
  };
  
  // Process each event
  for (const event of events) {
    const text = event.raw_input.toLowerCase();
    const event_id = event.id;
    
    for (const layer of HUMAN_CONTEXT_LAYERS) {
      const keywords = layer_keywords[layer];
      
      // Check positive keywords
      for (const kw of keywords.positive) {
        if (text.includes(kw)) {
          // Extract the insight sentence
          const sentences = event.raw_input.split(/[.!?]+/);
          const relevant = sentences.find(s => s.toLowerCase().includes(kw));
          if (relevant) {
            insights_by_layer[layer].push({
              layer,
              insight: relevant.trim(),
              source_event_ids: [event_id],
              confidence: event.integrity?.field_confidence?.extracted_fact?.extraction > 0.7 ? "high" : "medium",
            });
          }
        }
      }
      
      // Check negative keywords
      for (const kw of keywords.negative) {
        if (text.includes(kw)) {
          const sentences = event.raw_input.split(/[.!?]+/);
          const relevant = sentences.find(s => s.toLowerCase().includes(kw));
          if (relevant) {
            insights_by_layer[layer].push({
              layer,
              insight: relevant.trim(),
              source_event_ids: [event_id],
              confidence: event.integrity?.field_confidence?.extracted_fact?.extraction > 0.7 ? "high" : "medium",
            });
          }
        }
      }
    }
  }
  
  // Deduplicate insights (keep highest confidence)
  for (const layer of HUMAN_CONTEXT_LAYERS) {
    const unique = new Map<string, HumanContextInsight>();
    for (const insight of insights_by_layer[layer]) {
      const key = insight.insight.toLowerCase().slice(0, 100);
      const existing = unique.get(key);
      if (!existing || confidenceRank(insight.confidence) > confidenceRank(existing.confidence)) {
        unique.set(key, insight);
      }
    }
    insights_by_layer[layer] = Array.from(unique.values()).slice(0, 10); // Limit per layer
  }
  
  return {
    care_recipient_id,
    communication_patterns: insights_by_layer.communication_patterns,
    what_calms: insights_by_layer.what_calms,
    what_causes_distress: insights_by_layer.what_causes_distress,
    preferred_routines: insights_by_layer.preferred_routines,
    important_relationships: insights_by_layer.important_relationships,
    previous_successful_approaches: insights_by_layer.previous_successful_approaches,
    previous_failed_approaches: insights_by_layer.previous_failed_approaches,
    last_updated: new Date().toISOString(),
  };
}

function confidenceRank(c: "low" | "medium" | "high"): number {
  return c === "high" ? 3 : c === "medium" ? 2 : 1;
}

/**
 * Build human context profile from care context root
 */
export function buildHumanContextProfile(
  care_context: CareContextRoot
): HumanContextProfile {
  return extractHumanContextFromEvents(care_context.events, care_context.care_recipient_id);
}

/**
 * Get relevant human context insights for a communication scenario
 */
export function getRelevantHumanContext(
  profile: HumanContextProfile,
  scenario: "communicating_with_care_recipient" | "communicating_with_family" | "communicating_with_doctor" | "care_transition"
): HumanContextInsight[] {
  const relevant: HumanContextInsight[] = [];
  
  switch (scenario) {
    case "communicating_with_care_recipient":
      relevant.push(...profile.what_calms.filter(i => i.confidence === "high"));
      relevant.push(...profile.what_causes_distress.filter(i => i.confidence === "high"));
      relevant.push(...profile.communication_patterns.filter(i => i.confidence === "high"));
      relevant.push(...profile.previous_successful_approaches.filter(i => i.confidence === "high"));
      break;
    case "communicating_with_family":
      relevant.push(...profile.important_relationships);
      relevant.push(...profile.previous_successful_approaches);
      relevant.push(...profile.preferred_routines);
      break;
    case "communicating_with_doctor":
      relevant.push(...profile.what_causes_distress);
      relevant.push(...profile.preferred_routines);
      relevant.push(...profile.communication_patterns);
      break;
    case "care_transition":
      relevant.push(...profile.preferred_routines);
      relevant.push(...profile.what_calms);
      relevant.push(...profile.what_causes_distress);
      relevant.push(...profile.important_relationships);
      break;
  }
  
  return relevant.slice(0, 8);
}

/**
 * Apply human context to personalize a communication draft
 */
export function applyHumanContextToDraft(
  draft: string,
  relevant_insights: HumanContextInsight[]
): string {
  if (relevant_insights.length === 0) return draft;
  
  let personalized = draft;
  const applied: string[] = [];
  
  for (const insight of relevant_insights) {
    if (insight.layer === "communication_patterns" && insight.confidence === "high") {
      applied.push(`Use approach: ${insight.insight}`);
    }
    if (insight.layer === "what_calms" && insight.confidence === "high") {
      applied.push(`Calming: ${insight.insight}`);
    }
    if (insight.layer === "what_causes_distress" && insight.confidence === "high") {
      applied.push(`Avoid: ${insight.insight}`);
    }
    if (insight.layer === "previous_successful_approaches" && insight.confidence === "high") {
      applied.push(`What worked: ${insight.insight}`);
    }
    if (insight.layer === "previous_failed_approaches" && insight.confidence === "high") {
      applied.push(`What failed: ${insight.insight}`);
    }
  }
  
  if (applied.length > 0) {
    personalized += "\n\n[Personalized guidance: " + applied.join("; ") + "]";
  }
  
  return personalized;
}