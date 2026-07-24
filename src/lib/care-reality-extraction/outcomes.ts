/**
 * Outcome layer — what changed after an event or decision, with evidence.
 * Never invent success. Never create from intentions. Preserve uncertainty.
 *
 * SoT: docs/02-product/solenos-outcome-extraction.md
 */

import type {
  ExtractedDecision,
  ExtractedEvent,
  ExtractedObservation,
  ExtractedOutcome,
  OutcomeRelatedType,
  OutcomeStatus,
} from "./types";

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Plans / wants / will-monitor — no outcome yet. */
export function looksLikeIntentionNotOutcome(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (
    /\b(?:wants? to|plans? to|going to|will|intend(?:s|ed)? to|hope(?:s|d)? to)\b/i.test(t) &&
    /\b(?:monitor|watch|check|follow\s*up|see how|keep an eye)\b/i.test(t)
  ) {
    return true;
  }
  if (/\b(?:to be monitored|for monitoring|will reassess)\b/i.test(t)) return true;
  return false;
}

/**
 * Bare success/failure interpretation without observed change detail.
 * "Medication worked" / "it was successful" — not an outcome without evidence.
 */
export function looksLikeInterpretationWithoutEvidence(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\b(?:worked|was successful|cured|fixed (?:it|everything)|miracle)\b/i.test(t)) {
    // Allow if concrete observed change is also stated
    if (
      /\b(?:reduced|increased|less|more|stopped|started|afterward|afterwards|since then)\b/i.test(
        t,
      )
    ) {
      return false;
    }
    return true;
  }
  return false;
}

/** Temporal / resultative discourse that something followed a prior change or choice. */
function hasAfterConnective(text: string): boolean {
  return /\b(?:afterward|afterwards|after that|after (?:the|this|that)|since then|following that|as a result|in response|thereafter)\b/i.test(
    text,
  );
}

/** Observed change language (structural comparatives — not success labels). */
function hasObservedChangeLanguage(text: string): boolean {
  return /\b(?:reduced|decreased|increased|less|more|fewer|worse|better|stopped|started|returned|eased|worsened|improved|cleared|persisted|continued|came back)\b/i.test(
    text,
  );
}

/**
 * True when fragment is primarily an Outcome (result after), not Decision/Event/intention.
 * Standalone recipient-state change ("walking worse", "seems more confused") is Observation —
 * never Outcome — or it is dropped when no related decision exists (instant-value loss).
 */
export function looksLikeOutcomeFragment(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 10) return false;
  if (looksLikeIntentionNotOutcome(t)) return false;
  if (looksLikeInterpretationWithoutEvidence(t)) return false;

  // Outcome requires a resultative / after-prior connective — not bare perceived change.
  if (hasAfterConnective(t) && hasObservedChangeLanguage(t)) return true;

  // "X reduced after Y" / "after …, X changed"
  if (
    hasObservedChangeLanguage(t) &&
    /\bafter\b/i.test(t) &&
    !/\b(?:chang(?:ed|e)|switch(?:ed)?|start(?:ed)?|stopp(?:ed)?)\s+(?:one of |her |his |the )?(?:medications?|medicine|meds?|dose)\b/i.test(
      t,
    )
  ) {
    // Decision fragments that are "changed medication after visit" stay decisions (classify order).
    // Here: change language about recipient state after something.
    if (/\b(?:she|he|they|her|his|their)\b/i.test(t)) return true;
  }

  return false;
}

/**
 * Neutral outcome description — never upgrade perception into clinical certainty.
 */
export function normalizeOutcomeDescription(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "A change after a prior care moment was reported.";

  if (/\b(?:seems?|seemed|appears?|appeared|feels? like|felt like)\b/i.test(t)) {
    if (/\b(?:better|improved|improvement)\b/i.test(t)) {
      return "Caregiver reported perceived improvement.";
    }
    if (/\b(?:worse|worsened)\b/i.test(t)) {
      return "Caregiver reported perceived worsening.";
    }
    return `Caregiver reported: ${t.replace(/\.$/, "").slice(0, 200)}.`.slice(0, 240);
  }

  // Strip bare success theater if it slipped through
  if (looksLikeInterpretationWithoutEvidence(t)) {
    return "An interpretation was stated without observed change detail — not held as an outcome.";
  }

  return t.slice(0, 240);
}

function statusForOutcomeText(raw: string): OutcomeStatus {
  if (/\b(?:seems?|seemed|appears?|not sure|maybe|might)\b/i.test(raw)) return "uncertain";
  if (/\b(?:still|ongoing|continues|continuing|persists|persisting)\b/i.test(raw)) {
    return "ongoing";
  }
  if (/\b(?:resolved|cleared|back to|returned to)\b/i.test(raw)) return "resolved";
  if (/\b(?:changed again|then changed|later changed)\b/i.test(raw)) return "changed";
  if (hasAfterConnective(raw) || hasObservedChangeLanguage(raw)) return "observed";
  return "uncertain";
}

function extractTimeHint(text: string): string | null {
  const m = text.match(
    /\b(?:yesterday|today|this morning|last night|last week|couple of weeks|few days ago|days? ago|afterward|afterwards|since then)\b/i,
  );
  return m ? m[0]! : null;
}

export function createExtractedOutcome(params: {
  raw_fragment: string;
  source: string;
  related_id?: string | null;
  related_type?: OutcomeRelatedType | null;
  evidence_texts?: string[];
  status?: OutcomeStatus;
}): ExtractedOutcome {
  const description = normalizeOutcomeDescription(params.raw_fragment);
  return {
    id: newId("out"),
    layer: "outcome",
    description,
    related_id: params.related_id ?? null,
    related_type: params.related_type ?? null,
    time: extractTimeHint(params.raw_fragment),
    evidence_texts: params.evidence_texts ?? [params.raw_fragment.trim().slice(0, 240)],
    status: params.status ?? statusForOutcomeText(params.raw_fragment),
    raw_fragment: params.raw_fragment,
  };
}

function sameCaptureContext(a: string, b: string): boolean {
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length < 40) return false;
  return long.includes(short.slice(0, Math.min(48, short.length)));
}

/**
 * Attach related decision or event by shared capture / sole pair context.
 * Prefer decision when both exist in the same extract.
 */
export function attachRelatedToOutcomes(params: {
  outcomes: ExtractedOutcome[];
  decisions: ExtractedDecision[];
  events: ExtractedEvent[];
  observations: ExtractedObservation[];
}): ExtractedOutcome[] {
  return params.outcomes.map((o) => {
    if (o.related_id) {
      return {
        ...o,
        evidence_texts:
          o.evidence_texts.length > 0
            ? o.evidence_texts
            : [
                o.raw_fragment,
                ...params.observations.slice(0, 2).map((obs) => obs.description),
              ].slice(0, 4),
      };
    }

    for (const d of params.decisions) {
      if (sameCaptureContext(o.raw_fragment, d.raw_fragment) || o.raw_fragment === d.raw_fragment) {
        return {
          ...o,
          related_id: d.id,
          related_type: "decision" as const,
          evidence_texts: [
            o.raw_fragment,
            ...params.observations.slice(0, 2).map((obs) => obs.description),
          ].slice(0, 4),
        };
      }
    }

    // Sole decision in capture → contextual link (not keyword topic match)
    if (params.decisions.length === 1) {
      const d = params.decisions[0]!;
      return {
        ...o,
        related_id: d.id,
        related_type: "decision" as const,
        evidence_texts: [
          o.raw_fragment,
          ...params.observations.slice(0, 2).map((obs) => obs.description),
        ].slice(0, 4),
      };
    }

    for (const e of params.events) {
      if (sameCaptureContext(o.raw_fragment, e.raw_fragment) || o.raw_fragment === e.raw_fragment) {
        return {
          ...o,
          related_id: e.id,
          related_type: "event" as const,
          evidence_texts: [
            o.raw_fragment,
            ...params.observations.slice(0, 2).map((obs) => obs.description),
          ].slice(0, 4),
        };
      }
    }

    if (params.events.length === 1) {
      const e = params.events[0]!;
      return {
        ...o,
        related_id: e.id,
        related_type: "event" as const,
        evidence_texts: [
          o.raw_fragment,
          ...params.observations.slice(0, 2).map((obs) => obs.description),
        ].slice(0, 4),
      };
    }

    return o;
  });
}

/**
 * Sync decision.outcome string when a linked observed/uncertain outcome exists.
 * Does not invent success — copies neutral outcome description only.
 */
export function applyOutcomesOntoDecisions(params: {
  decisions: ExtractedDecision[];
  outcomes: ExtractedOutcome[];
}): void {
  for (const d of params.decisions) {
    const linked = params.outcomes.filter(
      (o) => o.related_type === "decision" && o.related_id === d.id,
    );
    if (linked.length === 0) continue;
    // Mixed outcomes: join neutrally — never collapse to success/failure
    const texts = linked.map((o) => o.description);
    d.outcome = texts.join(" · ").slice(0, 280);
    if (linked.every((o) => o.status === "uncertain")) {
      d.status = d.status === "needs_review" ? d.status : "uncertain";
    }
  }
}

/** Caregiver-facing line — never status enums or success theater. */
export function composeCaregiverOutcomeLine(outcome: ExtractedOutcome): string | null {
  const d = outcome.description.trim();
  if (!d) return null;
  if (/interpretation was stated without observed/i.test(d)) return null;
  if (outcome.status === "uncertain") {
    return d.endsWith(".") ? d : `${d}.`;
  }
  return d.endsWith(".") ? d : `${d}.`;
}
