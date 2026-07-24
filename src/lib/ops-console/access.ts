/**
 * Ops / Metrics secret gate. Invalid key → treat as not found (404).
 */

export function assertOpsAccess(key: string | null | undefined): boolean {
  const secret = process.env.OPS_SECRET;
  if (!secret || secret.length < 32) return false;
  return typeof key === "string" && key.length > 0 && key === secret;
}

export function assertMetricsAccess(key: string | null | undefined): boolean {
  const secret = process.env.METRICS_SECRET;
  if (!secret || secret.length < 32) return false;
  return typeof key === "string" && key.length > 0 && key === secret;
}
