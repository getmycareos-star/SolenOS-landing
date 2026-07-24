/**
 * Situation Generator — transform scattered observations into an Active Situation.
 * Answers: what situation is this caregiver living through?
 *
 * SoT: docs/02-product/solenos-situation-generator.md
 * Derived understanding only — does not replace ACS durable store.
 * Doc examples are illustrations only — never product if-branches on scenario nouns.
 */

import type { ActiveCareSituation } from "../active-care-situation/types";
import { listDecisionMemory } from "../decision-memory";
import { observationCareFact } from "../care-epistemics";
import { classifyExtractionFragment } from "../care-reality-extraction/classify";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";
import {
  buildCareRecipientAnchor,
  type CareRecipientAnchor,
} from "./care-recipient-anchor";
import {
  compareAgainstBaseline,
  type BaselineComparisonResult,
} from "./baseline-comparison-engine";
import {
  ingestCareRealityMemoryFromCapture,
  type CareRealityMemoryObject,
} from "./care-reality-memory";
import {
  classifyClinicalSituations,
  preferClinicalHumanOrientation,
  type ClinicalSituationClassification,
} from "./clinical-situation-classification";
import {
  preserveUncertainty,
  preferUncertaintyOrientation,
  type UncertaintyPreservationModel,
} from "./uncertainty-preservation";

export const SITUATION_GENERATOR_PURPOSE =
  "Transform scattered care observations into an understandable Active Situation — never a fact-list summary.";

/** Engine-only — never expose % or bands in caregiver UI. */
export type SituationConfidenceBand = "low" | "medium" | "high";

export type SituationConfidence = {
  observation: SituationConfidenceBand;
  cause: SituationConfidenceBand;
};

export type PossibleSituationLink = {
  summary: string;
  certainty: "supported" | "possible" | "needs_confirmation";
};

/** Internal Active Situation — understanding projection for orientation. */
export type GeneratedActiveSituation = {
  care_recipient: string | null;
  current_concern: string | null;
  observed_changes: string[];
  related_events: string[];
  related_decisions: string[];
  possible_relationships: PossibleSituationLink[];
  family_context: string[];
  unknowns: string[];
  confidence: SituationConfidence;
  can_orient: boolean;
  /** ≥2 change facets — prefer situation orientation over thin initial ask. */
  is_rich_situation: boolean;
  baseline_comparison: BaselineComparisonResult;
  care_recipient_anchor: CareRecipientAnchor;
  /** Care Reality Memory objects written this turn (not text memory). */
  memory_objects: CareRealityMemoryObject[];
  /** Internal situation categories — reasoning only; never caregiver UI labels. */
  clinical_classification: ClinicalSituationClassification;
  /** Known / possible / unknown — never correlation as cause. */
  uncertainty_preservation: UncertaintyPreservationModel;
};

export const SITUATION_SUMMARY_THEATER_PATTERNS = [
  /\byou mentioned\b/i,
  /\byou said\b/i,
  /\bhere are the (?:key )?(?:points|facts|items)\b/i,
  /\bhere are your tasks\b/i,
  /\bto-?do list\b/i,
  /\bgeneric dementia\b/i,
  /\bpatients with dementia usually\b/i,
  /\bis declining\b/i,
  /\bdementia is progressing\b/i,
  /\bmedication (?:definitely |certainly )?caused\b/i,
] as const;

export function containsSituationSummaryTheater(blob: string): boolean {
  return SITUATION_SUMMARY_THEATER_PATTERNS.some((p) => p.test(blob));
}

function splitFacets(text: string): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\n+|;\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 10);
  const out: string[] = [];
  for (const s of sentences) {
    // Split compound reports: "X, he Y, and after Z"
    const parts = s.split(
      /,\s*(?=he\b|she\b|they\b)|,\s*and\s+(?=after\b|then\b|also\b|he\b|she\b)|(?<![,])\s+and\s+(?=(?:he|she|they|after|yesterday|today|also|then)\b)/i,
    );
    if (parts.length >= 2 && parts.every((p) => p.trim().length >= 8)) {
      for (const p of parts) out.push(p.trim().replace(/^and\s+/i, ""));
    } else {
      out.push(s);
    }
  }
  return out;
}

function looksLikeReportedChange(text: string): boolean {
  return /\b(?:started|stopped|no longer|more|less|lately|recently|these days|doesn't|does not|isn't|seems? more|after .{0,40}(?:changed|change)|forgot|forgetting|tired|confused|confusion|left (?:the )?(?:house|home))\b/i.test(
    text,
  );
}

function looksLikeMedicalEvent(text: string): boolean {
  return /\b(?:hospital|discharg|medication|medicine|doctor|appointment|procedure|surgery|clinic)\b/i.test(
    text,
  );
}

function looksLikeSafety(text: string): boolean {
  return /\b(?:left (?:the )?(?:house|home)|trying to leave|fell|fall|wander|unsafe|got lost)\b/i.test(
    text,
  );
}

function prioritizeLines(lines: string[]): string[] {
  const scored = lines.map((line) => {
    let score = 0;
    if (looksLikeSafety(line)) score += 40;
    if (looksLikeReportedChange(line)) score += 30;
    if (looksLikeMedicalEvent(line)) score += 20;
    return { line, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const out: string[] = [];
  for (const s of scored) {
    if (!out.some((x) => x.toLowerCase().slice(0, 36) === s.line.toLowerCase().slice(0, 36))) {
      out.push(s.line);
    }
  }
  return out;
}

function uniq(arr: string[]): string[] {
  const out: string[] = [];
  for (const x of arr) {
    if (!out.some((y) => y.toLowerCase() === x.toLowerCase())) out.push(x);
  }
  return out;
}

function possessiveUnderstanding(who: string | null): string {
  if (!who || who === "they") {
    return "Routine, energy level, and daily behavior appear to have changed recently.";
  }
  // Relationship labels — structural, not scenario hardcoding of clinical content
  if (/^(dad|father)$/i.test(who)) {
    return "Your father's routine, energy level, and daily behavior appear to have changed recently.";
  }
  if (/^(mom|mum|mother)$/i.test(who)) {
    return "Your mother's routine, energy level, and daily behavior appear to have changed recently.";
  }
  return `${who}'s routine, energy level, and daily behavior appear to have changed recently.`;
}

/**
 * Generate internal Active Situation from ACS + latest capture.
 * Does not invent diagnosis or causation.
 */
export function generateActiveSituation(params: {
  situation: ActiveCareSituation;
  latestRawText?: string;
  careKey?: string;
  person?: string | null;
  /** Durable CRS — comparable prior when ACS is a fresh session. */
  crs?: {
    current_understanding?: string[] | null;
    supporting_evidence?: Array<{ observation: string }> | null;
    observation_count?: number | null;
    revision?: number | null;
  } | null;
}): GeneratedActiveSituation {
  const careKey =
    params.careKey ??
    params.situation.care_recipient_id ??
    params.situation.caregiver_id;
  const resolvedKey = resolveCareRealityStoreKey(careKey);
  const latest = params.latestRawText?.trim() ?? "";

  const care_recipient_anchor = buildCareRecipientAnchor({
    situation: params.situation,
    latestRawText: latest,
    careKey: resolvedKey,
  });
  const person = params.person ?? care_recipient_anchor.care_recipient;

  const baseline_comparison = compareAgainstBaseline({
    situation: params.situation,
    latestRawText: latest,
    careKey: resolvedKey,
    person,
    seedFromCapture: true,
    crs: params.crs ?? null,
  });

  const observed_changes: string[] = [];
  const related_events: string[] = [];
  const related_decisions: string[] = [];
  const family_context: string[] = [];
  const unknowns: string[] = [];
  const possible_relationships: PossibleSituationLink[] = [];

  if (baseline_comparison.mode === "change_detection") {
    for (const c of baseline_comparison.meaningful_changes) {
      observed_changes.push(c.endsWith(".") ? c : `${c}.`);
    }
  } else {
    for (const c of baseline_comparison.current_concerns) {
      if (looksLikeReportedChange(c) || looksLikeSafety(c)) {
        observed_changes.push(c.endsWith(".") ? c : `${c}.`);
      }
    }
  }
  for (const e of baseline_comparison.related_context) {
    related_events.push(e);
  }

  const extraction = care_recipient_anchor.extraction;
  if (extraction) {
    for (const o of extraction.observations) {
      const line = o.description.endsWith(".") ? o.description : `${o.description}.`;
      if (looksLikeReportedChange(line) || looksLikeSafety(line)) {
        if (!observed_changes.some((x) => x.toLowerCase().includes(line.toLowerCase().slice(0, 32)))) {
          observed_changes.push(line);
        }
      }
    }
    for (const e of extraction.events) {
      related_events.push(e.description);
    }
    for (const d of extraction.decisions) {
      related_decisions.push(d.description);
    }
    for (const u of extraction.unknowns) {
      if (u.status === "open") unknowns.push(u.question);
    }
    for (const n of extraction.non_care_facts) {
      family_context.push(n.text);
    }
    for (const r of extraction.relationships) {
      if (r.certainty === "possible" || r.certainty === "supported") {
        possible_relationships.push({
          summary: r.evidence_note || "Possible connection between held care moments.",
          certainty: r.certainty === "supported" ? "supported" : "needs_confirmation",
        });
      }
    }
  }

  if (latest) {
    for (const facet of splitFacets(latest)) {
      const cat = classifyExtractionFragment(facet);
      if (cat === "contributor_load" || cat === "disagreement_perspective") {
        family_context.push(facet);
        continue;
      }
      if (looksLikeMedicalEvent(facet) && !looksLikeReportedChange(facet)) {
        related_events.push(facet.endsWith(".") ? facet : `${facet}.`);
        continue;
      }
      if (looksLikeReportedChange(facet) || looksLikeSafety(facet)) {
        const line = facet.endsWith(".") ? facet : `${facet}.`;
        if (!observed_changes.some((x) => x.toLowerCase().includes(facet.toLowerCase().slice(0, 28)))) {
          observed_changes.push(line);
        }
      }
    }
  }

  for (const o of [...params.situation.observations].reverse()) {
    const fact = observationCareFact({
      human_fact: o.human_fact,
      raw_text: o.raw_text,
    });
    if (!fact) continue;
    const cat = classifyExtractionFragment(fact);
    if (cat === "contributor_load" || cat === "disagreement_perspective") {
      family_context.push(fact);
      continue;
    }
    if (looksLikeMedicalEvent(fact)) {
      if (!related_events.some((e) => e.toLowerCase().includes(fact.toLowerCase().slice(0, 28)))) {
        related_events.push(fact.endsWith(".") ? fact : `${fact}.`);
      }
    }
  }

  for (const d of listDecisionMemory(resolvedKey).slice(-4)) {
    if (d.what) related_decisions.push(d.what);
  }

  const medLinked =
    /\bafter .{0,40}(?:medication|medicine).{0,20}(?:changed|change)/i.test(latest) ||
    (related_events.some((e) => /medication|medicine/i.test(e)) &&
      observed_changes.some((c) => /tired|sleep|energy|more/i.test(c)));
  if (medLinked) {
    possible_relationships.push({
      summary:
        "Medication adjustment may be related to the new tiredness — connection possible, not confirmed.",
      certainty: "needs_confirmation",
    });
  }

  if (
    related_events.some((e) => /hospital|discharg/i.test(e)) &&
    observed_changes.some((c) => /sleep|tired|confused/i.test(c))
  ) {
    if (!possible_relationships.some((p) => /hospital/i.test(p.summary))) {
      possible_relationships.push({
        summary:
          "Changes appear around the same period as a hospital-related event — relationship possible; cause unclear.",
        certainty: "needs_confirmation",
      });
    }
  }

  const prioritizedChanges = prioritizeLines(uniq(observed_changes)).slice(0, 5);
  const prioritizedEvents = prioritizeLines(uniq(related_events)).slice(0, 4);
  const prioritizedDecisions = uniq(related_decisions).slice(0, 3);
  const prioritizedFamily = uniq(family_context).slice(0, 3);

  for (const u of baseline_comparison.unknowns) {
    if (!unknowns.some((x) => x.toLowerCase() === u.toLowerCase())) unknowns.push(u);
  }
  if (prioritizedChanges.length >= 2 && !unknowns.some((u) => /when|start|began/i.test(u))) {
    unknowns.push("When these changes first started");
  }
  if (
    possible_relationships.some((p) => /medication/i.test(p.summary)) &&
    !unknowns.some((u) => /immediately after|medication change/i.test(u))
  ) {
    unknowns.unshift(
      "Whether the tiredness began immediately after the medication change",
    );
  }
  if (
    possible_relationships.length > 0 &&
    !unknowns.some((u) => /other factors/i.test(u))
  ) {
    unknowns.push("Whether other factors contributed");
  }

  let current_concern: string | null = null;
  const who = person && person !== "they" ? person : null;
  if (prioritizedChanges.length >= 2) {
    current_concern = possessiveUnderstanding(who);
  } else if (prioritizedChanges[0] && prioritizedEvents[0]) {
    current_concern = who
      ? `A change in ${who}'s care reality is held around the same time as a related care event.`
      : "A change in care reality is held around the same time as a related care event.";
  } else if (prioritizedChanges[0]) {
    current_concern = who
      ? `A current care concern for ${who} is held: ${prioritizedChanges[0].replace(/\.$/, "")}.`
      : `A current care concern is held: ${prioritizedChanges[0].replace(/\.$/, "")}.`;
  } else if (baseline_comparison.current_concerns[0]) {
    current_concern = baseline_comparison.current_concerns[0]!;
  }

  const is_rich_situation = prioritizedChanges.length >= 2;

  const can_orient =
    Boolean(current_concern) ||
    prioritizedChanges.length > 0 ||
    prioritizedEvents.length > 0;

  // Care Reality Memory — store journey objects, not sentences
  const memoryIngest = ingestCareRealityMemoryFromCapture({
    careKey: resolvedKey,
    rawText: latest || params.situation.observations.slice(-1)[0]?.raw_text || "",
    subject: person,
    contributorId: params.situation.caregiver_id,
    extraction: care_recipient_anchor.extraction,
  });

  // Internal clinical situation classification — reasoning only
  const clinical_classification = classifyClinicalSituations({
    rawText: latest || prioritizedChanges.join(" "),
  });

  for (const link of clinical_classification.links) {
    const note = link.note;
    if (!possible_relationships.some((p) => p.summary === note)) {
      possible_relationships.push({
        summary: note,
        certainty: link.certainty === "supported" ? "supported" : "needs_confirmation",
      });
    }
  }

  // Uncertainty preservation — what happened vs why (never correlation→cause)
  const uncertainty_preservation = preserveUncertainty({
    rawText: latest || prioritizedChanges.join(" "),
    careRecipient: person,
  });

  for (const link of uncertainty_preservation.possible_relationships) {
    if (!possible_relationships.some((p) => p.summary === link.summary)) {
      possible_relationships.push({
        summary: link.summary,
        certainty: "needs_confirmation",
      });
    }
  }
  for (const u of uncertainty_preservation.what_remains_unclear) {
    if (!unknowns.some((x) => x.toLowerCase() === u.toLowerCase())) {
      unknowns.push(u);
    }
  }

  // Prefer multi-category human orientation over thin fact concern
  let orientedConcern = preferClinicalHumanOrientation({
    classification: clinical_classification,
    fallback: current_concern,
  });
  // Prefer uncertainty-preserving language when timing + possible links exist
  orientedConcern = preferUncertaintyOrientation({
    model: uncertainty_preservation,
    fallback: orientedConcern,
  });
  if (orientedConcern) {
    current_concern = orientedConcern;
  }

  return {
    care_recipient: person,
    current_concern,
    observed_changes: prioritizedChanges,
    related_events: prioritizedEvents,
    related_decisions: prioritizedDecisions,
    possible_relationships: uniq(
      possible_relationships.map((p) => p.summary),
    ).map((summary) => {
      const found = possible_relationships.find((p) => p.summary === summary)!;
      return found;
    }).slice(0, 3),
    family_context: prioritizedFamily,
    unknowns: uniq(unknowns).slice(0, 4),
    confidence: {
      observation:
        uncertainty_preservation.primary_observation_confidence !== "low"
          ? uncertainty_preservation.primary_observation_confidence
          : prioritizedChanges.length >= 2
            ? "high"
            : prioritizedChanges.length >= 1
              ? "medium"
              : "low",
      // Cause confidence stays low unless evidence supports — never upgrade from timing alone
      cause: uncertainty_preservation.primary_cause_confidence,
    },
    can_orient,
    is_rich_situation,
    baseline_comparison,
    care_recipient_anchor,
    memory_objects: memoryIngest.objects,
    clinical_classification,
    uncertainty_preservation,
  };
}

/**
 * Human orientation — what we understand, not what they wrote.
 */
export function orientationFromGeneratedSituation(
  generated: GeneratedActiveSituation,
): {
  current_understanding: string | null;
  what_changed: string | null;
  still_unclear: string[];
  one_thing_to_add: string | null;
  connected_note: string | null;
} {
  if (!generated.can_orient) {
    return {
      current_understanding: null,
      what_changed: null,
      still_unclear: [],
      one_thing_to_add: null,
      connected_note: null,
    };
  }

  const who =
    generated.care_recipient && generated.care_recipient !== "they"
      ? generated.care_recipient
      : null;

  let current_understanding =
    preferUncertaintyOrientation({
      model: generated.uncertainty_preservation,
      fallback: preferClinicalHumanOrientation({
        classification: generated.clinical_classification,
        fallback:
          generated.is_rich_situation && generated.observed_changes.length >= 2
            ? possessiveUnderstanding(who)
            : generated.current_concern,
      }),
    }) ?? generated.current_concern;

  if (current_understanding && containsSituationSummaryTheater(current_understanding)) {
    current_understanding = generated.current_concern;
  }

  const changeLines = generated.observed_changes.slice(0, 3).map((c) => c.replace(/\.$/, ""));
  let what_changed =
    changeLines.length > 0 ? `${changeLines.join("; ")}.` : null;

  // When clinical categories hold a multi-facet situation, prefer human change phrases
  // over a raw-input echo (notes-app summary failure).
  if (generated.clinical_classification.primary.length >= 2) {
    const clinicalPhrases: string[] = [];
    const has = (id: (typeof generated.clinical_classification.primary)[number]) =>
      generated.clinical_classification.primary.includes(id);
    if (has("safety_concern")) clinicalPhrases.push("a recent safety concern");
    if (has("cognitive_change")) clinicalPhrases.push("increased confusion or memory change");
    if (has("behavioral_change")) clinicalPhrases.push("a change in usual responses");
    if (has("functional_decline")) clinicalPhrases.push("a change in daily independence");
    if (has("medication_transition")) clinicalPhrases.push("a medication change");
    if (has("nutrition_hydration_change")) clinicalPhrases.push("a change in eating or drinking");
    if (has("sleep_change")) clinicalPhrases.push("a change in sleep");
    if (clinicalPhrases.length >= 2) {
      what_changed = `${clinicalPhrases.slice(0, 4).join("; ")}.`;
    }
  }

  const connected_note =
    generated.uncertainty_preservation.what_may_be_connected[0] ??
    (generated.possible_relationships[0]
      ? generated.possible_relationships[0].summary
      : generated.family_context[0]
        ? "Different people may see the situation differently — held as context, not as the main concern."
        : null);

  const still_unclear: string[] = [];
  if (generated.uncertainty_preservation.what_remains_unclear.length > 0) {
    for (const u of generated.uncertainty_preservation.what_remains_unclear.slice(0, 3)) {
      still_unclear.push(u);
    }
  } else if (generated.possible_relationships.some((p) => /medication/i.test(p.summary))) {
    still_unclear.push(
      "Whether the tiredness began immediately after the medication change",
    );
    still_unclear.push("Whether other factors contributed");
  } else {
    for (const u of generated.unknowns.slice(0, 2)) {
      still_unclear.push(u);
    }
  }

  let one_thing_to_add: string | null = null;
  if (generated.uncertainty_preservation.what_remains_unclear[0]) {
    const u = generated.uncertainty_preservation.what_remains_unclear[0]!;
    one_thing_to_add = u.endsWith("?") ? u : `${u.replace(/\.$/, "")}?`;
  } else if (generated.possible_relationships.some((p) => /medication/i.test(p.summary))) {
    one_thing_to_add =
      "When was the medication changed, and what was the reason for the change?";
  } else if (still_unclear[0]) {
    one_thing_to_add = still_unclear[0]!.endsWith("?")
      ? still_unclear[0]!
      : /^(whether|when|what|who|how)\b/i.test(still_unclear[0]!)
        ? `${still_unclear[0].replace(/\.$/, "")}?`
        : still_unclear[0]!;
  }

  // Prefer the high-value medication ask as the caregiver-facing still_unclear when present
  const caregiverAsks = one_thing_to_add
    ? [one_thing_to_add, ...still_unclear.filter((u) => /^(whether|when|what)/i.test(u))]
    : still_unclear;

  return {
    current_understanding,
    what_changed,
    still_unclear: caregiverAsks.slice(0, 3),
    one_thing_to_add,
    connected_note,
  };
}
