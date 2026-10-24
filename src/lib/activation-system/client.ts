/** Client-side activation helpers — localStorage only, no reasoning. */

import type { ContextualPromptType } from "./types";

export const ACTIVATION_DISMISSED_PROMPTS_KEY = "solenos_activation_dismissed_prompts";
export const ACTIVATION_PRIOR_FOLLOW_UP_KEY = "solenos_activation_prior_follow_up_count";
export const ACTIVATION_LAST_SNIPPET_KEY = "solenos_activation_last_input_snippet";

export function readDismissedPromptTypes(): ContextualPromptType[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACTIVATION_DISMISSED_PROMPTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((x): x is ContextualPromptType => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

export function dismissPromptType(type: ContextualPromptType): void {
  if (typeof window === "undefined") return;
  const current = new Set(readDismissedPromptTypes());
  current.add(type);
  window.localStorage.setItem(
    ACTIVATION_DISMISSED_PROMPTS_KEY,
    JSON.stringify([...current]),
  );
}

export async function trackClientActivationEvent(_params: {
  user_id?: string;
  event_type: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  // The backend does not register /api/activation/events yet. Keep activation
  // telemetry local/non-blocking until a persisted, scoped endpoint exists.
  return;
}

export async function fetchActivationSession(_params: {
  user_id?: string;
  is_return_session?: boolean;
  last_input_snippet?: string | null;
  prior_follow_up_count?: number | null;
}): Promise<import("./types").ActivationSessionContext | null> {
  // No server-side activation-session route is mounted in the current backend.
  // Return no server context rather than making an unsupported request.
  return null;
}
