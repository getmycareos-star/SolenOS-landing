import {
  LOGIN_PROMPT_MESSAGE,
  SIGNUP_PROMPT_MESSAGE,
} from "./contract-constants";
import type {
  CareGraphSummary,
  ContinuityPrompt,
  ContinuityPromptAction,
  ContinuityPromptReason,
  IdentityContinuityState,
  PersistenceSignals,
} from "./types";

export function shouldPromptSignup(
  identityState: IdentityContinuityState,
  persistenceRequired: boolean,
): boolean {
  if (identityState.mode === "persistent") {
    return false;
  }
  return persistenceRequired;
}

export function shouldPromptLogin(
  identityState: IdentityContinuityState,
  signals: PersistenceSignals,
): boolean {
  if (identityState.mode !== "persistent") {
    return false;
  }
  if (!identityState.auth_enabled) {
    return false;
  }
  if (!identityState.has_stored_care_graph) {
    return false;
  }
  return signals.return_behavior_detected;
}

export function resolveContinuityPrompt(params: {
  identityState: IdentityContinuityState;
  persistenceRequired: boolean;
  signals: PersistenceSignals;
  careGraphSummary?: CareGraphSummary;
}): ContinuityPrompt {
  let action: ContinuityPromptAction = "none";
  let reason: ContinuityPromptReason | undefined;
  let message = "";

  if (shouldPromptLogin(params.identityState, params.signals)) {
    action = "prompt_login";
    reason = "resume_context";
    message = LOGIN_PROMPT_MESSAGE;
  } else if (shouldPromptSignup(params.identityState, params.persistenceRequired)) {
    action = "prompt_signup";
    reason = "continuity_needed";
    message = SIGNUP_PROMPT_MESSAGE;
  }

  return {
    action,
    reason,
    message,
    ...(action !== "none" && params.careGraphSummary
      ? { care_graph_summary: params.careGraphSummary }
      : {}),
  };
}
