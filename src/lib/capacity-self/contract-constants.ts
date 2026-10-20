export const CAPACITY_SELF_IDENTITY =
  "Switching cost, variable capacity, and caregiver erasure — not urgency ranking.";

export const CAPACITY_MATCHED_NOTE =
  "Capacity-matched suggestion — a smaller step that still moves something forward. This is not the top priority.";

export const VALUES_CAPTURE_ROADMAP = {
  status: "planned_not_v1" as const,
  intent:
    "Quiet occasional capture of what the care recipient wants for future decisions — calm moments only, never advance-directive form, never SolenOS decision-making.",
  anti_patterns: [
    "one_time_intake_form",
    "permanently_authoritative_questionnaire",
    "solenos_suggests_decisions_from_values",
  ],
} as const;

export const DEFAULT_CAREGIVER_ID = "default_caregiver";

export const CONTEXT_LABELS: Record<string, string> = {
  phone_call: "Phone calls this week",
  home_repair: "Home repair this week",
  medical: "Medical this week",
  financial: "Financial this week",
  errand: "Errands this week",
  other: "Other this week",
};
