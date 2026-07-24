import {
  buildActivationSessionContext,
} from "./prompts";
import {
  getOrCreateUserState,
  hydrateUserState,
  recordActivationEvent,
  computeDashboardMetrics,
  computeUserMetrics,
} from "./store";
import {
  tryLoadUserStateFromPostgres,
  trySaveEventToPostgres,
  trySaveUserStateToPostgres,
} from "./postgres-store";
import type {
  ActivationSessionContext,
  DashboardActivationMetrics,
  RecordActivationEventInput,
  UserActivationMetrics,
} from "./types";

export async function resolveUserState(userId: string) {
  const fromPg = await tryLoadUserStateFromPostgres(userId);
  if (fromPg) {
    hydrateUserState(fromPg);
    return fromPg;
  }
  return getOrCreateUserState(userId);
}

export async function trackActivationEvent(input: RecordActivationEventInput) {
  const result = recordActivationEvent(input);
  await trySaveEventToPostgres(result.event);
  await trySaveUserStateToPostgres(result.state);
  return result;
}

export async function getActivationSession(params: {
  user_id: string;
  is_return_session?: boolean;
  last_input_snippet?: string | null;
  prior_follow_up_count?: number | null;
  dismissed_prompt_ids?: string[];
}): Promise<ActivationSessionContext> {
  const state = await resolveUserState(params.user_id);
  return buildActivationSessionContext({
    user_id: params.user_id,
    state,
    is_return_session: params.is_return_session ?? false,
    last_input_snippet: params.last_input_snippet ?? null,
    prior_follow_up_count: params.prior_follow_up_count ?? null,
    dismissed_prompt_ids: params.dismissed_prompt_ids,
  });
}

export async function getUserActivationMetrics(userId: string): Promise<UserActivationMetrics> {
  await resolveUserState(userId);
  return computeUserMetrics(userId);
}

export async function getDashboardActivationMetrics(): Promise<DashboardActivationMetrics> {
  return computeDashboardMetrics();
}
