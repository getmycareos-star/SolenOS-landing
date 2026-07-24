import type {
  CaregiverFailureCategory,
  FailureDefinition,
  FailureFirstMapping,
  SolenOSEngine,
} from "./failure-model-types";

/**
 * Canonical failure → engine mapping.
 * Every engine exists because it eliminates a specific failure.
 * If an engine cannot be tied to a real caregiver failure, it is not MVP.
 */
export const FAILURE_ENGINE_MAP: FailureDefinition[] = [
  {
    category: "memory_reconstruction_failure",
    label: "Memory failure",
    description: "Caregiver must reconstruct what happened from personal memory.",
    engines: ["timeline_reconstruction", "immutable_care_events"],
    continuityCanEliminate: true,
  },
  {
    category: "invisible_progression",
    label: "Progression invisible",
    description: "Caregiver cannot reliably recognize change over time.",
    engines: ["diff_engine", "state_of_care", "pattern_learning_engine"],
    continuityCanEliminate: true,
  },
  {
    category: "fragmented_observations",
    label: "Fragmented observations",
    description: "Events exist but are not unified into CareContext.",
    engines: ["care_context", "timeline_reconstruction"],
    continuityCanEliminate: true,
  },
  {
    category: "contradictory_reports",
    label: "Contradictory reports",
    description: "Family members or notes conflict without resolution.",
    engines: ["contradiction_detection", "care_context"],
    continuityCanEliminate: true,
  },
  {
    category: "missing_information",
    label: "Missing information",
    description: "Critical gaps block meaningful recommendations.",
    engines: ["clarification_engine", "uncertainty_layer"],
    continuityCanEliminate: true,
  },
  {
    category: "decision_overload",
    label: "Decision overload",
    description: "Too many decisions without adequate context.",
    engines: ["prioritization_engine", "attention_budget"],
    continuityCanEliminate: true,
  },
  {
    category: "caregiver_cognitive_overload",
    label: "Cognitive overload",
    description: "Caregiver carrying too much mental load.",
    engines: [
      "caregiver_load_engine",
      "attention_budget",
      "return_value_loop",
    ],
    continuityCanEliminate: true,
  },
  {
    category: "low_trust",
    label: "Low trust",
    description: "Caregiver cannot verify why recommendations exist.",
    engines: ["care_transparency_panel", "trust_layer", "confidence_layer"],
    continuityCanEliminate: true,
  },
  {
    category: "returning_after_absence",
    label: "Returning after absence",
    description: "Caregiver missed events and must catch up.",
    engines: ["return_value_loop", "diff_engine", "timeline_reconstruction"],
    continuityCanEliminate: true,
  },
  {
    category: "no_objective_view",
    label: "No objective view",
    description: "No shared understanding of evolving care situation.",
    engines: [
      "state_of_care",
      "care_transparency_panel",
      "caregiver_load_engine",
      "confidence_layer",
    ],
    continuityCanEliminate: true,
  },
  {
    category: "decision_without_context",
    label: "Decision without context",
    description: "Major care decisions made without longitudinal evidence.",
    engines: [
      "diff_engine",
      "state_of_care",
      "caregiver_load_engine",
      "pattern_learning_engine",
    ],
    continuityCanEliminate: true,
  },
  {
    category: "no_context_for_change",
    label: "No context for change",
    description: "Behavior changes cannot be interpreted against history.",
    engines: [
      "timeline_reconstruction",
      "diff_engine",
      "pattern_learning_engine",
      "uncertainty_layer",
    ],
    continuityCanEliminate: true,
  },
  {
    category: "information_not_eliminable_by_continuity",
    label: "Information-only demand",
    description: "Insurance, eligibility, costs — continuity cannot eliminate.",
    engines: [],
    continuityCanEliminate: false,
  },
];

/** Failure-first question mappings from product directive. */
export const FAILURE_FIRST_MAP: FailureFirstMapping[] = [
  {
    exampleQuestion: "Is it time for 24/7 care?",
    questionPatterns: [
      /\b(24\s*\/\s*7|round the clock|time for (?:full|more) care)\b/i,
      /\b(is it time for)\b/i,
    ],
    failureCategory: "invisible_progression",
    failureLabel: "Invisible progression",
    productResponse: [
      "timeline_reconstruction",
      "diff_engine",
      "state_of_care",
      "pattern_learning_engine",
    ],
    notAbout: "24/7 care options — it is evidence caregivers cannot recognize progression over time.",
    continuityCanEliminate: true,
  },
  {
    exampleQuestion: "Am I doing enough?",
    questionPatterns: [
      /\b(am i doing enough|doing enough|is this enough)\b/i,
    ],
    failureCategory: "no_objective_view",
    failureLabel: "No objective view of evolving care situation",
    productResponse: [
      "state_of_care",
      "care_transparency_panel",
      "caregiver_load_engine",
      "confidence_layer",
    ],
    notAbout: "Moral judgment — it is evidence of no objective view of the care situation.",
    continuityCanEliminate: true,
  },
  {
    exampleQuestion: "I can't remember what happened at the last appointment.",
    questionPatterns: [
      /\b(can't remember what happened|cannot remember what happened)\b/i,
      /\b(last appointment|what happened at)\b/i,
    ],
    failureCategory: "memory_reconstruction_failure",
    failureLabel: "Memory reconstruction failure",
    productResponse: [
      "immutable_care_events",
      "timeline_reconstruction",
      "visit_summaries",
      "clinician_reports",
    ],
    notAbout: "Better memory — it is evidence the system failed to maintain care memory.",
    continuityCanEliminate: true,
  },
  {
    exampleQuestion: "Should I hire professional help?",
    questionPatterns: [
      /\b(hir(?:e|ing) professional help|should i hire|professional care)\b/i,
    ],
    failureCategory: "decision_without_context",
    failureLabel: "Decision without sufficient longitudinal context",
    productResponse: [
      "diff_engine",
      "caregiver_load_engine",
      "state_of_care",
      "pattern_learning_engine",
    ],
    notAbout: "An opinion on hiring — it is evidence of missing connected longitudinal context.",
    continuityCanEliminate: true,
  },
  {
    exampleQuestion: "Is this behavior normal?",
    questionPatterns: [
      /\b(is this (?:behavior )?normal|normal for|is this okay)\b/i,
      /\b(is this getting worse)\b/i,
    ],
    failureCategory: "no_context_for_change",
    failureLabel: "No context for interpreting change",
    productResponse: [
      "timeline_reconstruction",
      "diff_engine",
      "pattern_learning_engine",
      "uncertainty_layer",
    ],
    notAbout: "A medical norm reference — it is evidence of no historical context for this change.",
    continuityCanEliminate: true,
  },
  {
    exampleQuestion: "I'm overwhelmed.",
    questionPatterns: [
      /\b(overwhelm(?:ed)?|i'm overwhelmed|can't cope|too much)\b/i,
    ],
    failureCategory: "caregiver_cognitive_overload",
    failureLabel: "Caregiver cognitive overload",
    productResponse: [
      "attention_budget",
      "prioritization_engine",
      "return_value_loop",
      "caregiver_load_engine",
    ],
    notAbout: "Emotional support chat — it is evidence of unsustainable cognitive load.",
    continuityCanEliminate: true,
  },
  {
    exampleQuestion: "Does Medicare cover dementia care?",
    questionPatterns: [
      /\b(medicare|medicaid|insurance|cover(?:age)?|eligible|cost)\b/i,
    ],
    failureCategory: "information_not_eliminable_by_continuity",
    failureLabel: "Information demand — not a continuity failure",
    productResponse: [],
    notAbout: "Core product — belongs in educational content, not continuity engines.",
    continuityCanEliminate: false,
  },
];

export function matchFailureFirst(question: string): FailureFirstMapping[] {
  return FAILURE_FIRST_MAP.filter((m) =>
    m.questionPatterns.some((re) => re.test(question)),
  );
}

export function primaryFailureMapping(
  question: string,
): FailureFirstMapping | undefined {
  return matchFailureFirst(question)[0];
}

export function enginesForFailure(
  category: CaregiverFailureCategory,
): SolenOSEngine[] {
  return (
    FAILURE_ENGINE_MAP.find((f) => f.category === category)?.engines ?? []
  );
}

export function failureDefinition(
  category: CaregiverFailureCategory,
): FailureDefinition | undefined {
  return FAILURE_ENGINE_MAP.find((f) => f.category === category);
}
