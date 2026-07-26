/**
 * Project CareSituationUnderstanding → Response Contract (ResponseIntelligenceOutput).
 *
 * This is the single authoritative projection layer.
 * The composer must use this as the PRIMARY source for Response Contract fields,
 * not keyword-ladder clarity pillars or raw caregiver text.
 *
 * Flow:
 *   CareSituationUnderstanding
 *     → deterministic prioritization (prioritizeFromUnderstanding)
 *     → ResponseIntelligenceOutput (Response Contract fields)
 *
 * Rules:
 * - Response is projected from structured understanding, not rewritten from input
 * - Emotional load stays contextual (context_only), never primary situation
 * - Internal engine concepts never exposed (enums, confidence %, "detected", "extracted")
 * - Clinical reality and care context always take precedence over emotional language
 * - Never summarize, paraphrase, concatenate input clauses, or mirror caregiver wording
 */

import type { CareSituationUnderstanding } from "../care-situation-understanding/types";
import { prioritizeFromUnderstanding } from "../care-situation-understanding/prioritize-from-understanding";
import type { ResponseIntelligenceOutput, ResponseRiskLevel } from "../response-intelligence/types";

/**
 * Person phrase — uses the held recipient name; never guesses.
 */
function personPhrase(person: string | null): string {
  if (!person) return "the person you care for";
  return person;
}

/**
 * Project CareSituationUnderstanding into Response Contract output.
 *
 * Every field is derived from the understanding model, not from raw caregiver text.
 * Emotional/load content lives only in context — never as primary situation or priority.
 */
export function projectCareSituationToResponseContract(
  understanding: CareSituationUnderstanding,
): ResponseIntelligenceOutput {
  const who = personPhrase(understanding.care_recipient);

  // 1. Deterministic prioritization from understanding (impact, not word count)
  const prioritized = prioritizeFromUnderstanding(understanding);

  // 2. What is happening — grounded in structured facts, not caregiver wording
  const careFacts = understanding.facts
    .filter((f) => f.kind === "event" || f.kind === "observation" || f.kind === "decision")
    .map((f) => f.text);

  let what_is_happening: string;
  if (careFacts.length >= 2) {
    what_is_happening = `${who}: ${careFacts.slice(0, 3).join(" · ")}`;
  } else if (careFacts.length === 1) {
    what_is_happening = `${who}: ${careFacts[0]}`;
  } else if (understanding.changes_from_baseline.length > 0) {
    what_is_happening = `${who}: ${understanding.changes_from_baseline[0]}`;
  } else if (understanding.context_only.length > 0) {
    what_is_happening = `The weight of the situation is noted for ${who} — care details are being held as they come in.`;
  } else {
    what_is_happening = `A care situation is being held for ${who}.`;
  }

  // 3. What matters now — from impact-driven prioritization only
  const mattersNowFacts = understanding.facts.filter(
    (f) => prioritized.matters_now.includes(f.text),
  );
  const what_matters_now =
    mattersNowFacts.length > 0
      ? mattersNowFacts.slice(0, 2).map((f) => f.text).join(" · ")
      : prioritized.matters_now.length > 0
        ? prioritized.matters_now.slice(0, 2).join(" · ")
        : understanding.changes_from_baseline.length > 0
          ? `Tracking recent changes in ${who}'s situation.`
          : "";

  // 4. What to ask next — from unknowns and follow-up questions
  const what_to_ask_next = understanding.follow_up_questions.length > 0
    ? understanding.follow_up_questions
    : understanding.unknowns.length > 0
      ? understanding.unknowns.slice(0, 3)
      : [];

  // 5. What can wait — from can_wait priorities and context_only (admin/load)
  const waitItems = prioritized.can_wait.filter(
    (w) => !what_matters_now.toLowerCase().includes(w.toLowerCase().slice(0, 40)),
  );
  const what_can_wait =
    waitItems.length > 0
      ? waitItems.slice(0, 2).join(" · ")
      : understanding.context_only.length > 0
        ? "Everything else can wait — the care situation comes first."
        : "";

  // 6. Risk level — from held evidence, not event kind or keyword counting
  const risk_level = inferRiskFromUnderstanding(understanding);

  // 7. Follow-up items — from continuity hooks, never task-checklist
  const follow_up_items = [
    ...(understanding.continuity_hooks.length > 0
      ? [`Keep tracking whether ${understanding.continuity_hooks[0].toLowerCase().slice(0, 120)}`]
      : []),
    ...(understanding.possible_links.length > 0
      ? ["Notice whether changes and recent decisions continue to move together."]
      : []),
    ...(understanding.unknowns.length > 0 && understanding.follow_up_questions.length === 0
      ? ["Add what you learn about the open questions when you can."]
      : []),
  ].slice(0, 3);

  return {
    what_is_happening,
    what_matters_now,
    what_to_ask_next,
    risk_level,
    what_can_wait,
    follow_up_items,
  };
}

/**
 * Infer risk from structured understanding — never from event kind, keyword frequency,
 * or caregiver emotional language.
 */
function inferRiskFromUnderstanding(
  understanding: CareSituationUnderstanding,
): ResponseRiskLevel {
  const hasSafetyFact = understanding.facts.some((f) =>
    /\b(?:fell|fall|fallen|collapse|fainted|unconscious|seizure|overdose|injury|broken|fracture|bleed|head injur)\b/i.test(f.text),
  );
  if (hasSafetyFact) return "high";

  const hasMedicalUrgency = understanding.facts.some((f) =>
    /\b(?:hospital|emergency|admitted|surgery|urgent care|discharge|medication chang|dosage chang)\b/i.test(f.text),
  );
  if (hasMedicalUrgency) return "high";

  if (
    understanding.changes_from_baseline.length >= 2 &&
    understanding.unknowns.some((u) => /\b(?:timing|when|started|began|medication|dose)\b/i.test(u))
  ) {
    return "medium";
  }

  if (
    understanding.changes_from_baseline.length >= 1 &&
    understanding.unknowns.length >= 2
  ) {
    return "medium";
  }

  if (understanding.interpretations.length >= 3 && understanding.facts.length < 2) {
    return "medium";
  }

  return "low";
}

/**
 * Structural validation: confirm that the projected response is grounded in
 * understanding model priorities, not assembled from raw input fragments.
 *
 * Rejects responses that:
 * - Reference engine enums or implementation labels
 * - Read like a paraphrase of the caregiver's message
 * - Use "detected", "extracted", confidence scores, or internal concepts
 * - Center emotional/load content as the primary situation
 * - Lack any reference to model-derived care facts
 */
export function assertProjectionGrounded(params: {
  projection: ResponseIntelligenceOutput;
  understanding: CareSituationUnderstanding;
  rawText: string;
}): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  const blob = [
    params.projection.what_is_happening,
    params.projection.what_matters_now,
    typeof params.projection.what_to_ask_next === "string"
      ? params.projection.what_to_ask_next
      : params.projection.what_to_ask_next.join(" "),
    params.projection.what_can_wait,
    ...params.projection.follow_up_items,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Rule 1: No engine enums or implementation labels
  const engineLeakage = [
    /\bobservation\b.{0,30}\bextracted\b/i,
    /\bextracted\b.{0,30}\bobservation\b/i,
    /\bconfidence.{0,10}score\b/i,
    /\bconfidence.{0,10}%\b/i,
    /\bdetected\b/i,
    /\bextracted\b.{0,40}\bfrom\b.{0,40}\binput\b/i,
    /\bu?i?d\b.{0,10}\:[a-z0-9_]{8,}/i,
    /\blayer\s*:\s*(?:observation|event|decision|outcome|unknown)\b/i,
    /\bstatus\s*:\s*(?:open|active|completed)\b/i,
    /\bepistemic\b/i,
    /\bcare.?signal\b/i,
    /\bsituation.?model\b/i,
    /\bevidence.?maturity\b/i,
    /\bunderstanding.?layer\b/i,
    /\battention.?rank\b/i,
    /\bextraction.?category\b/i,
    /\bclassification\s*(?:complete|result)\b/i,
    /\b(?:n_|count|score)\s*\d+\b/i,
  ];

  for (const pattern of engineLeakage) {
    if (pattern.test(blob)) {
      failures.push(`Response contains engine implementation language: ${pattern}`);
    }
  }

  // Rule 2: Response must contain at least one reference to model-derived care facts
  if (params.understanding.facts.length > 0) {
    const hasFactReference = params.understanding.facts.some((f) => {
      const tokens = f.text
        .toLowerCase()
        .split(/[^a-z0-9']+/)
        .filter((t) => t.length > 3);
      return tokens.some((t) => blob.includes(t));
    });
    if (!hasFactReference) {
      failures.push("Response does not reference any model-derived care fact");
    }
  }

  // Rule 3: Emotional/load context must not be the primary situation
  if (params.understanding.facts.length > 0 && params.understanding.context_only.length > 0) {
    const primarySituation = params.projection.what_is_happening.toLowerCase();
    const hasCareFactInSituation = params.understanding.facts.some((f) => {
      const tokens = f.text
        .toLowerCase()
        .split(/[^a-z0-9']+/)
        .filter((t) => t.length > 3);
      return tokens.some((t) => primarySituation.includes(t));
    });
    if (!hasCareFactInSituation) {
      const loadOnly =
        /\b(?:weight|burden|overwhelm|exhaust|load|fragmented|retell)\b/i.test(primarySituation) &&
        !params.understanding.facts.some((f) =>
          primarySituation.includes(f.text.toLowerCase().slice(0, 30)),
        );
      if (loadOnly) {
        failures.push("Emotional/load context is the primary situation instead of care reality");
      }
    }
  }

  // Rule 4: Response must not be a direct paraphrase of raw caregiver text
  if (params.rawText.trim().length >= 40) {
    const rawSentences = params.rawText
      .toLowerCase()
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 15);

    for (const sentence of rawSentences) {
      const words = sentence.split(/[^a-z0-9']+/).filter((w) => w.length > 2);
      if (words.length < 4) continue;
      const matchCount = words.filter((w) => blob.includes(w)).length;
      const ratio = matchCount / words.length;
      if (ratio > 0.7) {
        failures.push(
          `Response echoes raw caregiver text (${(ratio * 100).toFixed(0)}% word overlap): "${sentence.slice(0, 60)}..."`,
        );
        break;
      }
    }
  }

  // Rule 5: what_matters_now must not be empty when there are care facts
  if (params.understanding.facts.length > 0 && !params.projection.what_matters_now?.trim()) {
    failures.push("what_matters_now is empty despite having care facts");
  }

  return { ok: failures.length === 0, failures };
}
