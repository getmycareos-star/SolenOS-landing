/**
 * Client event emitter for SolenOS Ops Console.
 * Fail silently. Never block UX.
 */

import {
  OPS_SESSION_STORAGE_KEY,
  OPS_USER_STORAGE_KEY,
  type OpsEventName,
} from "./ops-console/event-names";

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId(): string {
  try {
    const existing = window.localStorage.getItem(OPS_SESSION_STORAGE_KEY);
    if (existing) return existing;
    const id = newSessionId();
    window.localStorage.setItem(OPS_SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return newSessionId();
  }
}

function getUserId(): string | null {
  try {
    return window.localStorage.getItem(OPS_USER_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * track(event_name, metadata) — POST /api/track. Fail silently.
 */
export function track(
  event_name: OpsEventName | string,
  metadata: Record<string, unknown> = {},
): void {
  if (typeof window === "undefined") return;

  try {
    const body = {
      user_id: getUserId(),
      event_name,
      session_id: getSessionId(),
      metadata,
    };

    void fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {
      /* fail silently */
    });
  } catch {
    /* fail silently */
  }
}

export default track;
