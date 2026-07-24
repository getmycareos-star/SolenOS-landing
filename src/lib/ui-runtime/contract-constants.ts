/** UI Runtime — situation-centric operational surface (not chat / dashboard). */

export const UI_RUNTIME_IDENTITY =
  "solenos — the trusted place where a person's care journey lives";

export const UI_RUNTIME_ONE_LINE_TRUTH =
  "User Input → Context → Memory → Time → Priority → Conflict → Action → Safety → Output Assembly → Replace Decision Card → Append Timeline → Update Situation";

export const UI_EVENT_LOOP_STAGES = [
  "user_input",
  "context",
  "memory",
  "time",
  "priority",
  "conflict",
  "action",
  "safety",
  "output_assembly",
  "replace_decision_card",
  "append_timeline",
  "update_situation",
] as const;

export const DECISION_RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;

export const SITUATION_STATUSES = ["active", "blocked", "waiting", "resolved"] as const;

export const TIMELINE_ENTRY_TYPES = [
  "decision",
  "document",
  "correction",
  "system_event",
  "demand_completed",
] as const;

export const DOCUMENT_SOURCE_TYPES = ["medical", "insurance", "benefits", "other"] as const;

export const SIDEBAR_SECTION_IDS = [
  "active_situations",
  "observations",
  "care_profile",
  "care_context",
  "timeline",
  "memory",
  "documents",
  "responsibility_graph",
  "safety_settings",
  "system_settings",
  "feedback_corrections",
  "system_health",
  "about_solenos",
] as const;

/** Caregiver-facing nav — Living Care Record + continuity only (not ops console). */
export const CAREGIVER_SIDEBAR_SECTION_IDS = [
  "active_situations",
  "timeline",
  "about_solenos",
] as const satisfies readonly (typeof SIDEBAR_SECTION_IDS)[number][];

/** Ops / instrumentation sections — gated behind OPS_SECRET. */
export const OPS_SIDEBAR_SECTION_IDS = [
  "observations",
  "care_profile",
  "care_context",
  "memory",
  "documents",
  "responsibility_graph",
  "safety_settings",
  "system_settings",
  "feedback_corrections",
  "system_health",
] as const satisfies readonly (typeof SIDEBAR_SECTION_IDS)[number][];

export const SIDEBAR_SECTION_LABELS: Record<(typeof SIDEBAR_SECTION_IDS)[number], string> = {
  active_situations: "Active Situations",
  observations: "Observations",
  care_profile: "Care Profile",
  care_context: "Care Context",
  timeline: "Timeline",
  memory: "Memory",
  documents: "Documents",
  responsibility_graph: "Responsibility Graph",
  safety_settings: "Safety Settings",
  system_settings: "System Settings",
  feedback_corrections: "Feedback & Corrections",
  system_health: "System Health",
  about_solenos: "About SolenOS",
};

/** Plain-language caregiver labels (ops keeps SIDEBAR_SECTION_LABELS). */
export const CAREGIVER_SIDEBAR_SECTION_LABELS: Record<
  (typeof CAREGIVER_SIDEBAR_SECTION_IDS)[number],
  string
> = {
  active_situations: "Open situations",
  timeline: "Care timeline",
  about_solenos: "About SolenOS",
};

export const FEEDBACK_CORRECTION_KINDS = [
  "incorrect_assumption",
  "outdated_context",
  "bad_recommendation",
  "missing_information",
] as const;

export const FORBIDDEN_UI_PATTERNS = [
  "chat bubbles",
  "conversation threads",
  "assistant personas",
  "infinite feeds",
  "dashboards",
  "KPI screens",
  "gamification",
  "engagement loops",
] as const;

export const UI_RUNTIME_DESIGN_PRINCIPLE =
  "Caregiver chrome is Living Care Record continuity — ops instrumentation stays behind an ops gate";

export const TIMELINE_STORAGE_KEY = "solenos_ui_timeline_v1";
export const SITUATIONS_STORAGE_KEY = "solenos_ui_situations_v1";
export const ACTIVE_SITUATION_STORAGE_KEY = "solenos_ui_active_situation_id";
