/** Shared display-formatting helpers used by the frontend. */
export function formatDate(value: string | Date | null | undefined): string {
  if (value == null || value === '') return 'Unknown date'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatConfidence(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return 'Unknown'
  const normalized = value > 1 ? value : value * 100
  return `${Math.round(Math.max(0, Math.min(100, normalized)))}%`
}
