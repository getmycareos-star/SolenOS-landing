/**
 * Build caregiver-facing open situations from GET/POST /api/situation payloads.
 * Prefer TrackedSituation UI rows; fall back to care_situation_groups / ACS / events
 * so notes on the durable spine never look like an empty ops list.
 */

import { createSituation, titleFromInput } from "./situation-store";
import type { Situation } from "./types";

type CareEventLite = {
  id: string;
  raw_input: string;
  situation_id?: string | null;
  attributes?: Record<string, unknown>;
};

type CareSituationGroup = {
  situation_id: string;
  root_event_id: string | null;
  event_ids: string[];
};

export type SituationApiContinuityPayload = {
  situations?: Situation[];
  ui_situations?: Situation[];
  care_situation_groups?: CareSituationGroup[];
  context?: { events?: CareEventLite[] } | null;
  active_care_situation?: {
    id: string;
    observations?: { raw_text: string }[];
  } | null;
  has_context_root?: boolean;
  total_events?: number;
};

function plainTitleFromEvents(events: CareEventLite[]): string {
  const latest = events[events.length - 1] ?? events[0];
  const fromAttr =
    typeof latest?.attributes?.source_situation_text === "string"
      ? latest.attributes.source_situation_text
      : null;
  return titleFromInput(fromAttr || latest?.raw_input || "Open care situation");
}

/**
 * Open (non-resolved) situations for caregiver nav — plain-language titles from real data.
 */
export function openSituationsFromSituationApi(
  data: SituationApiContinuityPayload | null | undefined,
): Situation[] {
  if (!data) return [];

  const fromUi = [...(data.situations ?? []), ...(data.ui_situations ?? [])].filter(
    (s, i, arr) => arr.findIndex((x) => x.id === s.id) === i,
  );
  const openUi = fromUi.filter((s) => s.status !== "resolved");
  if (openUi.length > 0) {
    return openUi.map((s) => ({
      ...s,
      title: titleFromInput(s.title),
      riskLevel: "LOW" as const,
    }));
  }

  const events = data.context?.events ?? [];
  const groups = data.care_situation_groups ?? [];

  if (groups.length > 0) {
    return groups.map((g) => {
      const groupEvents = events.filter(
        (e) => e.situation_id === g.situation_id || g.event_ids.includes(e.id),
      );
      return createSituation({
        id: g.situation_id,
        title: plainTitleFromEvents(groupEvents),
        status: "active",
        riskLevel: "LOW",
      });
    });
  }

  if (data.active_care_situation) {
    const obs = data.active_care_situation.observations ?? [];
    const raw =
      obs[obs.length - 1]?.raw_text ?? obs[0]?.raw_text ?? "Today's care situation";
    return [
      createSituation({
        id: data.active_care_situation.id,
        title: titleFromInput(raw),
        status: "active",
        riskLevel: "LOW",
      }),
    ];
  }

  if (events.length > 0) {
    const bySituation = new Map<string, CareEventLite[]>();
    for (const event of events) {
      const key = event.situation_id ?? `event:${event.id}`;
      const list = bySituation.get(key) ?? [];
      list.push(event);
      bySituation.set(key, list);
    }
    return [...bySituation.entries()].map(([id, groupEvents]) =>
      createSituation({
        id: id.startsWith("event:") ? groupEvents[0]!.id : id,
        title: plainTitleFromEvents(groupEvents),
        status: "active",
        riskLevel: "LOW",
      }),
    );
  }

  return [];
}
