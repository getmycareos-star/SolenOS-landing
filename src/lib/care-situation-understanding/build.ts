/**
 * Build Care Situation Understanding from messy caregiver input.
 * Sync / instant-value path — no LLM wait.
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
import type {
  CareSituationFact,
  CareSituationInterpretation,
  CareSituationPossibleLink,
  CareSituationUnderstanding,
} from "./types";

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
 * Build structured understanding for one capture.
 * Works for text and document OCR text alike — origin does not branch reasoning.
 */
export function buildCareSituationUnderstanding(params: {
  rawText: string;
  contributorId?: string;
  careKey?: string;
  personDisplayName?: string | null;
  situation?: ActiveCareSituation | null;
  priorHeld?: string[];
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

  const extraction =
    anchor.extraction ??
    extractCareRealityFromText({
      rawText: raw,
      contributorId: params.contributorId ?? careKey,
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
      // Keep the observable portion when fragment mixes event + interpretation
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

  // Scan raw for load / disagreement if extraction missed
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

  const prioritized = prioritizeCareSituation({
    facts,
    unknowns,
    context_only,
    possible_links,
    changes_from_baseline,
  });

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
