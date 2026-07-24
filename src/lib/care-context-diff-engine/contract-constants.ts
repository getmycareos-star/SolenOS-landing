/** Care Context Diff Engine — human-understandable change translation. */

export const CARE_CONTEXT_DIFF_IDENTITY =
  "CareContextDiff is the continuous translation of evolving CareContext into human-understandable change.";

export const CARE_CONTEXT_DIFF_DEFINING_PRINCIPLE =
  "Humans do not understand CareContext. Humans understand differences in CareContext.";

export const CARE_CONTEXT_DIFF_SECTIONS = [
  "factual_delta",
  "directional_change",
  "newly_important",
  "lost_confidence",
  "stabilized",
  "system_interpretation",
] as const;

export const CHANGE_CATEGORIES = [
  "behavior_change",
  "mobility",
  "nighttime_event",
  "medication",
  "crisis",
  "caregiver_burden",
  "progression",
  "new_symptom",
  "care_level",
  "other",
] as const;

export const CARE_CONTEXT_DIFF_DESIGN_RULES = [
  "interpreted_change_not_raw_log",
  "contextual_not_absolute",
  "no_attribution_exposure",
  "time_aware_relative_framing",
  "importance_weighting_required",
] as const;

export const CATEGORY_PATTERNS: { category: (typeof CHANGE_CATEGORIES)[number]; pattern: RegExp }[] = [
  { category: "behavior_change", pattern: /\b(wander(?:ing)?|agitat(?:ed|ion)?|confus(?:ed|ion)?)\b/i },
  { category: "mobility", pattern: /\b(fell|fall|mobility|walk(?:ing|er)?|wheelchair|unsteady|near.?fall)\b/i },
  { category: "nighttime_event", pattern: /\b(night|overnight|midnight|evening|sundown(?:ing)?|sleep)\b/i },
  { category: "medication", pattern: /\b(medication|med|pill|dose|prescription|insulin)\b/i },
  { category: "crisis", pattern: /\b(emergency|er\b|hospital|911|crisis|urgent)\b/i },
  { category: "caregiver_burden", pattern: /\b(exhaust(?:ed|ion)|burn(?:out|ed)|overwhelm(?:ed)?|can't cope)\b/i },
  { category: "progression", pattern: /\b(worse|worsening|declin(?:e|ing)|progress(?:ion|ing))\b/i },
  { category: "new_symptom", pattern: /\b(pain|headache|fever|nausea|appetite|symptom|ache)\b/i },
  { category: "care_level", pattern: /\b(24\s*\/\s*7|professional care|nursing|memory care|supervision)\b/i },
];

export const IMPROVEMENT_SIGNALS =
  /\b(better|improved|improving|recovering|appetite returned|more active|stable day)\b/i;

export const DETERIORATION_SIGNALS =
  /\b(worse|worsening|declin(?:e|ing)|reduced appetite|less active|weaker|new symptom|fell|agitat(?:ed|ion))\b/i;
