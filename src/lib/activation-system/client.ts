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

export async function trackClientActivationEvent(params: {
  user_id?: string;
  event_type: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  try {
    await fetch("/api/activation/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    // non-blocking
  }
}

export async function fetchActivationSession(params: {
  user_id?: string;
  is_return_session?: boolean;
  last_input_snippet?: string | null;
  prior_follow_up_count?: number | null;
}): Promise<import("./types").ActivationSessionContext | null> {
  try {
    const dismissed = readDismissedPromptTypes();
    const qs = new URLSearchParams();
    if (params.user_id) qs.set("user_id", params.user_id);
    if (params.is_return_session) qs.set("return_session", "true");
    if (params.last_input_snippet) qs.set("last_input_snippet", params.last_input_snippet);
    if (params.prior_follow_up_count != null) {
      qs.set("prior_follow_up_count", String(params.prior_follow_up_count));
    }
    if (dismissed.length > 0) qs.set("dismissed_prompt_ids", dismissed.join(","));

    const res = await fetch(`/api/activation/session?${qs.toString()}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { session?: import("./types").ActivationSessionContext };
    return data.session ?? null;
  } catch {
    return null;
  }
}
