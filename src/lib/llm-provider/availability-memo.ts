/**
 * Remembers that the local model endpoint did not answer.
 *
 * Without this, every capture pays a full connection timeout before the rule
 * floor answers. A caregiver writing three notes in a row should not wait three
 * times for a model that is not running.
 */

let unavailableUntil = 0;

function ttl(): number {
  const configured = Number(process.env.SEMANTIC_LLM_UNAVAILABLE_TTL_MS ?? 300000);
  return Number.isFinite(configured) ? Math.max(1000, Math.min(configured, 900000)) : 300000;
}

export function markLlmUnavailable(): void {
  unavailableUntil = Date.now() + ttl();
}

export function isLlmMarkedUnavailable(): boolean {
  return Date.now() < unavailableUntil;
}

export function clearLlmUnavailable(): void {
  unavailableUntil = 0;
}

/**
 * A slow model is not a missing model.
 *
 * A timeout means the endpoint was reached but the answer did not arrive in
 * budget — usually a first load into memory. Marking that as "unavailable"
 * would mute semantic understanding for minutes after a single cold start, so
 * only connection-class failures may write the memo.
 */
export function isEndpointUnreachable(error: unknown): boolean {
  const raw =
    error instanceof Error
      ? `${error.message} ${(error as { code?: string; cause?: unknown }).code ?? ""} ${describeCause(error)}`
      : String(error ?? "");
  const message = raw.toLowerCase();

  if (/abort|timed? ?out|timeout|etimedout|esockettimedout/.test(message)) return false;

  return /econnrefused|econnreset|enotfound|eai_again|ehostunreach|enetunreach|socket hang up|fetch failed|network|connect/.test(
    message,
  );
}

function describeCause(error: unknown): string {
  const cause = (error as { cause?: unknown }).cause;
  if (!cause) return "";
  if (cause instanceof Error) return `${cause.message} ${(cause as { code?: string }).code ?? ""}`;
  return String(cause);
}
