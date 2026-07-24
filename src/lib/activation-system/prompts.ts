import { randomUUID } from "node:crypto";

import {
  APPOINTMENT_PROMPT,
  HABIT_WINDOW_HOUR_TOLERANCE,
  HABIT_WINDOW_MIN_ENTRIES,
  HABIT_WINDOW_PROMPT_DEFAULT,
  HABIT_WINDOW_PROMPT_EVENING,
  HABIT_WINDOW_PROMPT_MORNING,
  REENGAGEMENT_INACTIVE_DAYS,
  REENGAGEMENT_MESSAGES,
  RESOLUTION_PROMPT,
} from "./contract-constants";
import { computeTrustStage, trustStageAllowsOptionalContext } from "./trust-progression";
import type {
  ActivationSessionContext,
  ActivationUserState,
  ContextualPrompt,
  ContextualPromptType,
} from "./types";

const APPOINTMENT_KEYWORDS =
  /\b(appointment|doctor|clinic|visit|specialist|discharge|follow[- ]?up)\b/i;

const RESOLUTION_KEYWORDS =
  /\b(resolved|sorted|handled|done|fixed|taken care of|no longer worried)\b/i;

function daysBetween(a: Date, b: Date): number {
  return Math.floor(Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function pickReengagementMessage(userId: string): string {
  const hash = userId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return REENGAGEMENT_MESSAGES[hash % REENGAGEMENT_MESSAGES.length]!;
}

export function computeHabitHour(entryHours: number[]): number | null {
  if (entryHours.length < HABIT_WINDOW_MIN_ENTRIES) return null;

  const buckets = new Map<number, number>();
  for (const hour of entryHours) {
    buckets.set(hour, (buckets.get(hour) ?? 0) + 1);
  }

  let bestHour: number | null = null;
  let bestCount = 0;
  for (const [hour, count] of buckets) {
    if (count > bestCount) {
      bestCount = count;
      bestHour = hour;
    }
  }

  return bestCount >= HABIT_WINDOW_MIN_ENTRIES ? bestHour : null;
}

export function habitWindowPromptForHour(hour: number): string {
  if (hour >= 17 || hour <= 5) return HABIT_WINDOW_PROMPT_EVENING;
  if (hour >= 5 && hour < 12) return HABIT_WINDOW_PROMPT_MORNING;
  return HABIT_WINDOW_PROMPT_DEFAULT;
}

export function isWithinHabitWindow(now: Date, habitHour: number): boolean {
  const currentHour = now.getHours();
  const diff = Math.abs(currentHour - habitHour);
  return diff <= HABIT_WINDOW_HOUR_TOLERANCE || diff >= 24 - HABIT_WINDOW_HOUR_TOLERANCE;
}

export type PromptSelectionInput = {
  user_id: string;
  state: ActivationUserState;
  now?: Date;
  last_input_snippet?: string | null;
  prior_follow_up_count?: number | null;
  dismissed_prompt_ids?: string[];
};

function buildPrompt(
  type: ContextualPromptType,
  message: string,
  trustStage: ActivationUserState["trust_stage"],
): ContextualPrompt {
  return {
    id: `${type}_${Date.now()}`,
    type,
    message,
    trust_stage: trustStage,
  };
}

export function selectContextualPrompt(input: PromptSelectionInput): ContextualPrompt | null {
  const now = input.now ?? new Date();
  const dismissed = new Set(input.dismissed_prompt_ids ?? []);
  const trustStage = input.state.trust_stage;

  if (!trustStageAllowsOptionalContext(trustStage)) {
    return null;
  }

  if (input.state.last_entry_at) {
    const daysSince = daysBetween(now, new Date(input.state.last_entry_at));
    if (daysSince >= REENGAGEMENT_INACTIVE_DAYS) {
      const prompt = buildPrompt(
        "reengagement",
        pickReengagementMessage(input.user_id),
        trustStage,
      );
      return dismissed.has(prompt.type) ? null : prompt;
    }
  }

  if (
    input.state.habit_hour != null &&
    isWithinHabitWindow(now, input.state.habit_hour) &&
    input.state.total_entries >= HABIT_WINDOW_MIN_ENTRIES
  ) {
    const prompt = buildPrompt(
      "habit_window",
      habitWindowPromptForHour(input.state.habit_hour),
      trustStage,
    );
    if (!dismissed.has(prompt.type)) return prompt;
  }

  const snippet = input.last_input_snippet ?? "";
  if (APPOINTMENT_KEYWORDS.test(snippet)) {
    const prompt = buildPrompt("appointment", APPOINTMENT_PROMPT, trustStage);
    if (!dismissed.has(prompt.type)) return prompt;
  }

  if (
    RESOLUTION_KEYWORDS.test(snippet) ||
    (input.prior_follow_up_count === 0 && input.state.total_entries >= 5)
  ) {
    const prompt = buildPrompt("resolution", RESOLUTION_PROMPT, trustStage);
    if (!dismissed.has(prompt.type)) return prompt;
  }

  return null;
}

export function buildActivationSessionContext(params: {
  user_id: string;
  state: ActivationUserState;
  is_return_session?: boolean;
  last_input_snippet?: string | null;
  prior_follow_up_count?: number | null;
  dismissed_prompt_ids?: string[];
  now?: Date;
}): ActivationSessionContext {
  const now = params.now ?? new Date();
  const daysSinceLast = params.state.last_entry_at
    ? daysBetween(now, new Date(params.state.last_entry_at))
    : null;

  const reengagement =
    daysSinceLast != null && daysSinceLast >= REENGAGEMENT_INACTIVE_DAYS
      ? pickReengagementMessage(params.user_id)
      : null;

  const prompt = selectContextualPrompt({
    user_id: params.user_id,
    state: params.state,
    now,
    last_input_snippet: params.last_input_snippet,
    prior_follow_up_count: params.prior_follow_up_count,
    dismissed_prompt_ids: params.dismissed_prompt_ids,
  });

  return {
    user_id: params.user_id,
    trust_stage: params.state.trust_stage,
    total_entries: params.state.total_entries,
    is_return_session: params.is_return_session ?? false,
    days_since_last_entry: daysSinceLast,
    prompt,
    reengagement_message: reengagement,
    show_optional_context: trustStageAllowsOptionalContext(params.state.trust_stage),
  };
}

export function createDefaultUserState(userId: string): ActivationUserState {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    total_entries: 0,
    first_entry_at: null,
    last_entry_at: null,
    voice_entry_count: 0,
    document_entry_count: 0,
    trust_stage: computeTrustStage(0),
    habit_hour: null,
    updated_at: now,
  };
}

export function createEventId(): string {
  if (typeof randomUUID === "function") {
    try {
      return randomUUID();
    } catch {
      // fall through
    }
  }
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
