import { FRESHNESS_WINDOW_DAYS } from "./contract-constants";

import { classifyEventFreshness, objectLabel } from "./classify-freshness";

import type { CanonicalCareEvent } from "../situation-entry/types";

import type { ObjectConfidence } from "./types";



export function daysBetween(isoA: string, isoB: string): number {

  const a = new Date(isoA).getTime();

  const b = new Date(isoB).getTime();

  return Math.max(0, (b - a) / (1000 * 60 * 60 * 24));

}



export function getLastConfirmedAt(event: CanonicalCareEvent): string {

  const attr = event.attributes.last_confirmed_at;

  if (typeof attr === "string") return attr;

  return event.ingestion_time;

}



function baseConfidenceForStatus(status: CanonicalCareEvent["status"]): number {

  if (status === "committed") return 0.95;

  if (status === "provisional") return 0.55;

  if (status === "unparsed_raw") return 0.35;

  return 0.4;

}



export function computeObjectConfidence(

  event: CanonicalCareEvent,

  asOf: string,

  reinforced: boolean,

): ObjectConfidence {

  const tier = classifyEventFreshness(event);

  const windowDays = FRESHNESS_WINDOW_DAYS[tier];

  const lastConfirmed = getLastConfirmedAt(event);

  const ageDays = daysBetween(lastConfirmed, asOf);

  const base = baseConfidenceForStatus(event.status);

  const decay = Math.exp(-ageDays / windowDays);

  let confidence = base * decay;

  if (reinforced) {

    confidence = Math.min(0.98, confidence + 0.3);

  }

  return {

    object_id: event.id,

    label: objectLabel(event),

    tier,

    confidence_pct: Math.round(confidence * 100),

    age_days: Math.round(ageDays * 10) / 10,

    freshness_window_days: windowDays,

    last_confirmed_at: lastConfirmed,

  };

}



export function computeOverallContinuityConfidence(

  objects: ObjectConfidence[],

  silencePenalty: number,

): number {

  if (objects.length === 0) return 0;

  const avg = objects.reduce((s, o) => s + o.confidence_pct, 0) / objects.length;

  return Math.max(0, Math.min(100, Math.round(avg - silencePenalty)));

}


