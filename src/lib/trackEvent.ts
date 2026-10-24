/**
 * Internal telemetry is intentionally disabled until a real, scoped backend
 * ingestion endpoint is available. The previous POST /api/track was being
 * forwarded to FastAPI, which does not register that route and returns 404.
 * Keep the call signature so existing callers remain non-blocking; do not send
 * caregiver activity or metadata to an unsupported endpoint.
 */

import type { OpsEventName } from "./ops-console/event-names";

/** No-op until telemetry persistence is implemented and verified server-side. */
export function track(
  _event_name: OpsEventName | string,
  _metadata: Record<string, unknown> = {},
): void {
  // Intentionally no network request. Do not re-enable by adding a client URL:
  // implement a scoped, persisted backend endpoint first.
}

export default track;
