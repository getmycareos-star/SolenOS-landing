import {
  dedupeCaregiverFacingLines,
  isCaregiverSafeDisplayText,
  resolveCaregiverWords,
  sanitizeCaregiverDisplayText,
} from "../mvp-input-architecture";
import type { ActiveSituationTurn } from "../active-care-situation/types";
import {
  buildDisclosurePlan,
  disclosureStageFor,
  primaryScreenQuestionFor,
} from "../care-reality-state/disclosure";
import type { ResponseEvolutionEvaluation } from "../care-reality-state/types";
import {
  assertComposedResponseProfessional,
  composeCaregiverResponse,
} from "../caregiver-response-composer";
import { mergeReliefIntoDisclosurePlan } from "../response-contract/disclosure-merge";
import {
  classifyCaregiverTurn,
  resolveReliefDecisionForTurn,
} from "../response-behavior";
import { isCaregiverGuidanceDemand } from "../progressive-understanding/clarity-pillars";
import { careRealityObservations } from "../progressive-understanding/questions";
import { observationCareFact } from "../care-epistemics";
import { isNearRawCaregiverFacet } from "../output-quality";
import { recordRetentionResearchEvent } from "../mvp-research-validation";
import { formatBaselineChangeNote } from "../care-reality-output";
import {
  humanAttentionLabelFor,
  shouldDiscloseAttentionLevel,
  containsAttentionScoreTheater,
} from "../response-intelligence";
import {
  LIVING_CARE_RECORD_UX_IDENTITY,
} from "./contract-constants";
import {
  classifyCareEventKind,
  eventTypeLabel,
  rememberedThemesForKind,
  type CareEventKind,
} from "./event-clarifiers";
import type { HumanConfidenceLabel, LivingCareRecordResponseView } from "./types";
import type { SituationResponse } from "../situation-entry/types";
import {
  caregiverFacingFragmentText,
  looksLikeCareThread,
} from "../thread-ingestion/detect";

export { isCaregiverSafeDisplayText } from "../mvp-input-architecture";

/**
 * Prefer engine baseline→change notes for orientation — never invent from scenario nouns.
 */
function resolveBaselineChangeNote(response: SituationResponse): string | null {
  const creChange = response.care_reality_engine_layer?.changes?.changes?.find(
    (c) => !c.is_conflict && (c.prior || c.current || c.summary),
  );
  if (creChange) {
    const fromCre = formatBaselineChangeNote({
      changeSummary: creChange.summary,
      prior: creChange.prior,
      current: creChange.current,
    });
    if (fromCre) return fromCre;
  }

  const deviation = response.baseline_intelligence_layer?.deviations?.[0];
  if (deviation) {
    return formatBaselineChangeNote({
      observation: deviation.observation,
      comparedToBaseline: deviation.compared_to_baseline,
    });
  }
  return null;
}

const EMPTY_RESPONSE_EVOLUTION: ResponseEvolutionEvaluation = {
  updates_active_situation: false,
  answers_previous_uncertainty: false,
  strengthens_existing_hypothesis: false,
  introduces_new_pattern: false,
  changes_what_matters_now: false,
  invalidates_previous_understanding: false,
};

function extractDateHint(text: string): string | null {
  if (/\byesterday\b/i.test(text)) return "Yesterday";
  if (/\btoday\b/i.test(text)) return "Today";
  if (/\blast night\b/i.test(text)) return "Last night";
  if (/\bthis morning\b/i.test(text)) return "This morning";
  if (/\blast week\b/i.test(text)) return "Last week";
  const m = text.match(
    /\b((january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s*\d{4})?|\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)\b/i,
  );
  return m ? m[0] : null;
}

function relatedCareFromText(text: string): string[] {
  const related: string[] = [];
  if (/\burgent care\b/i.test(text)) related.push("Visited urgent care");
  if (/\b(er|emergency room)\b/i.test(text)) related.push("Emergency / ER visit");
  if (/\bhospital\b/i.test(text)) related.push("Hospital-related care");
  if (/\bclinic\b/i.test(text)) related.push("Clinic visit");
  if (/\bdoctor\b/i.test(text)) related.push("Doctor involved");
  return related;
}

function isGreetingNoiseFact(line: string): boolean {
  const t = line.trim().toLowerCase().replace(/\.+$/, "");
  if (!t) return true;
  if (/^(hi|hello|hey)(,|\s|$)/i.test(t) && t.split(/\s+/).length <= 4) return true;
  if (/^(i'?m|im)\s+\w+$/i.test(t)) return true;
  if (/^(hi|hello|hey)[,.]?\s*(i'?m|im)\s+\w+$/i.test(t)) return true;
  return false;
}

/** Short care-fact cleanup — greeting/typo noise out (any topic). */
function cleanCareFactDisplay(line: string): string {
  return line
    .replace(/^(your\s+)?(dad|mom|loved one):\s*/i, "")
    .replace(/^(hi|hello|hey)[,.]?\s*/i, "")
    .replace(/\bi'?m\s+\w+[,.]?\s*/gi, "")
    .replace(/\.{2,}/g, " ")
    .replace(/\bherefusedto\b/gi, "refused to")
    .replace(/\s+/g, " ")
    .trim();
}

function humanFactsFromEvents(
  response: SituationResponse,
  kind: CareEventKind,
  sourceText: string,
): string[] {
  const facts: string[] = [];
  const cleaned = sanitizeCaregiverDisplayText(sourceText);
  void kind;

  // Prefer understood fragments / caregiver words — never kind-template facts
  // (fall → “had a fall”, appetite → “eating concern”, etc.).
  for (const item of response.what_i_understood ?? []) {
    const colon = item.label.indexOf(": ");
    const clause =
      colon > 0
        ? sanitizeCaregiverDisplayText(item.label.slice(colon + 2))
        : sanitizeCaregiverDisplayText(item.label);
    const normalized = cleanCareFactDisplay(clause);
    if (
      normalized &&
      !isGreetingNoiseFact(normalized) &&
      isCaregiverSafeDisplayText(normalized) &&
      normalized.length > 8
    ) {
      facts.push(normalized.endsWith(".") ? normalized : `${normalized}.`);
    }
  }

  if (facts.length === 0 && cleaned) {
    if (isCaregiverGuidanceDemand(cleaned)) return [];
    const normalized = cleanCareFactDisplay(cleaned);
    const clauses = normalized
      .split(/[.!?]+/)
      .map((c) => c.trim())
      .filter((c) => c.length >= 8 && !isGreetingNoiseFact(c) && !isCaregiverGuidanceDemand(c))
      .sort((a, b) => b.length - a.length);
    const first = clauses[0];
    if (first) {
      facts.push(first.endsWith(".") ? first : `${first}.`);
    }
  }

  return dedupeCaregiverFacingLines(facts, 4);
}

function confidenceLabelFor(response: SituationResponse): HumanConfidenceLabel {
  // Evidence Visibility: never “confidence %” or score theater — maturity language only.
  if (response.crisis_mode_interaction_layer?.crisis_mode) {
    return "Needs confirmation";
  }
  const missing =
    (response.what_needs_clarification?.length ?? 0) +
    (response.what_is_uncertain?.length ?? 0);
  if ((response.events_created?.length ?? 0) === 0) return "Limited information available";
  if (missing >= 4) return "Limited information available";
  if (missing >= 1) return "Needs confirmation";
  return "Limited information available";
}

/**
 * Client-safe projection — never imports ACS durable / node:fs.
 * Prefer server turn from processSituationInput / POST /api/situation.
 */
function resolveActiveSituationTurn(params: {
  response: SituationResponse;
  sourceText: string;
}): ActiveSituationTurn {
  const { response, sourceText } = params;
  if (response.active_care_situation_turn) {
    return response.active_care_situation_turn;
  }

  const situation = response.active_care_situation;
  if (situation) {
    // Prefer server turn. Client rebuild is last-resort and must not invent continuity.
    const observationCount = situation.observations.length;
    const disclosure_stage = disclosureStageFor(
      situation.understanding_stage,
      observationCount,
      situation.pattern_label ?? null,
      {
        theme: situation.theme,
        relation: "opens_new",
        resolvedUncertaintyCount: 0,
      },
    );
    const disclosure_plan = buildDisclosurePlan(disclosure_stage);
    return {
      relation: "opens_new" as const,
      situation,
      confirmation_title: "Held in the Living Care Record",
      confirmation_body: "This is preserved in the Living Care Record.",
      understanding_heading: "What is understood about this situation",
      understanding_stage: situation.understanding_stage,
      current_understanding: situation.observations
        .map((o) => o.human_fact)
        .slice(-2)
        .reverse(),
      insufficiency_note: null,
      connection_note: null,
      what_needs_context: [],
      what_will_be_remembered: ["Care timeline continuity"],
      what_seems_happening: situation.synthesis,
      what_matters_now: situation.what_matters_now,
      what_can_wait: "Explaining every detail tonight.",
      what_may_become_serious: null,
      show_attention_sections: false,
      what_changed_in_understanding: null,
      understanding_effect: "opens_situation",
      resolved_uncertainties: [],
      pattern_label: situation.pattern_label ?? null,
      care_reality_state_id: null,
      crs_observation_count: situation.observations.length,
      crs_revision: Math.max(1, situation.observations.length),
      disclosure_stage,
      disclosure_plan,
      response_evolution: EMPTY_RESPONSE_EVOLUTION,
      primary_screen_question: primaryScreenQuestionFor(disclosure_stage),
    };
  }

  // Degraded display when pipeline omitted ACS (should be rare) — held shell only.
  const disclosure_stage = "early" as const;
  const disclosure_plan = buildDisclosurePlan(disclosure_stage);
  const fact = sanitizeCaregiverDisplayText(sourceText).slice(0, 200);
  return {
    relation: "opens_new",
    situation: {
      id: "acs_degraded",
      caregiver_id: response.context?.caregiver_id ?? response.care_key ?? "unknown_care_key",
      opened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      root_event_id: response.events_created[0]?.id ?? null,
      subject_label: "they",
      theme: "mixed",
      observations: [],
      open_questions: [],
      asked_questions: [],
      understanding_stage: "gathering",
      connection_note: null,
      synthesis: null,
      what_matters_now: null,
    },
    confirmation_title: "Held in the Living Care Record",
    confirmation_body: "This is preserved in the Living Care Record.",
    understanding_heading: "What is understood about this situation",
    understanding_stage: "gathering",
    current_understanding: fact ? [fact.endsWith(".") ? fact : `${fact}.`] : [],
    insufficiency_note: null,
    connection_note: null,
    what_needs_context: [],
    what_will_be_remembered: ["Care timeline continuity"],
    what_seems_happening: null,
    what_matters_now: null,
    what_can_wait: "Explaining every detail or answering questions you do not know yet.",
    what_may_become_serious: null,
    show_attention_sections: false,
    what_changed_in_understanding: null,
    understanding_effect: "opens_situation",
    resolved_uncertainties: [],
    pattern_label: null,
    care_reality_state_id: null,
    crs_observation_count: 0,
    crs_revision: 1,
    disclosure_stage,
    disclosure_plan,
    response_evolution: EMPTY_RESPONSE_EVOLUTION,
    primary_screen_question: primaryScreenQuestionFor(disclosure_stage),
  };
}

/**
 * Caregiver-facing Living Care Record turn.
 * Projects from the situation pipeline turn (Care Reality State) — client-safe, no node:fs.
 */
export function buildLivingCareRecordResponse(params: {
  response: SituationResponse;
  rawInput: string;
  entryIntent?: "initial" | "update";
}): LivingCareRecordResponseView {
  const { response, rawInput } = params;
  const hasDocuments = (response.document_events_count ?? 0) > 0 || rawInput.includes("[Document:");
  const turn = resolveActiveSituationTurn({
    response,
    sourceText: sanitizeCaregiverDisplayText(rawInput),
  });

  // G6 — when ACS grew from a thread split, compose against the latest fragment
  // (not the entire paste), so orientation matches what was just linked.
  const obs = turn.situation.observations;
  const lastObs = obs.length > 0 ? obs[obs.length - 1] : null;
  const threadLatest =
    lastObs &&
    obs.length > 1 &&
    looksLikeCareThread(rawInput)
      ? caregiverFacingFragmentText(lastObs.raw_text)
      : null;

  const sourceText =
    threadLatest ||
    resolveCaregiverWords(response.events_created, rawInput) ||
    sanitizeCaregiverDisplayText(rawInput);
  const primaryType = response.events_created[0]?.extracted_type;
  const kind = classifyCareEventKind(sourceText, primaryType, hasDocuments && !rawInput.trim());

  // Hard events (fall, discharge, …) keep structured meta; soft situations stay narrative.
  const softSituation = turn.situation.theme === "emotional_behavior";
  const related = relatedCareFromText(sourceText);
  const date = extractDateHint(sourceText) ?? (softSituation ? "Today" : null);

  // Sole caregiver-facing authority — engines propose; composer speaks.
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: sourceText,
    kind,
    hasDocuments,
    baselineChangeNote: resolveBaselineChangeNote(response),
  });
  assertComposedResponseProfessional(composed);

  const turnClass = classifyCaregiverTurn({
    latestRawText: sourceText,
    kind,
    turn,
    hasDocuments,
  });

  // Slice 5.6 — ops research proxies only; never caregiver survey / scores.
  try {
    const careKey =
      turn.situation.care_recipient_id ??
      turn.situation.caregiver_id ??
      response.care_key ??
      "unknown";
    recordRetentionResearchEvent({
      careKey,
      composed,
      careWorthyCount: careRealityObservations(turn.situation).length,
      isReturn: turn.situation.observations.length > 1,
      relation: turn.relation,
      turnClass,
      hasDecisionWhy: Boolean(composed.why_asking?.trim()),
    });
  } catch {
    // Non-fatal — research instrumentation must never block care capture.
  }

  const relief = resolveReliefDecisionForTurn({
    turn,
    turnClass,
    latestRawText: sourceText,
  });

  const risk_level = composed.contract_output.risk_level;
  const attention_label = humanAttentionLabelFor(risk_level);
  if (containsAttentionScoreTheater(attention_label)) {
    throw new Error("Living Care Record: attention label must not include score theater");
  }

  const showAttention = shouldDiscloseAttentionLevel({
    risk: risk_level,
    disclosureStage: turn.disclosure_stage,
  });
  const crsPlan = turn.disclosure_plan;
  const mergedPlan = mergeReliefIntoDisclosurePlan({
    crsPlan,
    relief,
    composed: {
      show_clarity: composed.show_clarity,
      show_questions: composed.show_questions,
      still_unclear_count: composed.still_unclear.length,
      what_we_know_count: composed.what_we_know.length,
      has_situation_summary: Boolean(composed.situation_summary),
      has_what_changed: Boolean(
        composed.what_changed ||
          (turn.what_changed_in_understanding &&
            !/related note|today'?s notes|held with today'?s notes/i.test(
              turn.what_changed_in_understanding,
            )),
      ),
      observation_count: careRealityObservations(turn.situation).length,
      show_connection: composed.show_connection,
    },
    showAttentionLevel: showAttention,
  });
  const plan = mergedPlan;
  const stage = turn.understanding_stage ?? turn.situation.understanding_stage;

  // Hard events need a concrete fact line (fall / discharge) even when ACS facts are soft-phrased.
  // Never merge guidance-question echoes or restate what they just said while gathering.
  let what_understood = composed.what_we_know;
  if (
    !softSituation &&
    !isCaregiverGuidanceDemand(sourceText) &&
    composed.what_we_know.length > 0
  ) {
    const hardFacts = humanFactsFromEvents(response, kind, sourceText).filter(
      (line) =>
        !isCaregiverGuidanceDemand(line) &&
        !isGreetingNoiseFact(line) &&
        !isNearRawCaregiverFacet(line, sourceText),
    );
    // Prefer composer-cleaned facts first — extraction fragments are secondary
    what_understood = dedupeCaregiverFacingLines(
      [...composed.what_we_know, ...hardFacts],
      3,
    );
  }
  what_understood = what_understood
    .map((line) => {
      const cleaned = cleanCareFactDisplay(line);
      if (!cleaned || isGreetingNoiseFact(cleaned)) return "";
      return cleaned.endsWith(".") ? cleaned : `${cleaned}.`;
    })
    .filter(Boolean);
  what_understood = dedupeCaregiverFacingLines(
    what_understood.filter(
      (line) =>
        !isCaregiverGuidanceDemand(line) &&
        !isNearRawCaregiverFacet(line, sourceText),
    ),
    2,
  );
  // Understanding-first: if composer withheld facts (gather mode), do not re-inject echoes.
  if (composed.what_we_know.length === 0 && composed.show_questions) {
    what_understood = [];
  }

  return {
    identity_line: LIVING_CARE_RECORD_UX_IDENTITY,
    recognition_line: composed.recognition_line,
    relation: turn.relation,
    understanding_stage: stage,
    care_event_added: {
      title: turn.confirmation_title,
      confirmation: composed.confirmation,
      date,
      event: softSituation ? "Today's observation" : eventTypeLabel(kind),
      related_care: related,
      status: "Held in the Living Care Record",
      source: hasDocuments ? "document" : "text",
    },
    understanding_heading: "What is understood about this situation",
    what_understood: plan.show_current_understanding ? what_understood : [],
    insufficiency_note: null,
    connection_note: plan.show_connection ? composed.connection_note : null,
    what_needs_context: composed.still_unclear,
    what_will_be_remembered: plan.show_remembered
      ? turn.what_will_be_remembered.length > 0
        ? turn.what_will_be_remembered
        : rememberedThemesForKind(kind)
      : [],
    what_seems_happening: composed.situation_summary,
    what_matters_now: composed.what_matters_now,
    what_can_wait: composed.what_can_wait,
    what_may_become_serious: composed.what_may_become_serious,
    show_attention_sections: plan.show_what_matters_now,
    what_changed_in_understanding: plan.show_what_changed
      ? composed.what_changed ??
        (turn.what_changed_in_understanding &&
        !/related note|today'?s notes|held with today'?s notes/i.test(
          turn.what_changed_in_understanding,
        )
          ? turn.what_changed_in_understanding
          : null)
      : null,
    care_story_update: composed.care_story_update,
    understanding_effect: turn.understanding_effect,
    pattern_label: composed.is_improvement ? null : turn.pattern_label,
    confidence_label: confidenceLabelFor(response),
    risk_level,
    attention_label: showAttention ? attention_label : null,
    event_kind: kind,
    original_input: sanitizeCaregiverDisplayText(rawInput).slice(0, 800),
    has_documents: hasDocuments,
    observation_count: careRealityObservations(turn.situation).length,
    expandable: (() => {
      const maturity = composed.evidence_maturity;
      // Evidence Visibility: reveal by consequence, not data volume.
      const evidenceCap =
        maturity <= 1
          ? 0
          : maturity === 2
            ? 2
            : maturity === 3
              ? 4
              : maturity === 5
                ? 5
                : 8;
      const showExpandableEvidence =
        plan.show_evidence && evidenceCap > 0 && maturity >= 2;
      const evidence = showExpandableEvidence
        ? turn.situation.observations
            .slice()
            .reverse()
            .map((o) => {
              const date = (o.captured_at || "").slice(0, 10);
              const careFact = observationCareFact({
                human_fact: o.human_fact,
                raw_text: o.raw_text,
              });
              if (!careFact) return "";
              const text = caregiverFacingFragmentText(careFact);
              if (!text) return "";
              return date ? `${date}: ${text}` : text;
            })
            .filter(Boolean)
            .slice(0, evidenceCap)
        : [];
      const timeline =
        maturity >= 10
          ? turn.situation.observations
              .slice()
              .map((o) => {
                const date = (o.captured_at || "").slice(0, 10) || "Earlier";
                const careFact = observationCareFact({
                  human_fact: o.human_fact,
                  raw_text: o.raw_text,
                });
                if (!careFact) return "";
                const text = caregiverFacingFragmentText(careFact);
                return text ? `${date} — ${text}` : "";
              })
              .filter(Boolean)
              .slice(-8)
          : [];
      return {
        evidence,
        timeline,
        confidence_detail: [],
      };
    })(),
    disclosure_stage: turn.disclosure_stage,
    disclosure_plan: plan,
    response_evolution: turn.response_evolution,
    primary_screen_question: turn.primary_screen_question,
    care_reality_state_id: turn.care_reality_state_id,
    why_asking: composed.why_asking,
    evidence_line: composed.evidence_line,
    evidence_maturity: composed.evidence_maturity,
    follow_up_items: composed.follow_up_items,
  };
}
