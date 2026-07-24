/**
 * Server-side ops event emit — fire-and-forget, never throws to caller.
 */

import { insertSolenEvent } from "./insert-event";

export function emitOpsEventServer(input: {
  event_name: string;
  session_id?: string | null;
  user_id?: string | null;
  metadata?: Record<string, unknown>;
}): void {
  void insertSolenEvent({
    user_id: input.user_id ?? null,
    event_name: input.event_name,
    session_id: input.session_id?.trim() || `server_${Date.now()}`,
    metadata: input.metadata ?? {},
  }).catch(() => {
    /* fail silently */
  });
}
