/**
 * Phase 8 — Evidence Priority + Conflict.
 * Lower priority is not deleted — it becomes conflict.
 */

export const EVIDENCE_PRIORITY = [
  "clinical_documentation",
  "care_professional_notes",
  "caregiver_observations",
  "historical_records",
  "assumptions",
] as const;

export type EvidencePriorityLevel = (typeof EVIDENCE_PRIORITY)[number];

export function rankEvidenceSource(sourceHint: string): EvidencePriorityLevel {
  const s = sourceHint.toLowerCase();
  if (
    /discharge|clinical|hospital|lab report|prescription|referral|physician|doctor/.test(s)
  ) {
    return "clinical_documentation";
  }
  if (/nurse|therapist|social worker|home health|care professional/.test(s)) {
    return "care_professional_notes";
  }
  if (/assumption|inferred|guess/.test(s)) {
    return "assumptions";
  }
  if (/history|historical|archive|old record/.test(s)) {
    return "historical_records";
  }
  return "caregiver_observations";
}

export function evidencePriorityIndex(level: EvidencePriorityLevel): number {
  return EVIDENCE_PRIORITY.indexOf(level);
}

/**
 * Prefer higher priority for current orientation; keep both as conflict when they disagree.
 */
export function resolveEvidenceOrientation(params: {
  a: { text: string; source: string };
  b: { text: string; source: string };
  disagree: boolean;
}): {
  orientation_source: "a" | "b" | "neither";
  conflict: boolean;
  note: string | null;
} {
  if (!params.disagree) {
    return { orientation_source: "neither", conflict: false, note: null };
  }
  const ra = evidencePriorityIndex(rankEvidenceSource(params.a.source));
  const rb = evidencePriorityIndex(rankEvidenceSource(params.b.source));
  if (ra < rb) {
    return {
      orientation_source: "a",
      conflict: true,
      note: "There is conflicting information — both records are kept.",
    };
  }
  if (rb < ra) {
    return {
      orientation_source: "b",
      conflict: true,
      note: "There is conflicting information — both records are kept.",
    };
  }
  return {
    orientation_source: "neither",
    conflict: true,
    note: "There is conflicting information — both records are kept.",
  };
}
