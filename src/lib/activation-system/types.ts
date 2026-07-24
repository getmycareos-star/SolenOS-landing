/** SolenOS Activation System — habit formation without gamification. */

export const ACTIVATION_EVENT_TYPES = [
  "ENTRY_CREATED",
  "VOICE_ENTRY_CREATED",
  "DOCUMENT_UPLOADED",
  "RESPONSE_GENERATED",
  "RETURN_SESSION",
  "PROMPT_OPENED",
  "PROMPT_DISMISSED",
  "PROMPT_RESPONDED",
] as const;

export type ActivationEventType = (typeof ACTIVATION_EVENT_TYPES)[number];

export const TRUST_STAGES = ["early", "building", "established"] as const;
export type TrustStage = (typeof TRUST_STAGES)[number];

export const CONTEXTUAL_PROMPT_TYPES = [
  "appointment",
  "resolution",
  "habit_window",
  "reengagement",
] as const;

export type ContextualPromptType = (typeof CONTEXTUAL_PROMPT_TYPES)[number];

export type ActivationEvent = {
  id: string;
  user_id: string;
  event_type: ActivationEventType;
  payload: Record<string, unknown>;
  created_at: string;
};

export type ActivationUserState = {
  user_id: string;
  total_entries: number;
  first_entry_at: string | null;
  last_entry_at: string | null;
  voice_entry_count: number;
  document_entry_count: number;
  trust_stage: TrustStage;
  habit_hour: number | null;
  updated_at: string;
};

export type ContextualPrompt = {
  id: string;
  type: ContextualPromptType;
  message: string;
  trust_stage: TrustStage;
};

export type ActivationSessionContext = {
  user_id: string;
  trust_stage: TrustStage;
  total_entries: number;
  is_return_session: boolean;
  days_since_last_entry: number | null;
  prompt: ContextualPrompt | null;
  reengagement_message: string | null;
  show_optional_context: boolean;
};

export type UserActivationMetrics = {
  entries_per_week: number;
  entries_per_month: number;
  days_between_entries: number | null;
  voice_usage_rate: number;
  document_usage_rate: number;
  week1_retention: boolean | null;
  week4_retention: boolean | null;
  week8_retention: boolean | null;
  trust_stage: TrustStage;
};

export type DashboardActivationMetrics = {
  daily_active_users: number;
  weekly_active_users: number;
  average_entries_per_user: number;
  return_rate: number;
  trust_stage_distribution: Record<TrustStage, number>;
  total_events: number;
};

export type RecordActivationEventInput = {
  user_id: string;
  event_type: ActivationEventType;
  payload?: Record<string, unknown>;
  created_at?: string;
};
