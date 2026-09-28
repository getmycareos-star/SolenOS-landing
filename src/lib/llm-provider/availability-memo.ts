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
