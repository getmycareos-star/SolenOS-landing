/** Forbidden Build Zone — features that do not improve care record truth are out of scope. */

export const FORBIDDEN_BUILD_ZONE_IDENTITY =
  "If a feature does not move SolenOS closer to becoming the system of record for care reality, it must not exist.";

export const FORBIDDEN_BUILD_ZONE_DEFINING_PRINCIPLE =
  "SolenOS is strictly a state-driven care system — not chat, dashboards, scheduling, personas, onboarding, or marketplaces.";

export const FORBIDDEN_FEATURE_CATEGORIES = [
  "chat_system",
  "scheduling_calendar_ui",
  "ai_assistant_persona",
  "generic_health_dashboard",
  "long_onboarding_forms",
  "care_marketplaces",
  "symptom_checker",
  "dementia_faq_assistant",
  "generic_health_chatbot",
  "medical_recommendation_engine",
  "answer_engine_optimization",
  "document_vault_primary",
  "task_manager_primary",
  "reminder_app_primary",
  "family_coordination_platform",
  "generic_communication_assistant",
  "gamified_care_scores",
] as const;

export const FORBIDDEN_FEATURES: Record<
  (typeof FORBIDDEN_FEATURE_CATEGORIES)[number],
  { label: string; reason: string; prohibited: readonly string[] }
> = {
  chat_system: {
    label: "Chat System",
    reason: "Does not create structured truth; increases noise",
    prohibited: [
      "internal chat UI",
      "caregiver-to-caregiver messaging",
      "AI chat assistant interface",
    ],
  },
  scheduling_calendar_ui: {
    label: "Scheduling / Calendar UI",
    reason: "Assumes clean planning; caregivers operate in chaos",
    prohibited: ["calendar views", "agenda builders", "reminder timelines as primary UX"],
  },
  ai_assistant_persona: {
    label: "AI Assistant Persona",
    reason: "Illusion of intelligence without traceability",
    prohibited: ["Ask SolenOS", "conversational caregiver assistant", "personality-driven AI layer"],
  },
  generic_health_dashboard: {
    label: "Generic Health Dashboards",
    reason: "Static summaries hide contradictions and uncertainty",
    prohibited: ["KPI-style health cards", "static overview dashboards", "aggregated wellness scores"],
  },
  long_onboarding_forms: {
    label: "Long Onboarding Forms",
    reason: "Structured input requirement kills adoption",
    prohibited: [
      "multi-step onboarding flows",
      "required patient setup forms",
      "structured intake before value",
      "signup wizard",
      "profile setup before first value",
    ],
  },
  care_marketplaces: {
    label: "Care Marketplaces",
    reason: "Network complexity before core system exists",
    prohibited: ["caregiver hiring platforms", "nurse matching systems", "service directories"],
  },
  symptom_checker: {
    label: "Symptom Checker",
    reason: "Generic symptom matching does not understand this person's care reality",
    prohibited: [
      "symptom checker UI",
      "symptom-to-condition mapping",
      "self-diagnosis flows",
      "health symptom quiz",
    ],
  },
  dementia_faq_assistant: {
    label: "Dementia FAQ Assistant",
    reason: "Generic education does not answer what is happening with this person",
    prohibited: [
      "dementia FAQ chatbot",
      "why does dementia cause X responses",
      "generic condition education layer",
      "symptom encyclopedia",
    ],
  },
  generic_health_chatbot: {
    label: "Generic Health Chatbot",
    reason: "Chat-style health advice increases cognitive load without person-specific context",
    prohibited: [
      "health chatbot interface",
      "medical Q&A assistant",
      "general health advice bot",
    ],
  },
  medical_recommendation_engine: {
    label: "Medical Recommendation Engine",
    reason: "Treatment recommendations exceed SolenOS scope and erode clinical trust",
    prohibited: [
      "medical treatment recommendations",
      "medication dosage advice",
      "clinical intervention suggestions",
      "diagnosis engine",
    ],
  },
  answer_engine_optimization: {
    label: "Answer Engine Optimization",
    reason:
      "Fails North Star — optimizes answering questions instead of eliminating need to reconstruct memory",
    prohibited: [
      "ask me anything caregiver bot",
      "search-style Q&A as primary UX",
      "answer engine for caregiver questions",
      "FAQ response generator as product core",
    ],
  },
  document_vault_primary: {
    label: "Document Vault Primary",
    reason: "Documentation is input; understanding is the product",
    prohibited: [
      "document folder primary UX",
      "file management as product identity",
      "voice note to transcript only",
      "document summary without care change",
    ],
  },
  task_manager_primary: {
    label: "Task Manager Primary",
    reason: "Tasks answer what to do; SolenOS answers what is happening and why it matters",
    prohibited: [
      "checklist primary UX",
      "task dashboard",
      "overdue task notifications as core loop",
      "productivity metrics for caregivers",
    ],
  },
  reminder_app_primary: {
    label: "Reminder App Primary",
    reason: "Reminders do not preserve care continuity or reduce memory reconstruction",
    prohibited: [
      "medication reminder as primary product",
      "calendar reminder core loop",
      "nudge notifications as identity",
    ],
  },
  family_coordination_platform: {
    label: "Family Coordination Platform",
    reason: "Shared visibility without understanding creates more coordination work",
    prohibited: [
      "family chat as primary UX",
      "caregiver messaging platform",
      "social feed for care updates",
    ],
  },
  generic_communication_assistant: {
    label: "Generic Communication Assistant",
    reason:
      "Communication must come from Care Reality Engine — shared context, not opinion templates",
    prohibited: [
      "AI message writer without care context",
      "communication coach chatbot",
      "help me write a text primary UX",
      "persuasion templates for family conflict",
    ],
  },
  gamified_care_scores: {
    label: "Gamified Care Scores",
    reason:
      "Care understanding confidence is clarity about gaps — not performance measurement",
    prohibited: [
      "caregiving confidence percentage",
      "care health score",
      "caregiver performance rating",
      "wellness score for care",
      "badges streaks leaderboards for caregivers",
    ],
  },
};

export const ACCEPTABLE_BUILD_SURFACE = [
  "input_ingestion",
  "event_extraction",
  "care_state_engine",
  "current_state_view",
] as const;

export const BUILD_FILTER_QUESTION =
  "Does this reduce the caregiver's need to reconstruct the care journey from memory?";

/** Prohibited copy patterns in system output */
export const FORBIDDEN_OUTPUT_PATTERNS = [
  /\bhow can i help\b/i,
  /\bhi there[!]? i'm\b/i,
  /\bwelcome to solenos\b/i,
  /\blet'?s get started with setup\b/i,
  /\bcomplete your profile\b/i,
  /\bstep \d+ of \d+\b/i,
  /\bask solenos\b/i,
  /\bcheck in daily\b/i,
  /\bgamif/i,
  /\bwellness score\b/i,
  /\bKPI\b/,
  /\bsymptom of dementia\b/i,
  /\bcan be a sign of\b/i,
  /\bcommonly seen in (?:dementia|alzheimer)/i,
  /\brepetitive questions are common\b/i,
  /\bthis is normal for (?:dementia|alzheimer|aging)\b/i,
  /\bin people with dementia\b/i,
  /\btypical (?:dementia|alzheimer) (?:symptom|behavior)\b/i,
  /\byour caregiving confidence:\s*\d+\s*%/i,
  /\bcare health score:\s*\d+/i,
  /\bcaregiver (?:score|rating):\s*\d+/i,
  /\bthis is caused by dementia\b/i,
  /\byou should (?:take|start|stop|increase|decrease) (?:the )?medication\b/i,
  /\bask me anything\b/i,
  /\bi('m| am) (?:an? )?ai (?:assistant|doctor|therapist)\b/i,
] as const;

export const FORBIDDEN_BUILD_RULES = [
  "no_chat_system",
  "no_scheduling_primary_ux",
  "no_ai_persona",
  "no_generic_dashboard",
  "no_onboarding_wizard",
  "no_marketplace",
  "no_symptom_checker",
  "no_dementia_faq",
  "no_generic_health_chatbot",
  "no_medical_recommendation_engine",
  "no_answer_engine_optimization",
  "no_document_vault_primary",
  "no_task_manager_primary",
  "no_reminder_app_primary",
  "no_family_coordination_platform",
  "no_generic_communication_assistant",
  "no_gamified_care_scores",
  "must_pass_build_filter",
  "must_pass_north_star_test",
] as const;
