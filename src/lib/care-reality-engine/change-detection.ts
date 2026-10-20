/**
 * Phase 6 — Change Detection Engine.
 * Ask of every new evidence: start / stop / increase / decrease / return / become uncertain?
 * Derive from baseline + prior vs current understanding — never canned scenarios.
 */

export const CHANGE_KINDS = [
  "started",
  "stopped",
  "increased",
  "decreased",
  "returned",
  "became_uncertain",
  "conflict",
] as const;

export type ChangeKind = (typeof CHANGE_KINDS)[number];

export type DetectedChange = {
  kind: ChangeKind;
  domain: string | null;
  summary: string;
  prior: string | null;
  current: string | null;
  evidence_ids: string[];
  /** Conflict is held as conflict — never promoted to fact. */
  is_conflict: boolean;
};

export type ChangeDetectionResult = {
  changes: DetectedChange[];
  has_meaningful_change: boolean;
};

/**
 * Build change records from prior/current summaries already understood by engines.
 * Callers supply compared strings — this module does not keyword-template medical stories.
 */
export function detectChangesFromComparison(params: {
  priorSummaries: readonly string[];
  currentSummaries: readonly string[];
  deviations?: readonly {
    observation: string;
    compared_to_baseline?: string;
    deviation_type?: string;
    source_event_id?: string;
  }[];
  conflictNote?: string | null;
  evidenceIds?: string[];
}): ChangeDetectionResult {
  const changes: DetectedChange[] = [];
  const evidence = params.evidenceIds ?? [];

  for (const d of params.deviations ?? []) {
    const kind = mapDeviationType(d.deviation_type);
    changes.push({
      kind,
      domain: null,
      summary: d.observation.trim(),
      prior: d.compared_to_baseline?.trim() || null,
      current: d.observation.trim(),
      evidence_ids: d.source_event_id ? [d.source_event_id] : evidence,
      is_conflict: false,
    });
  }

  if (params.conflictNote?.trim()) {
    changes.push({
      kind: "conflict",
      domain: null,
      summary: params.conflictNote.trim(),
      prior: null,
      current: null,
      evidence_ids: evidence,
      is_conflict: true,
    });
  }

  // Structural: prior held something current no longer states → uncertain / stopped candidate
  if (
    params.priorSummaries.length > 0 &&
    params.currentSummaries.length > 0 &&
    changes.length === 0
  ) {
    const prior = params.priorSummaries[0]!;
    const current = params.currentSummaries[0]!;
    if (prior.trim() && current.trim() && prior.trim() !== current.trim()) {
      changes.push({
        kind: "became_uncertain",
        domain: null,
        summary: "Care reality understanding shifted from what was previously held.",
        prior: prior.trim(),
        current: current.trim(),
        evidence_ids: evidence,
        is_conflict: false,
      });
    }
  }

  return {
    changes: changes.slice(0, 8),
    has_meaningful_change: changes.length > 0,
  };
}

function mapDeviationType(raw?: string): ChangeKind {
  switch (raw) {
    case "new":
      return "started";
    case "escalation":
      return "increased";
    case "return":
      return "returned";
    case "pattern_shift":
      return "became_uncertain";
    default:
      return "became_uncertain";
  }
}
