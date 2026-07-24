/**
 * Min-max normalization: normalize(x) = (x - min) / (max - min).
 * When max === min, returns 0.5 for non-empty range ambiguity (deterministic).
 * Result always bounded to [0, 1].
 */
export function normalize(
  x: number,
  min: number,
  max: number,
): number {
  if (!Number.isFinite(x) || !Number.isFinite(min) || !Number.isFinite(max)) {
    return 0;
  }
  if (max === min) {
    return clampUnit(x);
  }
  return clampUnit((x - min) / (max - min));
}

/** Bound any score to unit interval. */
export function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Normalize a list of raw scores against their own min/max (batch).
 */
export function normalizeBatch(values: readonly number[]): number[] {
  if (values.length === 0) return [];
  let min = values[0]!;
  let max = values[0]!;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return values.map((v) => normalize(v, min, max));
}

/**
 * When values are already intended as 0–1 signals, clamp only.
 * Still applies normalize against [0, 1] bounds so out-of-range is corrected.
 */
export function normalizeScore01(x: number): number {
  return normalize(x, 0, 1);
}
