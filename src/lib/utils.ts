export function formatDate(value: string | number | Date | null | undefined): string {
  if (value == null || value === '') return 'Unknown date';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

export function formatConfidence(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const normalized = value > 1 ? value / 100 : value;
  return `${Math.round(normalized * 100)}%`;
}
