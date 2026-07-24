import type { CanonicalCareEvent, SituationResponse } from "../situation-entry/types";
import {
  dedupeCaregiverFacingLines,
  isCaregiverSafeDisplayText,
  sanitizeCaregiverDisplayText,
  toCaregiverFacingLine,
} from "../mvp-input-architecture";
import { isCaregiverFacingAsk } from "../progressive-understanding/questions";
import type {
  ContinuityHomeView,
  PostEntryBehavior,
  PrioritySurfaceItem,
  SinceLastVisitDelta,
} from "./types";
import { getLastMvpVisit } from "./store";

/** Caregiver-facing event label — always original words, never schema type — entity. */
function eventLabel(event: CanonicalCareEvent): string {
  return sanitizeCaregiverDisplayText(event.raw_input).slice(0, 120);
}

function sanitizeLineList(raw: string[], max: number): string[] {
  const lines = raw
    .map((item) => toCaregiverFacingLine(item))
    .filter((line): line is string => Boolean(line));
  return dedupeCaregiverFacingLines(lines, max);
}

/** Continuity Home — same Response Contract as LCR: at most one open understanding gap. */
function sanitizeOpenAsks(raw: string[], max = 1): string[] {
  return sanitizeLineList(raw, max * 3)
    .filter(isCaregiverFacingAsk)
    .slice(0, max);
}

function dedupeIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * True delta since last visit only.
 * Never invent "new" by falling back to last-N events.
 */
function buildSinceLastVisit(
  caregiverId: string,
  events: CanonicalCareEvent[],
  currentUnresolved: string[],
  attentionEventIds: string[],
): SinceLastVisitDelta {
  const prior = getLastMvpVisit(caregiverId);
  const priorCount = Math.max(0, prior.prior_event_count);
  const newEvents =
    events.length > priorCount ? events.slice(priorCount) : [];
  const newEventIds = dedupeIds(newEvents.map((e) => e.id));

  const resolved = prior.prior_unresolved
    .filter((q) => !currentUnresolved.includes(q))
    .map((q) => toCaregiverFacingLine(q))
    .filter((line): line is string => Boolean(line));

  const newSet = new Set(newEventIds);
  const riskIds = dedupeIds(attentionEventIds).filter((id) => !newSet.has(id)).slice(0, 5);

  return {
    new_events: newEventIds,
    updated_events: events
      .filter((e) => e.status === "superseded" || e.integrity.superseded_by_id !== null)
      .slice(-5)
      .map((e) => e.id),
    resolved_uncertainties: dedupeCaregiverFacingLines(resolved, 5),
    newly_emerged_risks: riskIds,
  };
}

export function buildContinuityHomeView(input: {
  caregiver_id: string;
  response: Pick<
    SituationResponse,
    | "context"
    | "what_needs_clarification"
    | "what_is_uncertain"
    | "what_changed"
    | "priority_layer"
    | "document_events_count"
    | "dare"
  >;
  attention_event_ids: string[];
  pending_follow_ups?: string[];
}): ContinuityHomeView {
  const events = input.response.context.events;
  const unresolvedRaw = [
    ...input.response.what_needs_clarification,
    ...input.response.what_is_uncertain,
  ];
  const followUpsRaw =
    input.pending_follow_ups ?? input.response.what_needs_clarification;

  const sinceLastVisit = buildSinceLastVisit(
    input.caregiver_id,
    events,
    unresolvedRaw,
    input.attention_event_ids,
  );

  const listedIds = new Set([
    ...sinceLastVisit.new_events,
    ...sinceLastVisit.newly_emerged_risks,
  ]);

  const recentEvents = [...events]
    .sort((a, b) => b.ingestion_time.localeCompare(a.ingestion_time))
    .filter((e) => {
      const label = eventLabel(e);
      return label.length > 0 && isCaregiverSafeDisplayText(label);
    })
    .filter((e) => !listedIds.has(e.id))
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      label: eventLabel(e),
      timestamp: e.ingestion_time,
    }));

  const recentFallback =
    recentEvents.length > 0
      ? recentEvents
      : [...events]
          .sort((a, b) => b.ingestion_time.localeCompare(a.ingestion_time))
          .slice(0, 5)
          .map((e) => ({
            id: e.id,
            label: eventLabel(e),
            timestamp: e.ingestion_time,
          }))
          .filter((e) => e.label && isCaregiverSafeDisplayText(e.label));

  const docEvents = events.filter((e) => e.source === "document").slice(-5);
  const recentDocuments = docEvents.map((e) => ({
    event_id: e.id,
    name: sanitizeCaregiverDisplayText(e.document_id ?? e.raw_input).slice(0, 60),
    impact: "Added to the Living Care Record.",
  }));

  const upcoming = events
    .filter(
      (e) =>
        /meeting|appointment|visit|call|interview/i.test(e.raw_input) ||
        e.extracted_type === "coordination_issue" ||
        e.extracted_type === "contact_event" ||
        e.extracted_type === "follow_up",
    )
    .slice(-3)
    .map((e) => eventLabel(e))
    .filter((label) => isCaregiverSafeDisplayText(label));

  // No open-ended interview prompt — Continuity Home is hold, not quiz (ADR-022).
  const openAsks = sanitizeOpenAsks(
    [...input.response.what_needs_clarification, ...followUpsRaw],
    1,
  );

  const newlyImportant: PrioritySurfaceItem[] = [];

  return {
    system_state: "active_continuity",
    since_last_visit: sinceLastVisit,
    needs_attention: {
      unresolved_questions: openAsks,
      pending_follow_ups: [],
      missing_information: [],
    },
    newly_important: newlyImportant,
    recent_events: recentFallback,
    recent_documents: recentDocuments,
    upcoming_interactions: upcoming,
    reflection_prompt: null,
  };
}

export function buildPostEntryBehavior(
  response: Pick<
    SituationResponse,
    | "what_changed"
    | "what_merged_or_split"
    | "events_created"
    | "document_events_count"
    | "dare"
    | "is_first_situation"
  >,
  isCorrection = false,
): PostEntryBehavior {
  const conflicts = response.dare?.conflicts ?? [];
  const contradictionNotes = conflicts
    .map((c) => toCaregiverFacingLine(c.event_signal) ?? null)
    .filter((line): line is string => Boolean(line));

  const documentRefinement =
    response.document_events_count > 0
      ? `This document strengthened the Living Care Record in ${response.document_events_count} place${response.document_events_count === 1 ? "" : "s"}.`
      : null;

  const count = response.events_created.length;
  return {
    mode: "surface_impact",
    integration_summary:
      count === 1
        ? "This note was added to the Living Care Record."
        : `${count} notes were added to the Living Care Record.`,
    comparison_notes: sanitizeLineList(response.what_changed, 6),
    resolution_notes: sanitizeLineList(response.what_merged_or_split, 6),
    impact_summary:
      toCaregiverFacingLine(response.what_changed[0] ?? "") ??
      (response.is_first_situation
        ? "Your first note is now part of an evolving care record."
        : "Understanding updated from your latest note."),
    document_refinement: documentRefinement,
    contradictions_surfaced: contradictionNotes,
    correction_priority: isCorrection,
  };
}
