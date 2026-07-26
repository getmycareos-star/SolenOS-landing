/**
 * Build Care Situation Understanding from messy caregiver input.
 * Uses structured LLM extraction as primary path (when available),
 * falls back to deterministic/regex extraction (instant path).
 *
 * Never blocks orientation on LLM — fail-closed to deterministic path.
 * Never feeds /api/analyze 5-field compression into caregiver panel.
 * Accepts any caregiver input: text, document OCR, screenshots, mixed content.
 */

import { extractCareRealityFromText } from "../care-reality-extraction";
import {
  looksLikeContributorLoadFragment,
  looksLikeDisagreementPerspectiveFragment,
} from "../care-reality-extraction/classify";
import { classifyEpistemicClaim } from "../care-epistemics";
import { buildCareRecipientAnchor } from "../care-reality-intelligence/care-recipient-anchor";
import type { ActiveCareSituation } from "../active-care-situation/types";
import { prioritizeCareSituation, looksLikeFragmentationOrAdmin } from "./prioritize";
import { prioritizeFromUnderstanding } from "./prioritize-from-understanding";
import type {
  CareSituationFact,
  CareSituationInterpretation,
  CareSituationPossibleLink,
  CareSituationUnderstanding,
} from "./types";
import { llmStructuredUnderstanding } from "./llm-understanding";

function emptySituationStub(careKey: string): ActiveCareSituation {
  const now = new Date().toISOString();
  return {
    id: `csu_${careKey}`,
    caregiver_id: careKey,
    care_recipient_id: careKey,
    opened_at: now,
    updated_at: now,
    root_event_id: null,
    subject_label: "",
    theme: "mixed",
    observations: [],
    open_questions: [],
    asked_questions: [],
    understanding_stage: "gathering",
    connection_note: null,
    synthesis: null,
    what_matters_now: null,
    interaction_paused_at: null,
    lifecycle_status: "active",
    familiarity_baseline: [],
    pattern_label: null,
  };
}

function looksLikeRecipientSelfReportUncertain(text: string): boolean {
  return (
    /\b(?:says?|said|telling me)\b/i.test(text) &&
    /\b(?:fine|ok|okay|nothing|worried|worry)\b/i.test(text) &&
    /\b(?:don'?t know|not sure|whether|if)\b/i.test(text)
  );
}

function looksLikePossibleTimingLink(text: string): boolean {
  return (
    /\b(?:medication|medicine|meds?|dose)\b/i.test(text) &&
    /\b(?:chang(?:ed)|switch(?:ed)|start(?:ed)|stopp(?:ed)|adjust(?:ed))\b/i.test(text) &&
    /\b(?:before|after|started|began|timing|related|connect)\b/i.test(text)
  );
}

/**
 * Build Care Situation Understanding from extraction — used by sync path.
 * Does NOT attempt LLM; uses deterministic/regex extraction only.
 * Used by composeCaregiverResponse which must remain synchronous.
 *
 * When priorContinuityHooks or priorUnknowns are provided, they are merged
 * into the current turn's understanding for second-turn continuity.
 */
export function buildCareSituationUnderstandingFromExtraction(params: {
  rawText: string;
  contributorId?: string;
  careKey?: string;
  personDisplayName?: string | null;
  situation?: ActiveCareSituation | null;
  /** Continuity hooks from prior CRS turn — reconnects new input to existing care reality. */
  priorContinuityHooks?: string[];
  /** Open unknowns from prior CRS turn — carries forward unresolved uncertainty. */
  priorUnknowns?: string[];
}): CareSituationUnderstanding {
  const raw = (params.rawText ?? "").trim();
  const careKey =
    params.careKey ?? params.contributorId ?? params.situation?.care_recipient_id ?? "care";

  const situation = params.situation ?? emptySituationStub(careKey);
  const anchor = buildCareRecipientAnchor({
    situation,
    latestRawText: raw,
    careKey,
  });

  // Deterministic/regex extraction only (synchronous)
  const extraction = anchor.extraction ?? extractCareRealityFromText({
    rawText: raw,
    source: params.contributorId ?? careKey,
  });

  const facts: CareSituationFact[] = [];
  const interpretations: CareSituationInterpretation[] = [];
  const unknowns: string[] = [];
  const possible_links: CareSituationPossibleLink[] = [];
  const context_only: string[] = [];
  const changes_from_baseline: string[] = [];

  for (const e of extraction.events) {
    facts.push({ kind: "event", text: e.description, source_fragment: e.raw_fragment });
  }
  for (const o of extraction.observations) {
    const claim = classifyEpistemicClaim(o.raw_fragment || o.description);
    if (claim === "caregiver_interpretation" || looksLikeRecipientSelfReportUncertain(o.raw_fragment || o.description)) {
      interpretations.push({
        text: o.description,
        reason:
          claim === "caregiver_interpretation"
            ? "caregiver_interpretation"
            : "recipient_self_report_uncertain",
      });
      const beforeBut = (o.raw_fragment || o.description).split(/\bbut\b/i)[0]?.trim();
      if (beforeBut && beforeBut.length >= 12 && beforeBut !== o.description) {
        facts.push({
          kind: "observation",
          text: beforeBut.slice(0, 240),
          source_fragment: o.raw_fragment,
        });
      } else if (!/\bsays?\b/i.test(o.description)) {
        facts.push({ kind: "observation", text: o.description, source_fragment: o.raw_fragment });
      }
      continue;
    }
    if (looksLikeFragmentationOrAdmin(o.description)) {
      context_only.push(o.description);
      continue;
    }
    facts.push({ kind: "observation", text: o.description, source_fragment: o.raw_fragment });
    if (/\b(?:worse|more|less|getting|been)\b/i.test(o.description)) {
      changes_from_baseline.push(o.description);
    }
  }
  for (const d of extraction.decisions) {
    facts.push({ kind: "decision", text: d.description, source_fragment: d.raw_fragment });
    if (looksLikePossibleTimingLink(d.raw_fragment || d.description)) {
      possible_links.push({
        text: "A recent care change may be relevant to later changes — timing is unclear, not a proven cause.",
        causation_claimed: false,
      });
    }
  }
  for (const out of extraction.outcomes) {
    facts.push({ kind: "outcome", text: out.description, source_fragment: out.raw_fragment });
  }
  for (const u of extraction.unknowns) {
    if (u.status === "open") unknowns.push(u.question);
  }
  for (const ncf of extraction.non_care_facts) {
    context_only.push(ncf.text);
  }

  if (looksLikeContributorLoadFragment(raw) && context_only.length === 0) {
    context_only.push("Caregiver is carrying fragmented pieces alone.");
  }
  if (looksLikeDisagreementPerspectiveFragment(raw)) {
    context_only.push("Family perspectives differ — held as context.");
  }

  const person =
    params.personDisplayName?.trim() ||
    anchor.care_recipient ||
    situation.subject_label ||
    null;

  // Use impact-driven prioritization from the understanding object
  // Pass prior continuity hooks and unknowns for second-turn reconnection
  const prioritized = prioritizeFromUnderstanding({
    care_recipient: person,
    facts,
    interpretations,
    unknowns: [...new Set(unknowns)],
    possible_links,
    changes_from_baseline: [...new Set(changes_from_baseline)],
    matters_now: [],
    can_wait: [],
    follow_up_questions: [],
    context_only: [...new Set(context_only)],
    continuity_hooks: [],
    can_orient: false,
    instant_path: true,
    confidence: "low",
  }, params.priorContinuityHooks, params.priorUnknowns);

  const evidenceCount = facts.length + prioritized.follow_up_questions.length;
  const confidence: CareSituationUnderstanding["confidence"] =
    evidenceCount >= 4 ? "high" : evidenceCount >= 2 ? "medium" : "low";

  const can_orient =
    prioritized.matters_now.length > 0 ||
    facts.length > 0 ||
    (context_only.length > 0 && raw.length < 200);

  return {
    care_recipient: person,
    facts,
    interpretations,
    unknowns: [...new Set(unknowns)].slice(0, 6),
    possible_links,
    changes_from_baseline: [...new Set(changes_from_baseline)].slice(0, 4),
    matters_now: prioritized.matters_now,
    can_wait: prioritized.can_wait,
    follow_up_questions: prioritized.follow_up_questions,
    context_only: [...new Set(context_only)].slice(0, 4),
    continuity_hooks: prioritized.continuity_hooks,
    can_orient,
    instant_path: true,
    confidence,
  };
}

/**
 * Obtain the best available extraction — LLM structured understanding first,
 * falling back to deterministic/regex extraction when LLM is unavailable, fails,
 * or returns invalid output.
 */
async function getBestExtraction(params: {
  rawText: string;
  contributorId: string;
  signal?: AbortSignal;
}): Promise<import("../care-reality-extraction").CareRealityExtractionResult> {
  try {
    return await llmStructuredUnderstanding({
      rawText: params.rawText,
      contributorId: params.contributorId,
      signal: params.signal,
    });
  } catch {
    return extractCareRealityFromText({
      rawText: params.rawText,
      source: params.contributorId,
    });
  }
}

/**
 * Build structured understanding for one capture (async — uses LLM when available).
 * Falls back to deterministic/regex extraction when LLM fails.
 * For synchronous usage (composer), use buildCareSituationUnderstandingFromExtraction.
 */
export async function buildCareSituationUnderstanding(params: {
  rawText: string;
  contributorId?: string;
  careKey?: string;
  personDisplayName?: string | null;
  situation?: ActiveCareSituation | null;
  priorContinuityHooks?: string[];
  priorUnknowns?: string[];
  signal?: AbortSignal;
}): Promise<CareSituationUnderstanding> {
  const raw = (params.rawText ?? "").trim();
  const careKey =
    params.careKey ?? params.contributorId ?? params.situation?.care_recipient_id ?? "care";

  const situation = params.situation ?? emptySituationStub(careKey);
  const anchor = buildCareRecipientAnchor({
    situation,
    latestRawText: raw,
    careKey,
  });

  // Try LLM extraction first; fallback to deterministic/regex on failure
  const extraction = anchor.extraction ?? (await getBestExtraction({
    rawText: raw,
    contributorId: params.contributorId ?? careKey,
    signal: params.signal,
  }));

  const facts: CareSituationFact[] = [];
  const interpretations: CareSituationInterpretation[] = [];
  const unknowns: string[] = [];
  const possible_links: CareSituationPossibleLink[] = [];
  const context_only: string[] = [];
  const changes_from_baseline: string[] = [];

  for (const e of extraction.events) {
    facts.push({ kind: "event", text: e.description, source_fragment: e.raw_fragment });
  }
  for (const o of extraction.observations) {
    const claim = classifyEpistemicClaim(o.raw_fragment || o.description);
    if (claim === "caregiver_interpretation" || looksLikeRecipientSelfReportUncertain(o.raw_fragment || o.description)) {
      interpretations.push({
        text: o.description,
        reason:
          claim === "caregiver_interpretation"
            ? "caregiver_interpretation"
            : "recipient_self_report_uncertain",
      });
      const beforeBut = (o.raw_fragment || o.description).split(/\bbut\b/i)[0]?.trim();
      if (beforeBut && beforeBut.length >= 12 && beforeBut !== o.description) {
        facts.push({
          kind: "observation",
          text: beforeBut.slice(0, 240),
          source_fragment: o.raw_fragment,
        });
      } else if (!/\bsays?\b/i.test(o.description)) {
        facts.push({ kind: "observation", text: o.description, source_fragment: o.raw_fragment });
      }
      continue;
    }
    if (looksLikeFragmentationOrAdmin(o.description)) {
      context_only.push(o.description);
      continue;
    }
    facts.push({ kind: "observation", text: o.description, source_fragment: o.raw_fragment });
    if (/\b(?:worse|more|less|getting|been)\b/i.test(o.description)) {
      changes_from_baseline.push(o.description);
    }
  }
  for (const d of extraction.decisions) {
    facts.push({ kind: "decision", text: d.description, source_fragment: d.raw_fragment });
    if (looksLikePossibleTimingLink(d.raw_fragment || d.description)) {
      possible_links.push({
        text: "A recent care change may be relevant to later changes — timing is unclear, not a proven cause.",
        causation_claimed: false,
      });
    }
  }
  for (const out of extraction.outcomes) {
    facts.push({ kind: "outcome", text: out.description, source_fragment: out.raw_fragment });
  }
  for (const u of extraction.unknowns) {
    if (u.status === "open") unknowns.push(u.question);
  }
  for (const ncf of extraction.non_care_facts) {
    context_only.push(ncf.text);
  }

  if (looksLikeContributorLoadFragment(raw) && context_only.length === 0) {
    context_only.push("Caregiver is carrying fragmented pieces alone.");
  }
  if (looksLikeDisagreementPerspectiveFragment(raw)) {
    context_only.push("Family perspectives differ — held as context.");
  }

  const person =
    params.personDisplayName?.trim() ||
    anchor.care_recipient ||
    situation.subject_label ||
    null;

  // Use impact-driven prioritization from the understanding object
  const understandingDraft: CareSituationUnderstanding = {
    care_recipient: person,
    facts,
    interpretations,
    unknowns: [...new Set(unknowns)],
    possible_links,
    changes_from_baseline: [...new Set(changes_from_baseline)],
    matters_now: [],
    can_wait: [],
    follow_up_questions: [],
    context_only: [...new Set(context_only)],
    continuity_hooks: [],
    can_orient: false,
    instant_path: true,
    confidence: "low",
  };

  const prioritized = prioritizeFromUnderstanding(understandingDraft, params.priorContinuityHooks, params.priorUnknowns);

  const evidenceCount = facts.length + prioritized.follow_up_questions.length;
  const confidence: CareSituationUnderstanding["confidence"] =
    evidenceCount >= 4 ? "high" : evidenceCount >= 2 ? "medium" : "low";

  const can_orient =
    prioritized.matters_now.length > 0 ||
    facts.length > 0 ||
    (context_only.length > 0 && raw.length < 200);

  return {
    ...understandingDraft,
    unknowns: understandingDraft.unknowns.slice(0, 6),
    changes_from_baseline: understandingDraft.changes_from_baseline.slice(0, 4),
    context_only: understandingDraft.context_only.slice(0, 4),
    matters_now: prioritized.matters_now,
    can_wait: prioritized.can_wait,
    follow_up_questions: prioritized.follow_up_questions,
    continuity_hooks: prioritized.continuity_hooks,
    can_orient,
    confidence,
  };
}
