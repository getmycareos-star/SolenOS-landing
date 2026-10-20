import type { CanonicalCareEvent } from "../situation-entry/types";
import { EPISODE_CLUSTER_DAYS } from "./contract-constants";
import type { CareEpisode, EpisodeKind, EpisodeStatus } from "./types";

const EPISODE_PATTERNS: { kind: EpisodeKind; pattern: RegExp }[] = [
  { kind: "hospital_stay", pattern: /\b(hospital|admitted|discharge|er\b|emergency room)\b/i },
  { kind: "insurance_appeal", pattern: /\b(insurance|claim|appeal|denied|rejected|coverage)\b/i },
  { kind: "medication_adjustment", pattern: /\b(medication|prescri\w+|dose|started|changed)\b/i },
  { kind: "home_care_transition", pattern: /\b(home care|caregiver hired|transition|move home)\b/i },
  { kind: "legal_planning", pattern: /\b(legal|power of attorney|guardian|will|estate)\b/i },
  { kind: "family_care_planning", pattern: /\b(family meeting|care plan|sibling|coordinate)\b/i },
  { kind: "rehabilitation", pattern: /\b(rehab|physical therapy|recovery|therapy)\b/i },
  { kind: "equipment_acquisition", pattern: /\b(wheelchair|walker|ramp|equipment|install)\b/i },
];

function createEpisodeId(): string {
  return `ep_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function inferEpisodeKind(events: CanonicalCareEvent[]): EpisodeKind {
  const text = events.map((e) => e.raw_input).join(" ");
  for (const { kind, pattern } of EPISODE_PATTERNS) {
    if (pattern.test(text)) return kind;
  }
  if (events.some((e) => e.extracted_type === "incident")) return "general_care";
  return "general_care";
}

function episodeTitle(kind: EpisodeKind, events: CanonicalCareEvent[]): string {
  const labels: Record<EpisodeKind, string> = {
    hospital_stay: "Hospital stay",
    insurance_appeal: "Insurance appeal",
    home_care_transition: "Home care transition",
    medication_adjustment: "Medication adjustment",
    legal_planning: "Legal planning",
    family_care_planning: "Family care planning",
    rehabilitation: "Rehabilitation period",
    equipment_acquisition: "Equipment acquisition",
    general_care: "Care episode",
  };
  const first = events[0]?.raw_input.slice(0, 60);
  return first ? `${labels[kind]}: ${first}` : labels[kind];
}

function daysBetween(a: string, b: string): number {
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / 86400000;
}

/** Layer 3 — group related events into episodes (never loses underlying events). */
export function detectEpisodes(
  caregiverId: string,
  events: CanonicalCareEvent[],
  existing: CareEpisode[] = [],
): CareEpisode[] {
  if (events.length === 0) return existing;

  const activeEvents = events.filter(
    (e) => e.status !== "invalidated" && e.status !== "superseded",
  );
  const sorted = [...activeEvents].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const assigned = new Set(existing.flatMap((ep) => ep.event_ids));
  const episodes = [...existing];

  let cluster: CanonicalCareEvent[] = [];

  function flushCluster(): void {
    if (cluster.length === 0) return;
    const ids = cluster.map((e) => e.id);
    const existingEp = episodes.find(
      (ep) => ids.every((id) => ep.event_ids.includes(id)) && ep.event_ids.length === ids.length,
    );
    if (existingEp) {
      cluster = [];
      return;
    }

    const kind = inferEpisodeKind(cluster);
    const now = new Date().toISOString();
    const started = cluster[0]!.timestamp;
    const ended = cluster.length > 1 ? cluster[cluster.length - 1]!.timestamp : null;
    const isRecent =
      daysBetween(ended ?? started, now) <= EPISODE_CLUSTER_DAYS;

    episodes.push({
      id: createEpisodeId(),
      layer: "episode",
      caregiver_id: caregiverId,
      title: episodeTitle(kind, cluster),
      kind,
      status: isRecent ? "active" : "completed",
      event_ids: ids,
      started_at: started,
      ended_at: ended,
      summary: `${cluster.length} related event${cluster.length === 1 ? "" : "s"} — ${kind.replace(/_/g, " ")}`,
      source_event_ids: ids,
      created_at: now,
      updated_at: now,
    });
    cluster = [];
  }

  for (const event of sorted) {
    if (assigned.has(event.id)) continue;

    if (cluster.length === 0) {
      cluster.push(event);
      continue;
    }

    const last = cluster[cluster.length - 1]!;
    const sameRoot =
      event.root_event_id != null &&
      (event.root_event_id === last.root_event_id || event.root_event_id === last.id);
    const closeInTime = daysBetween(event.timestamp, last.timestamp) <= EPISODE_CLUSTER_DAYS;
    const sameKind = inferEpisodeKind([event]) === inferEpisodeKind(cluster);

    if (sameRoot || (closeInTime && sameKind)) {
      cluster.push(event);
    } else {
      flushCluster();
      cluster.push(event);
    }
  }
  flushCluster();

  return mergeOverlappingEpisodes(episodes);
}

function mergeOverlappingEpisodes(episodes: CareEpisode[]): CareEpisode[] {
  if (episodes.length <= 1) return episodes;
  const merged: CareEpisode[] = [];
  const used = new Set<string>();

  for (const ep of episodes) {
    if (used.has(ep.id)) continue;
    const overlap = episodes.find(
      (other) =>
        other.id !== ep.id &&
        !used.has(other.id) &&
        other.kind === ep.kind &&
        ep.event_ids.some((id) => other.event_ids.includes(id)),
    );
    if (overlap) {
      const ids = [...new Set([...ep.event_ids, ...overlap.event_ids])];
      merged.push({
        ...ep,
        event_ids: ids,
        source_event_ids: ids,
        summary: `${ids.length} events — ${ep.kind.replace(/_/g, " ")}`,
        updated_at: new Date().toISOString(),
      });
      used.add(ep.id);
      used.add(overlap.id);
    } else {
      merged.push(ep);
      used.add(ep.id);
    }
  }
  return merged;
}

export function getActiveEpisode(episodes: CareEpisode[]): CareEpisode | null {
  return episodes.find((ep) => ep.status === "active") ?? episodes[episodes.length - 1] ?? null;
}

export function eventToEpisodeMap(episodes: CareEpisode[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const ep of episodes) {
    for (const id of ep.event_ids) map.set(id, ep.id);
  }
  return map;
}

export function getEpisodeById(
  episodes: CareEpisode[],
  episodeId: string,
): CareEpisode | undefined {
  return episodes.find((ep) => ep.id === episodeId);
}

export function markEpisodeStatus(
  episode: CareEpisode,
  status: EpisodeStatus,
): CareEpisode {
  return { ...episode, status, updated_at: new Date().toISOString() };
}
