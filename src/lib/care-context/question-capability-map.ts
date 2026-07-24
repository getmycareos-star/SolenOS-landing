import type { QuestionCapabilityMapping } from "./failure-model-types";

/**
 * Question → capability map (legacy path).
 * Prefer classifyCaregiverFailure() for failure-first classification.
 */
export const QUESTION_CAPABILITY_MAP: QuestionCapabilityMapping[] = [
  {
    label: "Is this getting worse?",
    questionPatterns: [
      /\b(getting worse|is this worse|declin(?:e|ing)|deteriorat)\b/i,
      /\b(is (?:this|it|he|she|dad|mom) (?:getting )?worse)\b/i,
      /\b(is this normal)\b/i,
    ],
    missingCapabilities: ["diff_engine", "timeline_reconstruction", "state_of_care"],
    buildNotAnswer: "A longer AI explanation of whether things are worsening",
    continuityFailure: "missing_progression_view",
    continuityFailureDescription:
      "No system compares current observations against historical CareContext to detect progression.",
    failureCategory: "invisible_progression",
  },
  {
    label: "What should I do next?",
    questionPatterns: [
      /\b(what should i do|what do i do|what's next|what should happen)\b/i,
      /\b(what matters now)\b/i,
    ],
    missingCapabilities: ["prioritization_engine", "state_of_care", "trust_layer"],
    buildNotAnswer: "A generic list of caregiving advice",
    continuityFailure: "missing_prioritization",
    continuityFailureDescription:
      "No prioritized actions derived from evolving CareContext — caregiver must decide blindly.",
    failureCategory: "decision_overload",
  },
  {
    label: "Am I forgetting something?",
    questionPatterns: [
      /\b(forgetting something|am i forgetting|did i miss|missing something)\b/i,
      /\b(can't remember|cannot remember|don't remember what happened)\b/i,
      /\b(everything is mixed up|losing track)\b/i,
    ],
    missingCapabilities: [
      "care_context",
      "return_value_loop",
      "timeline_reconstruction",
      "immutable_care_events",
    ],
    buildNotAnswer: "A reminder app or checklist",
    continuityFailure: "no_maintained_memory",
    continuityFailureDescription:
      "No continuously maintained CareContext — caregiver must reconstruct reality from memory.",
    failureCategory: "memory_reconstruction_failure",
  },
  {
    label: "Should I worry?",
    questionPatterns: [
      /\b(should i worry|should i be concerned|is this serious|how worried)\b/i,
      /\b(is this enough|am i doing enough)\b/i,
    ],
    missingCapabilities: [
      "state_of_care",
      "trust_layer",
      "confidence_layer",
      "care_transparency_panel",
    ],
    buildNotAnswer: "Reassurance text or risk percentages from an LLM",
    continuityFailure: "missing_confidence_model",
    continuityFailureDescription:
      "No evidence-based confidence model — caregiver lacks appropriate (not false) certainty.",
    failureCategory: "no_objective_view",
  },
  {
    label: "What do I tell the doctor?",
    questionPatterns: [
      /\b(tell the doctor|what do i say|explain to (?:the )?doctor|appointment prep)\b/i,
      /\b(what happened at|last appointment|what should i tell)\b/i,
    ],
    missingCapabilities: [
      "clinical_summary_generator",
      "timeline_reconstruction",
      "visit_summaries",
      "clinician_reports",
    ],
    buildNotAnswer: "A chatbot-generated doctor visit script",
    continuityFailure: "missing_clinical_summary",
    continuityFailureDescription:
      "Observations exist but are not organized into structured chronological summaries.",
    failureCategory: "memory_reconstruction_failure",
  },
  {
    label: "Should I hire professional help?",
    questionPatterns: [
      /\b(hir(?:e|ing) (?:professional )?help|professional care|time for help)\b/i,
      /\b(should i get (?:a )?caregiver|need more help|24\s*\/\s*7)\b/i,
    ],
    missingCapabilities: [
      "diff_engine",
      "caregiver_load_engine",
      "state_of_care",
      "pattern_learning_engine",
    ],
    buildNotAnswer: "An opinion on whether to hire help",
    continuityFailure: "disconnected_events",
    continuityFailureDescription:
      "Falls, mobility, exhaustion, wandering, and medication changes exist but nobody connected them into a coherent picture.",
    failureCategory: "decision_without_context",
  },
  {
    label: "What changed?",
    questionPatterns: [
      /\b(what changed|something changed|things keep changing|what's different)\b/i,
    ],
    missingCapabilities: ["diff_engine", "timeline_reconstruction"],
    buildNotAnswer: "A summary paragraph regenerated on each ask",
    continuityFailure: "fragmented_timeline",
    continuityFailureDescription:
      "Events are recorded but change detection is not maintained — caregiver must diff mentally.",
    failureCategory: "no_context_for_change",
  },
  {
    label: "What can wait?",
    questionPatterns: [/\b(what can wait|can this wait|urgent or not)\b/i],
    missingCapabilities: ["prioritization_engine", "attention_budget"],
    buildNotAnswer: "Priority labels assigned by an LLM without context",
    continuityFailure: "missing_prioritization",
    continuityFailureDescription:
      "No urgency separation derived from CareContext — everything feels equally pressing.",
    failureCategory: "decision_overload",
  },
  {
    label: "I'm overwhelmed",
    questionPatterns: [
      /\b(overwhelm(?:ed)?|i'm overwhelmed|can't cope|too much)\b/i,
    ],
    missingCapabilities: [
      "attention_budget",
      "prioritization_engine",
      "return_value_loop",
      "caregiver_load_engine",
    ],
    buildNotAnswer: "Therapeutic chat or motivational text",
    continuityFailure: "missing_prioritization",
    continuityFailureDescription:
      "Caregiver cognitive overload — system has not reduced what demands attention.",
    failureCategory: "caregiver_cognitive_overload",
  },
];

export const HIRE_HELP_IMPLIED_CONTEXT = [
  "Increasing falls",
  "Worsening mobility",
  "Growing caregiver exhaustion",
  "Nighttime wandering",
  "Medication changes",
  "Cognitive decline signals",
  "Increasing supervision demand",
] as const;

export function matchQuestionToCapabilities(question: string) {
  return QUESTION_CAPABILITY_MAP.filter((m) =>
    m.questionPatterns.some((re) => re.test(question)),
  );
}

export function primaryCapabilityMapping(question: string) {
  return matchQuestionToCapabilities(question)[0];
}
