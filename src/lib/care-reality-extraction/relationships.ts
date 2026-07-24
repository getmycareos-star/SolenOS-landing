/**
 * Propose internal relationships — temporal / contextual / explicit only.
 * Never keyword-only. Never invent causation.
 * Certainty: supported | possible. Never expose kinds in caregiver UI.
 *
 * SoT: docs/02-product/solenos-relationship-extraction.md
 */

import type {
  ExtractedDecision,
  ExtractedEvent,
  ExtractedObservation,
  ExtractedOutcome,
  ExtractedRelationship,
  RelationshipKindInternal,
} from "./types";

export const RELATIONSHIP_EXTRACTION_ASK =
  "What changed, what connects to it, and what evidence supports that connection?";

export const RELATIONSHIP_EXTRACTION_NEVER_ASK =
  "What information exists? (storage — not relationship intelligence)";

/** Caregiver UI must never show these — engine-only. */
export const RELATIONSHIP_ENUM_LEAKAGE_PATTERNS = [
  /\bobservation_to_event\b/i,
  /\bevent_to_decision\b/i,
  /\bdecision_to_outcome\b/i,
  /\bevent_to_outcome\b/i,
  /\bobservation_to_observation\b/i,
  /\bevent_to_event\b/i,
  /\brelationship(?:_type|_kind|_enum)?\s*[:=]\s*\w+/i,
  /\bcertainty:\s*(?:supported|possible)\b/i,
] as const;

export const RELATIONSHIP_CAUSATION_THEATER_PATTERNS = [
  /\bcaused\b/i,
  /\bdefinitely caused\b/i,
  /\bled to\b/i,
  /\bas a (?:direct )?result of\b/i,
  /\bbecause of (?:the )?(?:medication|fall|hospital|dementia)\b/i,
] as const;

export function containsRelationshipEnumLeakage(blob: string): boolean {
  return RELATIONSHIP_ENUM_LEAKAGE_PATTERNS.some((p) => p.test(blob));
}

export function containsRelationshipCausationTheater(blob: string): boolean {
  return RELATIONSHIP_CAUSATION_THEATER_PATTERNS.some((p) => p.test(blob));
}

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function shareTimeContext(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.toLowerCase() === b.toLowerCase();
}

/** Explicit discourse that one thing follows / belongs with another — structural, not topic nouns. */
function hasExplicitConnective(text: string): boolean {
  // Timing / sequence connectives only — not causal claims ("caused", "led to" alone)
  return /\b(?:after|before|during|following|then|related to|around the time|same (?:day|week)|around the same)\b/i.test(
    text,
  );
}

function sameCaptureContext(a: string, b: string): boolean {
  if (a === b) return true;
  // Shared substantial span (same paragraph / overlapping fragment) — not single keywords
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length < 40) return false;
  return long.includes(short.slice(0, Math.min(48, short.length)));
}

/**
 * Link objects when temporal, contextual, or explicit evidence supports a connection.
 * Does not invent causal claims. Does not use scenario-noun keyword matching.
 */
export function proposeExtractionRelationships(params: {
  observations: ExtractedObservation[];
  events: ExtractedEvent[];
  decisions: ExtractedDecision[];
  outcomes?: ExtractedOutcome[];
}): ExtractedRelationship[] {
  const out: ExtractedRelationship[] = [];
  const seen = new Set<string>();

  const push = (
    from_id: string,
    to_id: string,
    kind: RelationshipKindInternal,
    certainty: "supported" | "possible",
    evidence_note: string,
  ) => {
    const key = `${kind}:${from_id}->${to_id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      id: newId("rel"),
      from_id,
      to_id,
      kind,
      certainty,
      evidence_note,
    });
  };

  // Observation → Event
  for (const evt of params.events) {
    for (const obs of params.observations) {
      if (evt.related_observation_ids.includes(obs.id)) {
        push(
          obs.id,
          evt.id,
          "observation_to_event",
          "supported",
          "Observation linked on the event object",
        );
        continue;
      }
      if (shareTimeContext(obs.approximate_time, evt.time)) {
        push(
          obs.id,
          evt.id,
          "observation_to_event",
          "possible",
          "Shared approximate timeframe in the same capture",
        );
        continue;
      }
      if (
        sameCaptureContext(obs.raw_fragment, evt.raw_fragment) ||
        hasExplicitConnective(`${obs.raw_fragment} ${evt.raw_fragment}`)
      ) {
        push(
          obs.id,
          evt.id,
          "observation_to_event",
          "possible",
          "Same capture context or explicit connective between fragments",
        );
      }
    }
  }

  // Event → Decision — never keyword-only; never “one event so link every decision”
  for (const evt of params.events) {
    for (const dec of params.decisions) {
      const sameFragment = evt.raw_fragment === dec.raw_fragment;
      const overlapping = sameCaptureContext(evt.raw_fragment, dec.raw_fragment);
      const temporal = shareTimeContext(evt.time, extractTimeFrom(dec.raw_fragment));
      const explicitOnDecision = hasExplicitConnective(dec.raw_fragment);
      // Same capture, sole event + sole decision → contextual co-occurrence (not keyword match)
      const solePairInCapture =
        params.events.length === 1 && params.decisions.length === 1;

      if (
        !sameFragment &&
        !overlapping &&
        !temporal &&
        !explicitOnDecision &&
        !solePairInCapture
      ) {
        continue;
      }

      push(
        evt.id,
        dec.id,
        "event_to_decision",
        sameFragment || (temporal && explicitOnDecision) ? "supported" : "possible",
        sameFragment
          ? "Decision and event described in the same fragment"
          : temporal
            ? "Shared timeframe between event and decision"
            : solePairInCapture
              ? "Sole event and decision in the same capture — contextual co-occurrence"
              : "Decision-side connective or overlapping capture context",
      );
    }
  }

  // Decision/Event → Outcome (real outcome objects — never invent success)
  const outcomes = params.outcomes ?? [];
  for (const out of outcomes) {
    if (!out.related_id || !out.related_type) continue;
    if (out.related_type === "decision") {
      push(
        out.related_id,
        out.id,
        "decision_to_outcome",
        out.status === "observed" ? "supported" : "possible",
        "Outcome linked to prior decision with evidence of change afterward",
      );
    } else {
      push(
        out.related_id,
        out.id,
        "event_to_outcome",
        out.status === "observed" ? "supported" : "possible",
        "Outcome linked to prior event with evidence of change afterward",
      );
    }
  }

  // Observation → Observation: shared time or explicit connective — not every adjacent pair
  for (let i = 0; i < params.observations.length - 1; i++) {
    const a = params.observations[i]!;
    const b = params.observations[i + 1]!;
    const temporal = shareTimeContext(a.approximate_time, b.approximate_time);
    const explicit =
      hasExplicitConnective(`${a.raw_fragment} ${b.raw_fragment}`) ||
      sameCaptureContext(a.raw_fragment, b.raw_fragment);
    if (!temporal && !explicit) continue;
    push(
      a.id,
      b.id,
      "observation_to_observation",
      temporal ? "possible" : "possible",
      temporal
        ? "Shared approximate timeframe across observations"
        : "Adjacent observations with shared capture context",
    );
  }

  // Event → Event: shared time or explicit transition connective
  for (let i = 0; i < params.events.length - 1; i++) {
    const a = params.events[i]!;
    const b = params.events[i + 1]!;
    const temporal = shareTimeContext(a.time, b.time);
    const explicit = hasExplicitConnective(`${a.raw_fragment} ${b.raw_fragment}`);
    if (!temporal && !explicit) continue;
    push(
      a.id,
      b.id,
      "event_to_event",
      temporal && explicit ? "supported" : "possible",
      "Related journey occurrences in the same capture",
    );
  }

  return out.slice(0, 24);
}

function extractTimeFrom(text: string): string | null {
  const m = text.match(
    /\b(?:yesterday|today|this morning|last night|last week|couple of weeks|few days ago|days? ago)\b/i,
  );
  return m ? m[0]! : null;
}

/**
 * Caregiver-facing connection language from relationships.
 * Never exposes kind enums, edge labels, or causation theater.
 */
export function composeCaregiverConnectionFromRelationships(params: {
  relationships: ExtractedRelationship[];
  observations: ExtractedObservation[];
  events: ExtractedEvent[];
  decisions: ExtractedDecision[];
  isNewCareReality?: boolean;
}): string | null {
  const rels = params.relationships;
  if (rels.length === 0) return null;

  const byId = new Map<string, string>();
  for (const o of params.observations) byId.set(o.id, o.description);
  for (const e of params.events) byId.set(e.id, e.description);
  for (const d of params.decisions) byId.set(d.id, d.description);

  let line: string | null = null;

  const eventDecision = rels.find((r) => r.kind === "event_to_decision");
  if (eventDecision) {
    const from = byId.get(eventDecision.from_id)?.replace(/\.$/, "") ?? null;
    const to = byId.get(eventDecision.to_id)?.replace(/\.$/, "") ?? null;
    if (from && to) {
      line =
        eventDecision.certainty === "possible"
          ? `A journey moment and a care choice may connect — held without assuming why.`
          : `A care choice stays with the journey moment around it.`;
    }
  }

  if (!line) {
    const obsEvent = rels.find((r) => r.kind === "observation_to_event");
    if (obsEvent) {
      line =
        obsEvent.certainty === "possible"
          ? `What was noticed and what happened around the same time stay connected — connection possible, not proven.`
          : `What was noticed stays connected with what happened around it.`;
    }
  }

  if (!line) {
    const decOut = rels.find((r) => r.kind === "decision_to_outcome");
    if (decOut) {
      line =
        decOut.certainty === "possible"
          ? `What happened after a care choice stays connected — link possible, cause not assumed.`
          : `What happened after a care choice stays with that choice in the care story.`;
    }
  }

  if (!line) {
    const obsObs = rels.find((r) => r.kind === "observation_to_observation");
    if (obsObs) {
      line = `Related things noticed stay connected as the care story begins.`;
    }
  }

  if (!line && !params.isNewCareReality) {
    line = `Connected pieces stay in the care story so change is easier to see later.`;
  }

  if (!line) return null;
  if (containsRelationshipEnumLeakage(line) || containsRelationshipCausationTheater(line)) {
    return `Held moments stay connected where timing or context supports it — without assuming cause.`;
  }
  return line;
}
