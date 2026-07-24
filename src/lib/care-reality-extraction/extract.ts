/**
 * Extract Observation / Event / Decision / Outcome / Unknown / Relationship layers from messy text.
 */

import type {
  CareRealityExtractionResult,
  ExtractedAction,
  ExtractedDecision,
  ExtractedEvent,
  ExtractedNonCareFact,
  ExtractedObservation,
  ExtractedOutcome,
  ObservationConfidence,
} from "./types";
import { classifyExtractionFragment } from "./classify";
import { proposeExtractionRelationships } from "./relationships";
import {
  createExtractedEvent,
  linkRelatedObservationsToEvents,
} from "./events";
import {
  createExtractedDecision,
  linkDecisionEvidence,
  looksLikeRecommendationNotDecision,
} from "./decisions";
import { createExtractedAction } from "./actions";
import {
  applyOutcomesOntoDecisions,
  attachRelatedToOutcomes,
  createExtractedOutcome,
  looksLikeInterpretationWithoutEvidence,
} from "./outcomes";
import {
  attachRelatedObjectsToUnknowns,
  createExtractedUnknown,
  dedupeExtractedUnknowns,
  unknownsFromConflictingPerspectives,
  unknownsFromReasonUnknownDecisions,
} from "./unknowns";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Partition a single run-on / comma-joined caregiver clause into care facets.
 * Structural splits only — never invents content (mirrors baseline clause partitioning).
 */
export function splitCompoundCareClauses(block: string): string[] {
  const s = block.replace(/\s+/g, " ").trim();
  if (!s) return [];
  const parts = s.split(
    /,\s*(?=he\b|she\b|they\b|i\b|we\b)|,\s*and\s+(?=after\b|then\b|also\b|he\b|she\b|i\b|we\b)|(?<![,])\s+and\s+(?=(?:yesterday|today|this morning|then|also|she|he|they|after|i\s+(?:took|brought|drove|called)|we\s+(?:took|brought|drove|called))\b)/i,
  );
  if (parts.length >= 2 && parts.every((p) => p.trim().length >= 8)) {
    return parts.map((p) => p.trim().replace(/^and\s+/i, "")).filter((p) => p.length >= 8);
  }
  return [s];
}

/**
 * Split messy caregiver text into fragments (paragraphs, then sentences, then compound clauses).
 * Does not invent content — only partitions.
 */
export function splitExtractionFragments(raw: string): string[] {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return [];

  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, " ").trim())
    .filter((p) => p.length >= 12);

  const candidates = paras.length >= 2 ? paras : [text.replace(/\n/g, " ").trim()];

  const out: string[] = [];
  for (const block of candidates) {
    const sentences = block
      .split(/(?<=[.!?])\s+|;\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 8);
    const sentenceBlocks = sentences.length >= 2 ? sentences : [block];
    for (const sentence of sentenceBlocks) {
      // Always partition multi-clause mess so Observation vs Action/Event stay separate layers.
      out.push(...splitCompoundCareClauses(sentence));
    }
  }

  const seen = new Set<string>();
  return out.filter((f) => {
    const k = f.toLowerCase().slice(0, 80);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function extractTimeHint(text: string): string | null {
  const m = text.match(
    /\b(?:yesterday|today|this morning|last night|last week|couple of weeks|few days ago|days? ago|over the last[^.!]{0,40}|last week)\b/i,
  );
  return m ? m[0]! : null;
}

function confidenceForObservation(text: string): ObservationConfidence {
  if (/\bi(?:'m| am)? not sure\b/i.test(text) || /\bmaybe\b/i.test(text)) return "low";
  if (/\b(?:noticed|saw|heard|asked|tried|did)\b/i.test(text)) return "high";
  return "medium";
}

/**
 * Full extraction pass for one caregiver note (any length).
 * Never converts Unknown into Observation facts.
 */
export function extractCareRealityFromText(params: {
  rawText: string;
  source?: string;
  contributorId?: string;
}): CareRealityExtractionResult {
  const source = params.source ?? params.contributorId ?? "caregiver";
  const fragments = splitExtractionFragments(params.rawText);

  const observations: ExtractedObservation[] = [];
  const events: ExtractedEvent[] = [];
  const decisions: ExtractedDecision[] = [];
  const actions: ExtractedAction[] = [];
  let outcomes: ExtractedOutcome[] = [];
  let unknowns = [] as ReturnType<typeof createExtractedUnknown>[];
  const non_care_facts: ExtractedNonCareFact[] = [];

  for (const fragment of fragments) {
    const category = classifyExtractionFragment(fragment);

    if (category === "skip") continue;

    if (category === "contributor_load" || category === "disagreement_perspective") {
      non_care_facts.push({
        id: newId("ncf"),
        layer: category,
        text: fragment.trim().slice(0, 280),
        raw_fragment: fragment,
      });
      continue;
    }

    if (category === "outcome") {
      // Never promote bare interpretation theater into an outcome object
      if (looksLikeInterpretationWithoutEvidence(fragment)) continue;
      outcomes.push(
        createExtractedOutcome({
          raw_fragment: fragment,
          source,
        }),
      );
      continue;
    }

    if (category === "unknown") {
      unknowns.push(
        createExtractedUnknown({
          questionOrFragment: fragment.trim().slice(0, 240),
          source,
          raw_fragment: fragment,
          status: "open",
        }),
      );
      const beforeUnsure = fragment.split(/\bi(?:'m| am)? not sure\b/i)[0]?.trim();
      if (
        beforeUnsure &&
        beforeUnsure.length >= 20 &&
        classifyExtractionFragment(beforeUnsure) === "observation"
      ) {
        observations.push({
          id: newId("obs"),
          layer: "observation",
          description: beforeUnsure.replace(/,\s*$/, "").slice(0, 240),
          approximate_time: extractTimeHint(beforeUnsure),
          source,
          confidence: "low",
          raw_fragment: fragment,
        });
      }
      continue;
    }

    if (category === "decision") {
      if (looksLikeRecommendationNotDecision(fragment)) continue;
      const dec = createExtractedDecision({ raw_fragment: fragment });
      decisions.push(dec);
      // Timing uncertainty co-occurring with a care decision — preserve as Unknown, never invent cause.
      if (
        /\b(?:can'?t remember|don'?t know|not sure|unsure)\b/i.test(fragment) &&
        /\b(?:before or after|before|after)\b/i.test(fragment)
      ) {
        unknowns.push(
          createExtractedUnknown({
            questionOrFragment: fragment,
            source,
            raw_fragment: fragment,
            related_object_id: dec.id,
            related_object_type: "decision",
            status: "open",
          }),
        );
      }
      if (/\bhospital\b/i.test(fragment) && /\bvisit\b/i.test(fragment)) {
        const eventPart =
          fragment.match(/[^.!?]*(?:hospital|clinic)[^.!?]*[.!?]?/i)?.[0]?.trim() ?? null;
        if (eventPart && eventPart.length >= 16) {
          events.push(
            createExtractedEvent({
              raw_fragment: fragment,
              description: eventPart,
            }),
          );
        }
      }
      continue;
    }

    if (category === "action") {
      actions.push(createExtractedAction({ raw_fragment: fragment, source }));
      continue;
    }

    if (category === "event") {
      events.push(createExtractedEvent({ raw_fragment: fragment }));
      continue;
    }

    if (category === "observation") {
      observations.push({
        id: newId("obs"),
        layer: "observation",
        description: fragment.trim().slice(0, 240),
        approximate_time: extractTimeHint(fragment),
        source,
        confidence: confidenceForObservation(fragment),
        raw_fragment: fragment,
      });
    }
  }

  // Related observations: link existing ids only — never mint observations here
  linkRelatedObservationsToEvents({ events, observations });
  linkDecisionEvidence({ decisions, observations, events });
  if (actions.length > 0 && decisions.length > 0) {
    for (const act of actions) {
      if (!act.related_decision_id) {
        act.related_decision_id = decisions[0]!.id;
      }
    }
  }

  unknowns = dedupeExtractedUnknowns([
    ...unknowns,
    ...unknownsFromReasonUnknownDecisions({ decisions, source }),
    ...unknownsFromConflictingPerspectives({ non_care_facts, source }),
  ]);
  unknowns = attachRelatedObjectsToUnknowns({
    unknowns,
    observations,
    events,
    decisions,
  });

  outcomes = attachRelatedToOutcomes({
    outcomes,
    decisions,
    events,
    observations,
  });
  applyOutcomesOntoDecisions({ decisions, outcomes });

  const relationships = proposeExtractionRelationships({
    observations,
    events,
    decisions,
    outcomes,
  });

  return {
    observations,
    events,
    decisions,
    actions,
    outcomes,
    unknowns,
    non_care_facts,
    relationships,
    observation_focus_lines: observations.map((o) =>
      o.description.endsWith(".") ? o.description : `${o.description}.`,
    ),
  };
}
