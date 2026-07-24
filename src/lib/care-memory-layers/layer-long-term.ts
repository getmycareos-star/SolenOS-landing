import { LONG_TERM_EPISODE_AGE_DAYS } from "./contract-constants";
import type { CareEpisode, ContinuitySummaryKind, LongTermContinuitySummary } from "./types";

function createSummaryId(): string {
  return `lts_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function daysSince(iso: string, reference = new Date()): number {
  return Math.floor((reference.getTime() - new Date(iso).getTime()) / 86400000);
}

function summaryKindForEpisode(episode: CareEpisode): ContinuitySummaryKind {
  if (episode.kind === "home_care_transition") return "care_transition";
  if (episode.kind === "insurance_appeal") return "unresolved_issue";
  if (episode.kind === "family_care_planning") return "responsibility_change";
  if (episode.kind === "hospital_stay" || episode.kind === "rehabilitation") return "life_event";
  if (episode.status === "monitoring") return "historical_pattern";
  if (episode.status === "completed") return "care_milestone";
  return "historical_pattern";
}

/** Layer 4 — derive long-term summaries from episodes (never replaces raw events). */
export function deriveLongTermSummaries(
  caregiverId: string,
  episodes: CareEpisode[],
  existing: LongTermContinuitySummary[] = [],
  reference = new Date(),
): LongTermContinuitySummary[] {
  const summaries = [...existing];
  const existingEpisodeSets = new Set(
    existing.map((s) => s.episode_ids.sort().join(",")),
  );

  for (const episode of episodes) {
    if (episode.status === "active") continue;
    const age = daysSince(episode.ended_at ?? episode.started_at, reference);
    if (age < LONG_TERM_EPISODE_AGE_DAYS) continue;

    const key = [...episode.event_ids].sort().join(",");
    if (existingEpisodeSets.has(episode.event_ids.sort().join(","))) continue;

    const kind = summaryKindForEpisode(episode);
    summaries.push({
      id: createSummaryId(),
      layer: "long_term_continuity",
      caregiver_id: caregiverId,
      kind,
      title: episode.title,
      narrative: `Long-term continuity: ${episode.summary}. All ${episode.event_ids.length} underlying events preserved and traceable.`,
      episode_ids: [episode.id],
      event_ids: [...episode.source_event_ids],
      derived_at: new Date().toISOString(),
      reversible: true,
    });
    existingEpisodeSets.add(key);
  }

  return summaries;
}

export function expandSummaryToEventIds(summary: LongTermContinuitySummary): string[] {
  return [...summary.event_ids];
}
