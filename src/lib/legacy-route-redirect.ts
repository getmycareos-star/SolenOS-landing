export type LegacySearchParams = Record<string, string | string[] | undefined>;

/**
 * Keep safe query context when a legacy page redirects to its canonical owner.
 * Repeated query keys are preserved rather than silently collapsed.
 */
export function preserveLegacySearchParams(
  destination: string,
  searchParams: LegacySearchParams,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (typeof value === "string") {
      query.set(key, value);
    }
  }
  const suffix = query.toString();
  return suffix ? `${destination}?${suffix}` : destination;
}
