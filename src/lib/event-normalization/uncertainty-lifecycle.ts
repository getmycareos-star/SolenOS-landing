import type { UncertaintyRecord } from "./types";

export function createUncertainty(field: string): UncertaintyRecord {
  return {
    field,
    created_at: new Date().toISOString(),
    resolved: false,
    resolved_at: null,
    resolution_source: null,
  };
}

export function resolveUncertainty(
  records: UncertaintyRecord[],
  field: string,
  source: UncertaintyRecord["resolution_source"],
): UncertaintyRecord[] {
  return records.map((r) =>
    r.field === field && !r.resolved
      ? { ...r, resolved: true, resolved_at: new Date().toISOString(), resolution_source: source }
      : r,
  );
}

export function unresolvedFields(records: UncertaintyRecord[]): string[] {
  return records.filter((r) => !r.resolved).map((r) => r.field);
}
