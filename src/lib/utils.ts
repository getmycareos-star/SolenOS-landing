/** Shared formatting helpers used by the Vite evidence UI. */

export function formatDate(value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString();
}

export function formatConfidence(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "Unknown";
  const normalized = value > 1 ? value / 100 : value;
  const percentage = Math.round(Math.min(1, Math.max(0, normalized)) * 100);
  return `${percentage}%`;
}
