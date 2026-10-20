import type { CaseIntervention, CaseOutcomeSummary } from "../types";

type InterventionRecord = {
  caseId: string;
  intervention: CaseIntervention;
  eventTypeHints: string[];
  tags: string[];
};

/** Successful intervention → outcome index for Pattern Response Policy State C. */
const byCaseId = new Map<string, InterventionRecord[]>();

export function resetInterventionOutcomeStore(): void {
  byCaseId.clear();
}

export function recordInterventionOutcome(params: {
  caseId: string;
  intervention: CaseIntervention;
  eventTypeHints?: string[];
  tags?: string[];
}): void {
  const list = byCaseId.get(params.caseId) ?? [];
  list.push({
    caseId: params.caseId,
    intervention: params.intervention,
    eventTypeHints: params.eventTypeHints ?? [],
    tags: params.tags ?? [],
  });
  byCaseId.set(params.caseId, list);
}

export function listInterventionsForCase(caseId: string): readonly InterventionRecord[] {
  return [...(byCaseId.get(caseId) ?? [])];
}

export function findSuccessfulIntervention(params: {
  caseId: string;
  eventType?: string;
  tags?: string[];
}): CaseIntervention | undefined {
  const list = byCaseId.get(params.caseId) ?? [];
  const tags = new Set((params.tags ?? []).map((t) => t.toLowerCase()));
  const scored = list
    .filter((r) => r.intervention.outcome?.success)
    .map((r) => {
      let score = 0;
      if (params.eventType && r.eventTypeHints.includes(params.eventType)) score += 2;
      for (const t of r.tags) {
        if (tags.has(t.toLowerCase())) score += 1;
      }
      const label = r.intervention.label.toLowerCase();
      for (const t of tags) {
        if (label.includes(t)) score += 0.5;
      }
      return { r, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.r.intervention;
}

export function outcomeFromSuccess(
  summary: string,
  recordedAt = new Date().toISOString(),
): CaseOutcomeSummary {
  return { success: true, summary, recordedAt };
}
