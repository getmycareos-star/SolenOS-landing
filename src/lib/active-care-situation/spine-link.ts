/**
 * Durable CareContext spine linking for Active Care Situation.
 * Soft updates append new CareEvents tagged with situation_id + root_event_id —
 * they do not merge raw text away.
 *
 * Relation decisions come from Situation Relationship Engine (not phrase templates).
 */

import { classifyCareEventKind, type CareEventKind } from "../living-care-record-ux/event-clarifiers";
import type { CanonicalCareEvent, ExtractedType } from "../situation-entry/types";
import {
  evaluateSituationRelationship,
  type SituationRelationshipDecision,
} from "../situation-relationship-engine";
import { getActiveCareSituation } from "./ingest";
import type { ActiveCareSituation, SituationRelation } from "./types";

function newSituationId(): string {
  return `acs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export type SituationSpineLink = {
  relation: SituationRelation;
  situation_id: string;
  /** First CareEvent id of this evolving situation (self for opens_new). */
  root_event_id: string;
  prior: ActiveCareSituation | null;
  /** Engine decision — never show to caregivers. */
  relationship_decision?: SituationRelationshipDecision;
  relationship_reason?: string;
  is_reinforcement?: boolean;
  identity_mismatch?: boolean;
  is_improvement_outcome?: boolean;
};

/**
 * Classify relation against server ACS and decide situation_id / root_event_id
 * before CareEvents are appended to CareContext.
 * Relation is server-owned via Situation Relationship Engine.
 */
export function planSituationSpineLink(params: {
  caregiverId: string;
  rawText: string;
  kind: CareEventKind;
  nowIso: string;
  /** @deprecated Ignored — relation is server-owned. */
  entryIntent?: "initial" | "update";
  /** Primary (first) event id in this write batch — becomes root on opens_new. */
  primaryEventId: string;
}): SituationSpineLink {
  const prior = getActiveCareSituation(params.caregiverId);
  const evaluation = evaluateSituationRelationship({
    active: prior,
    rawText: params.rawText,
    kind: params.kind,
    nowIso: params.nowIso,
  });

  const opensNew =
    evaluation.acs_relation === "opens_new" ||
    !prior ||
    evaluation.decision === "NEW_UNRELATED_SITUATION" ||
    evaluation.decision === "UNCERTAIN_NEEDS_REVIEW";

  if (opensNew) {
    return {
      relation: "opens_new",
      situation_id: newSituationId(),
      root_event_id: params.primaryEventId,
      prior: null,
      relationship_decision: evaluation.decision,
      relationship_reason: evaluation.reason,
      is_reinforcement: evaluation.is_reinforcement,
      identity_mismatch: evaluation.identity_mismatch,
      is_improvement_outcome: evaluation.is_improvement_outcome,
    };
  }

  const existingRoot =
    prior.root_event_id ||
    prior.observations.flatMap((o) => o.event_ids).find(Boolean) ||
    params.primaryEventId;

  return {
    relation: evaluation.acs_relation,
    situation_id: prior.id,
    root_event_id: existingRoot,
    prior,
    relationship_decision: evaluation.decision,
    relationship_reason: evaluation.reason,
    is_reinforcement: evaluation.is_reinforcement,
    identity_mismatch: evaluation.identity_mismatch,
    is_improvement_outcome: evaluation.is_improvement_outcome,
  };
}

/** Stamp situation_id + root_event_id (+ relation attribute) onto a write batch. */
export function stampSituationSpineLink(
  events: CanonicalCareEvent[],
  link: SituationSpineLink,
): void {
  for (const event of events) {
    event.situation_id = link.situation_id;
    event.root_event_id = link.root_event_id;
    event.attributes = {
      ...event.attributes,
      situation_relation: link.relation,
      situation_id: link.situation_id,
      situation_root_event_id: link.root_event_id,
      ...(link.relationship_decision
        ? { situation_relationship_decision: link.relationship_decision }
        : {}),
      ...(link.relationship_reason
        ? { situation_relationship_reason: link.relationship_reason }
        : {}),
      ...(link.is_reinforcement ? { situation_reinforcement: true } : {}),
      ...(link.is_improvement_outcome ? { situation_improvement_outcome: true } : {}),
      ...(link.identity_mismatch ? { situation_identity_mismatch: true } : {}),
    };
  }
}

export function inferCareEventKindForSpine(params: {
  rawText: string;
  extractedType?: ExtractedType | string | null;
  documentOnly?: boolean;
}): CareEventKind {
  return classifyCareEventKind(
    params.rawText,
    (params.extractedType ?? undefined) as ExtractedType | undefined,
    params.documentOnly,
  );
}

/** Group CareContext events by durable situation_id (fallback: each event alone). */
export function groupEventsBySituationId(events: CanonicalCareEvent[]): {
  situation_id: string;
  root_event_id: string | null;
  event_ids: string[];
  events: CanonicalCareEvent[];
}[] {
  const order: string[] = [];
  const map = new Map<string, CanonicalCareEvent[]>();

  for (const event of events) {
    const key = event.situation_id ?? `orphan:${event.id}`;
    if (!map.has(key)) {
      order.push(key);
      map.set(key, []);
    }
    map.get(key)!.push(event);
  }

  return order.map((key) => {
    const group = map.get(key)!;
    const situation_id = group[0]?.situation_id ?? key;
    const root_event_id =
      group[0]?.root_event_id ??
      group.find((e) => e.root_event_id)?.root_event_id ??
      group[0]?.id ??
      null;
    return {
      situation_id,
      root_event_id,
      event_ids: group.map((e) => e.id),
      events: group,
    };
  });
}
