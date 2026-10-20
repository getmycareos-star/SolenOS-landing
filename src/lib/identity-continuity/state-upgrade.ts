import { createHash } from "node:crypto";

import { getTelemetryStore } from "../telemetry-persistence/server";
import {
  getOrCreateCareSession,
  upgradeSessionToPersistent,
  getCareSession,
} from "./care-state-store";
import type { IdentityContinuityState } from "./types";

const userCredentials = new Map<string, { email: string; password_hash: string }>();
const emailToUserId = new Map<string, string>();

function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function resetAuthCredentialsForTests(): void {
  userCredentials.clear();
  emailToUserId.clear();
}

export interface StateUpgradeResult {
  user_id: string;
  care_session_id: string;
  identity_state: IdentityContinuityState;
}

/**
 * Ephemeral → persistent binding. Preserves all care graph, memory, and decisions.
 */
export async function upgradeEphemeralToPersistent(params: {
  care_session_id: string;
  email: string;
  password: string;
  telemetry_user_id?: string;
}): Promise<StateUpgradeResult> {
  const session = getCareSession(params.care_session_id);
  if (!session) {
    throw new Error("care session not found");
  }

  const store = await getTelemetryStore();
  const { user_id } = await store.ensureUser(params.telemetry_user_id);

  const emailKey = params.email.toLowerCase();
  userCredentials.set(user_id, { email: emailKey, password_hash: hashPassword(params.password) });
  emailToUserId.set(emailKey, user_id);

  const upgraded = upgradeSessionToPersistent(session, user_id);
  return {
    user_id,
    care_session_id: upgraded.care_session_id,
    identity_state: upgraded,
  };
}

export async function authenticatePersistentUser(params: {
  email: string;
  password: string;
}): Promise<{ user_id: string } | null> {
  const emailKey = params.email.toLowerCase();
  const userId = emailToUserId.get(emailKey);
  if (!userId) return null;

  const creds = userCredentials.get(userId);
  if (!creds || creds.password_hash !== hashPassword(params.password)) {
    return null;
  }

  await getTelemetryStore().then((store) => store.ensureUser(userId));
  return { user_id: userId };
}

export function bindSessionToUser(
  careSessionId: string,
  userId: string,
): IdentityContinuityState {
  const session = getOrCreateCareSession({
    care_session_id: careSessionId,
    user_id: userId,
  });
  return upgradeSessionToPersistent(session, userId);
}
