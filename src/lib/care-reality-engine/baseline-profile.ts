/**
 * Phase 2 — Baseline Memory Profile.
 * Change detection needs "what normal looked like" — not long questionnaires.
 * Capture only important baseline domains from evidence over time.
 */

import {
  livingCareRecordDataDir,
  readDurableJson,
  sanitizeDurableCareKey,
  writeDurableJson,
  clearDurableDirectory,
} from "../living-care-record-persistence/fs-store";

export const BASELINE_PROFILE_DOMAINS = [
  "communication",
  "mobility",
  "daily_routines",
  "preferences",
  "support_situation",
] as const;

export type BaselineProfileDomain = (typeof BASELINE_PROFILE_DOMAINS)[number];

export type BaselineProfileEntry = {
  domain: BaselineProfileDomain;
  summary: string;
  source_event_ids: string[];
  updated_at: string;
  confidence: "low" | "medium" | "high";
};

export type BaselineProfile = {
  care_recipient_id: string;
  entries: BaselineProfileEntry[];
  established: boolean;
  updated_at: string;
};

const memory = new Map<string, BaselineProfile>();

function pathFor(id: string): string {
  return livingCareRecordDataDir(
    "baseline-profile",
    `${sanitizeDurableCareKey(id)}.json`,
  );
}

export function getBaselineProfile(careRecipientId: string): BaselineProfile | null {
  const cached = memory.get(careRecipientId);
  if (cached) return cached;
  const durable = readDurableJson<BaselineProfile>(pathFor(careRecipientId));
  if (durable?.entries) {
    memory.set(careRecipientId, durable);
    return durable;
  }
  return null;
}

/**
 * Upsert a baseline fact from evidence — never questionnaire homework.
 * Domain must be inferred by callers from understanding, not keyword templates.
 */
export function upsertBaselineProfileEntry(params: {
  careRecipientId: string;
  domain: BaselineProfileDomain;
  summary: string;
  sourceEventIds?: string[];
  confidence?: "low" | "medium" | "high";
  nowIso?: string;
}): BaselineProfile {
  const now = params.nowIso ?? new Date().toISOString();
  const summary = params.summary.trim().slice(0, 280);
  if (!summary) {
    return (
      getBaselineProfile(params.careRecipientId) ?? {
        care_recipient_id: params.careRecipientId,
        entries: [],
        established: false,
        updated_at: now,
      }
    );
  }

  const prior =
    getBaselineProfile(params.careRecipientId) ??
    ({
      care_recipient_id: params.careRecipientId,
      entries: [],
      established: false,
      updated_at: now,
    } satisfies BaselineProfile);

  const nextEntry: BaselineProfileEntry = {
    domain: params.domain,
    summary,
    source_event_ids: params.sourceEventIds ?? [],
    updated_at: now,
    confidence: params.confidence ?? "low",
  };

  const entries = [
    ...prior.entries.filter((e) => e.domain !== params.domain),
    nextEntry,
  ];

  const profile: BaselineProfile = {
    care_recipient_id: params.careRecipientId,
    entries,
    established: entries.length >= 1,
    updated_at: now,
  };
  memory.set(params.careRecipientId, profile);
  writeDurableJson(pathFor(params.careRecipientId), profile);
  return profile;
}

/** Seed baseline from prior baseline-intelligence facts when available — no phrase templates. */
export function syncBaselineFromIntelligenceFacts(params: {
  careRecipientId: string;
  facts: Array<{
    domain: string;
    label: string;
    source_event_ids?: string[];
    confidence?: "low" | "medium" | "high";
  }>;
  nowIso?: string;
}): BaselineProfile | null {
  const domainMap: Record<string, BaselineProfileDomain | undefined> = {
    communication: "communication",
    mobility: "mobility",
    sleep: "daily_routines",
    routine: "daily_routines",
    daily_living: "daily_routines",
    preference: "preferences",
    preferences: "preferences",
    support: "support_situation",
    caregiving: "support_situation",
  };

  let last: BaselineProfile | null = getBaselineProfile(params.careRecipientId);
  for (const fact of params.facts.slice(-12)) {
    const domain = domainMap[fact.domain.toLowerCase()];
    if (!domain || !fact.label.trim()) continue;
    last = upsertBaselineProfileEntry({
      careRecipientId: params.careRecipientId,
      domain,
      summary: fact.label,
      sourceEventIds: fact.source_event_ids,
      confidence: fact.confidence ?? "medium",
      nowIso: params.nowIso,
    });
  }
  return last;
}

export function resetBaselineProfileStore(): void {
  memory.clear();
  clearDurableDirectory(livingCareRecordDataDir("baseline-profile"));
}
