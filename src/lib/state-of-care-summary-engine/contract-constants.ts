/** State of Care Summary Engine — decision-ready compression of CareContext. */

export const STATE_OF_CARE_SUMMARY_IDENTITY =
  "State of Care is the continuously regenerated, decision-ready abstraction of a CareContext.";

export const STATE_OF_CARE_DEFINING_PRINCIPLE =
  "CareContext is the full memory. State of Care is the compressed intelligence layer.";

export const STATE_OF_CARE_SECTIONS = [
  "what_is_happening_now",
  "what_changed_recently",
  "what_needs_attention",
  "what_is_stable",
  "what_remains_uncertain",
  "what_should_happen_next",
] as const;

export const STATE_OF_CARE_DESIGN_RULES = [
  "always_recomputed_never_user_edited",
  "reflect_change_not_repetition",
  "uncertainty_must_be_visible",
  "prioritization_mandatory",
  "no_raw_attribution",
  "time_bound_snapshot",
] as const;

export const IMPROVEMENT_SIGNALS =
  /\b(better|improved|improving|recovering|appetite returned|more active|stable day)\b/i;

export const DETERIORATION_SIGNALS =
  /\b(worse|worsening|declin(?:e|ing)|reduced appetite|less active|weaker|new symptom|fell|agitat(?:ed|ion))\b/i;

export const DOMAIN_PATTERNS = [
  { domain: "mobility", pattern: /\b(fell|fall|mobility|walk(?:er|ing)?|wheelchair|unsteady)\b/i },
  { domain: "appetite", pattern: /\b(appetite|eating|meal|food intake)\b/i },
  { domain: "sleep", pattern: /\b(sleep|insomnia|restless|nighttime|overnight)\b/i },
  { domain: "medication", pattern: /\b(medication|med|pill|dose|prescription)\b/i },
  { domain: "behavior", pattern: /\b(agitat(?:ed|ion)|confus(?:ed|ion)|wander(?:ing)?)\b/i },
] as const;
