/**
 * Caregiver Response Composer — sole authority for what the caregiver sees.
 *
 * Engines may propose understanding. Only this module may speak.
 * Product SoT: docs/02-product/caregiver-response-contract.md (ADR-022)
 * Inspiration: solenosai.netlify.app — three clarity pillars when warranted; relief, not interview.
 */

import type { ActiveSituationTurn } from "../active-care-situation/types";
import { processCareSignalUnderstanding } from "../care-signal-understanding";
import {
  collectSituationSignals,
  detectObservationSignals,
  isImprovementUpdate,
  latestObservationSignals,
} from "../progressive-understanding/detect-signals";
import {
  buildCareClarityPillars,
  buildGuidanceOrientationPillars,
  isCaregiverFacingFactLine,
  isCaregiverGuidanceDemand,
} from "../progressive-understanding/clarity-pillars";
import {
  isCaregiverFacingAsk,
  nextQuestionsForUnderstanding,
  earlyGatherIncomplete,
  careContextGapsRemain,
  careRealityObservations,
  hasCareEvidenceHeld,
  latestObservationIsCareWorthy,
} from "../progressive-understanding/questions";
import {
  caregiverAsksFromClinicalProfile,
  caregiverMattersHintFromClinicalProfile,
} from "../clinical-profile/caregiver-influence";
import { resolveClinicalProfileFromCareContext } from "../clinical-profile";
import { getOrCreateProfile } from "../cognitive-relief/care-recipient-profile/store";
import { isCaregiverQuestionPushback } from "../progressive-understanding/resolve-uncertainty";
import type { CareEventKind } from "../living-care-record-ux/event-clarifiers";
import {
  classifyCaregiverTurn,
  composeEvidenceLine,
  composeWhyAsking,
  selectResponseFacets,
} from "../response-behavior";
import {
  classifyEpistemicClaim,
  isCareRealityAnchorText,
  isProductSessionMetaText,
  observationCareFact,
} from "../care-epistemics";
import {
  composeCaregiverConnectionFromRelationships,
  composeCaregiverUnknownAsk,
  extractCareRealityFromText,
  classifyExtractionFragment,
  isNonObservationFocusLine,
  caregiverFacingLinesFromExtraction,
  caregiverFacingLinesFromCaptureText,
  type CareRealityExtractionResult,
} from "../care-reality-extraction";
import {
  answerRecordQuestion,
  composeDecisionPreparation,
  listDecisionMemory,
  looksLikeDecisionEvidence,
} from "../decision-memory";
import { composePerspectiveAttribution } from "../perspective-attribution";
import { getCareRealityState } from "../care-reality-state";
import {
  buildCareRealitySituationModel,
  orientationFromSituationModel,
} from "../care-reality-intelligence/situation-model";
import {
  buildCareSituationUnderstandingFromExtraction,
  projectCareSituationOrientation,
} from "../care-situation-understanding";
import {
  projectCareSituationToResponseContract,
  assertProjectionGrounded,
} from "../caregiver-response-composer/project-to-response-contract";
import {
  centersContributorConflictOverRecipient,
} from "../care-reality-intelligence/care-recipient-anchor";
import { attentionRankForExtractionCategory } from "../care-reality-intelligence/no-hardcode-contract";
import { containsHallucinatedChangeLanguage } from "../care-reality-intelligence/initial-care-reality-assessment";
import { containsSituationSummaryTheater } from "../care-reality-intelligence/situation-generator";
import { assertIntelligenceValidation } from "../care-reality-intelligence/intelligence-validation";
import { assertCaregiverUnderstandingTest } from "../care-reality-intelligence/caregiver-understanding-test";
import { assertUncertaintyPreservation } from "../care-reality-intelligence/uncertainty-preservation";
import { assertUnknownPreservation } from "../care-reality-extraction/unknowns";
import {
  crsSupportingFacts,
  resolveCrsComposeContext,
} from "./crs-compose-sot";
import { filterSessionUncertaintyAsks } from "../progressive-understanding/uncertainty-lifecycle";
import { consumeFeedbackContainment, peekFeedbackContainmentAdaptation } from "../telemetry-persistence/feedback-containment";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";
import {
  composeMentalLoadCaptureLines,
  formatCompetingSituationLines,
  prioritizeCompetingAttention,
} from "../mvp-research-validation";
import {
  assertNoAiProductLanguage,
  buildResponseIntelligenceOutput,
  inferRiskFromHeldCareEvidence,
  type ResponseIntelligenceOutput,
} from "../response-intelligence";
import { assertNoResponseContractNeverSay } from "../response-contract";
import { adaptForCaregiverCapacity } from "../care-reality-engine";
import {
  buildSituationUnderstandingSummary,
  containsWeakOrientation,
  preferCareSituationFacts,
  separateEpistemicOutputLayers,
  composeReliefFollowUps,
  looksLikeCaregiverExperienceOnly,
  looksLikeDisagreementPerspectiveLine,
} from "../care-reality-output";
import { heldFocusLines } from "../progressive-understanding/clarity-pillars";
import {
  classifyCareMemoryState,
  composeMemoryAwareSoftSummary,
  composeMemoryAwareWhatChanged,
  composeReturningOrientationLines,
  composeAwaitingCareEvidenceRecognition,
  composeProductMetaTurnRecognition,
  composeIdentityMismatchConfirmation,
  composeIdentityMismatchRecognition,
  containsFakeContinuity,
  resolveCareTurnConfirmation,
} from "../care-memory-maturity";
import { composeIdentityMismatchAsk } from "../situation-relationship-engine";
import {
  buildMattersNowOrientation,
  composeConnectionLine,
  composeRecognitionLine,
  containsInternalLanguage,
containsRawNoteEchoInCopy,
  formatDecisionMemoryForCaregiver,
  isNearRawCaregiverFacet,
  looksLikeCaregiverLoadLanguage,
  scrubInternalLanguage,
  composeCareStoryUpdate,
  INTERNAL_LANGUAGE_BANS,
} from "../output-quality";
import { assertResponseAcceptanceGate } from "../response-acceptance-gate";
import { applyRealCaregiverTestComposeGate } from "../real-caregiver-test";

/** Phrases that must never reach a stressed caregiver. */
export const CAREGIVER_RESPONSE_BANNED_PHRASES = [
  "still with you",
  "i will not ask",
  "looking at what is already held",
  "i'm here for you",
  "i understand how you feel",
  "that sounds difficult",
  "your feelings are valid",
  "here's my understanding",
  "putting this together",
  "i'm hearing that",
  "key takeaways",
  "based on my analysis",
  "according to the uploaded document",
  "i extracted",
  "ocr completed",
  "confidence score",
  "ai thinks",
  "i recommend",
  "it appears diagnosed",
  "more distressed than a single note",
  "emotional distress — worth watching",
  "worth watching, not panicking",
  "what else matters most about this right now",
  "related notes are connecting — not starting over",
  "related notes are connecting",
  "related notes are starting to connect",
  "related notes are held",
  "related note was added",
  "a related note",
  "today's notes",
  "todays notes",
  "today's related notes are held together",
  "related notes from today are in the living care record",
  "notes stay connected as one picture",
  "care notes",
  "i saved a note",
  "your notes show",
  "based on your previous entries",
  "added this to your care notes",
  "supporting notes",
  "lower attention items",
  "starting to connect",
  "likely the same stretch",
  "same stretch of the day",
  "sit in the same picture",
  "same picture",
  "today's picture can connect",
  "today's picture grew",
  "working care picture",
  "working picture",
  "clearer picture than any single note",
  "understanding has become clearer",
  "today you have noticed several changes",
  "together, these suggest",
  "current understanding has",
  "gathering context — more detail",
  "enough related observations to form a working care picture",
  "enough related notes now form",
  "point to possible",
  "not two separate stories",
  "emotional distress",
  "possible emotional distress",
  "developing pattern of emotional distress",
  "dementia progression",
  "normal dementia",
  "typical dementia",
  "means dementia",
  "sleeping more means",
  "dementia improved",
  "dementia is improving",
  "condition improved",
  "dementia got better",
  "likely depression",
  "this is depression",
  "probably depression",
  "worsening dementia",
  "getting worse because",
  "adherence failed",
  "non-adherence",
  "noncompliance",
  "non-compliance",
  "you failed",
  "caregiver failed",
  "everything will be fine",
  "everything is fine",
  "don't worry",
  "do not worry",
  "perfectly normal",
  "document analyzer",
  "ocr confidence",
  "extracted fields",
  "parsing complete",
  "extraction pipeline",
  "this is normal for dementia",
  "dementia is worsening",
  "dementia patient",
  "failed to remember",
  "behavior problem",
  "other dementia patients",
  "other patients usually",
  "patients with dementia usually",
  "typical for dementia",
  "you should choose",
  "i recommend you sign",
  "you must decide now",
  "the right choice is",
  "medical decision for you",
  "chatgpt",
  "as an ai",
  "if distress for",
  "distress for",
  "related notes are held",
  "held together",
  "today's related notes are held together",
  "one picture",
  "notes stay connected as one picture",
  "solenos orients",
  "not a new story",
  "notice whether today's changes are new",
  "related notes from today are in the living care record",
  "held with today's notes",
  "today's care situation was updated",
  "today's care situation updated",
  // Emotional language / ChatGPT empathy bans
  "i understand how you feel",
  "i completely understand",
  "i'm here for you",
  "i am here for you",
  "i'm always here to help",
  "you are not alone",
  "you're not alone",
  "carry it alone",
  "do not have to carry it alone",
  "take a deep breath",
  "slow breath",
  "i hear you",
  "your feelings are valid",
  "you're doing your best",
  "burnout risk",
  "emotional load",
  "careload",
  "sentiment analysis",
  "confidence score",
  "i know you are exhausted",
  "i know you're exhausted",
  "that must be really hard",
  "i'm sorry you're going through this",
  "lets take this one step at a time",
  "let's take this one step at a time",
  // Invented Clarity theater — never caregiver-facing (forever gate)
  "stay with that",
  "doing well right now",
  "that is enough to hold",
  "that is enough to focus on",
  // Response Intelligence — never AI product / mechanics language
  "i analyzed",
  "i extracted",
  "i detected",
  "care event created",
  "entity identified",
  "classification:",
  "sentiment detected",
  "extraction complete",
  "that sounds difficult",
  // Final intelligence — weak orientation / alarm theater
  "stay with what is already held",
  "hard days",
  "open thread",
  "thanks for sharing",
  "you are doing great",
  "memory loss can be caused",
  // First vs returning — never invent prior relationship
  "as we previously",
  "as we already discussed",
  "picking up where we left off",
  "from our last conversation",
  // Output quality — internal architecture language
  "care signal",
  "situation model",
  "memory anchor",
  "understanding layer",
  "care state",
] as const;

export type ComposedCaregiverResponse = {
  /** Situation-grounded recognition — before hold/organization (section 1). */
  recognition_line: string | null;
  confirmation: string;
  /** Null when disclosure stage withholds Clarity. */
  what_matters_now: string | null;
  what_can_wait: string | null;
  what_may_become_serious: string | null;
  what_changed: string | null;
  /** How this turn connects to prior care story — returning only. */
  connection_note: string | null;
  /** Separate "How this connects" section — composer-owned; never observation_count alone. */
  show_connection: boolean;
  what_we_know: string[];
  situation_summary: string | null;
  still_unclear: string[];
  /** What is preserved for future continuity (section 6). */
  care_story_update: string | null;
  is_improvement: boolean;
  show_clarity: boolean;
  show_questions: boolean;
  /** Quiet L1 why-asking (optional). */
  why_asking: string | null;
  /** Evidence line by maturity ladder — never OCR/confidence/%. */
  evidence_line: string | null;
  /** Consequence tier used for evidence visibility (engine + UX). */
  evidence_maturity: 1 | 2 | 3 | 5 | 10;
  /** Real-world / record follow-ups when Decision-ready. */
  follow_up_items: string[];
  /** Structured contract trace — engine schema aligned to caregiver copy. */
  contract_output: ResponseIntelligenceOutput;
  /** Caregiver mental load signal — brief, non-judgmental. */
  mental_load_signal: string | null;
};

function containsBanned(text: string): boolean {
  const lower = text.toLowerCase();
  return CAREGIVER_RESPONSE_BANNED_PHRASES.some((p) => lower.includes(p.toLowerCase()));
}

function scrub(text: string | null | undefined): string | null {
  if (!text) return null;
  let t = text.trim();
  if (!t || containsBanned(t) || containsInternalLanguage(t)) return null;
  t = scrubInternalLanguage(t);
  if (!t || containsBanned(t)) return null;
  return t;
}

function scrubList(items: readonly string[], max: number, asFacts = true): string[] {
  const out: string[] = [];
  for (const item of items) {
    const s = scrub(item);
    if (!s) continue;
    if (asFacts && !isCaregiverFacingFactLine(s)) continue;
    if (!asFacts && containsBanned(s)) continue;
    out.push(s);
    if (out.length >= max) break;
  }
  return out;
}

/** Present held facts without archival "Earlier:" voice when orienting. */
function plainHeldFacts(items: readonly string[], max: number): string[] {
  return scrubList(
    items.map((line) => line.replace(/^Earlier:\s*/i, "").trim()),
    max,
  );
}

/**
 * Do not restate what the caregiver just typed — they already know it.
 * Prefer silence + gather asks. Works for any messy text/document, not topic keywords.
 */
function withoutRedundantEchoOfLatest(
  facts: readonly string[],
  latestRawText: string,
): string[] {
  const latestTokens = new Set(
    latestRawText
      .toLowerCase()
      .split(/[^a-z0-9']+/i)
      .filter((t) => t.length > 2),
  );
  if (latestTokens.size === 0) return [...facts];
  return facts.filter((fact) => {
    const tokens = fact
      .toLowerCase()
      .split(/[^a-z0-9']+/i)
      .filter((t) => t.length > 2);
    if (tokens.length === 0) return true;
    const overlap = tokens.filter((t) => latestTokens.has(t)).length;
    return overlap / tokens.length < 0.6;
  });
}

/** Turn messy capture into a short care fact (greeting/typo noise out). */
function cleanHeldCareFactLine(line: string): string {
  return line
    .replace(/^(your\s+)?(dad|mom):\s*/i, "")
    .replace(/^(hi|hello|hey)[,.]?\s*/i, "")
    .replace(/\bi'?m\s+\w+[,.]?\s*/gi, "")
    .replace(/\.{2,}/g, " ")
    .replace(/\bherefusedto\b/gi, "refused to")
    .replace(/\s+/g, " ")
    .trim();
}

/** G17 — identity mismatch: one soft ask; prior ACS held; no care-story theater. */
function composeIdentityMismatchTurn(params: {
  turn: ActiveSituationTurn;
  latestRawText: string;
  kind: CareEventKind;
}): ComposedCaregiverResponse {
  const { turn, latestRawText, kind } = params;
  const situation = turn.situation;
  const who = situation.subject_label?.trim();
  const named =
    who && who !== "Your loved one" && who !== "they" && who !== "person" ? who : null;
  const turnClass = "identity_mismatch" as const;
  const careWorthyCount = careRealityObservations(situation).length;
  const careMemoryState = classifyCareMemoryState({
    observationCount: situation.observations.length,
    crsRevision: turn.crs_revision,
    crsObservationCount: turn.crs_observation_count,
    careWorthyObservationCount: careWorthyCount,
  });
  const priorObservationFacts = situation.observations
    .filter((o) => !o.disputed_by_correction_id)
    .map((o) => observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }))
    .filter(
      (f): f is string =>
        typeof f === "string" &&
        f.length > 0 &&
        !isCaregiverGuidanceDemand(f) &&
        !isCaregiverQuestionPushback(f),
    );
  const ask =
    turn.what_needs_context[0]?.trim() ||
    composeIdentityMismatchAsk(situation.subject_label, latestRawText);
  const confirmation = resolveCareTurnConfirmation({
    turnClass,
    subjectLabel: named,
    careWorthyCount,
    latestIsCareWorthy: false,
    hasCareEvidence: hasCareEvidenceHeld(situation),
    isNewCareReality: careMemoryState === "new_care_reality",
    gatheringContext: false,
    priorObservationFactsCount: priorObservationFacts.length,
    continuitySymptom: false,
    improvement: false,
    hasDocuments: false,
    kind,
    relation: turn.relation,
    patternLabel: turn.pattern_label,
    latestRawText,
  });
  const recognition_line = scrub(composeIdentityMismatchRecognition({ activeSubjectLabel: named }));
  const what_we_know = plainHeldFacts(priorObservationFacts, 3);
  const still_unclear = [ask];
  const intelligence = buildResponseIntelligenceOutput({
    what_is_happening: what_we_know[0] ?? null,
    what_matters_now: null,
    what_to_ask_next: still_unclear,
    what_can_wait: null,
    follow_up_items: [],
    risk_level: "low",
    observation_count: situation.observations.length,
    has_open_unknowns: true,
    has_meaningful_change: false,
  });
  const composed: ComposedCaregiverResponse = {
    recognition_line,
    confirmation,
    what_matters_now: null,
    what_can_wait: null,
    what_may_become_serious: null,
    what_changed: null,
    connection_note: null,
    show_connection: false,
    what_we_know,
    situation_summary: null,
    still_unclear,
    care_story_update: null,
    is_improvement: false,
    show_clarity: false,
    show_questions: true,
    why_asking: null,
    evidence_line: null,
    evidence_maturity: 1,
    follow_up_items: [],
    contract_output: intelligence,
    mental_load_signal: (() => {
      const openGaps = still_unclear.length;
      if (openGaps >= 3) {
        return "Several things need attention at once — nothing has to be solved tonight.";
      }
      if (openGaps >= 2) {
        return "A few pieces are still missing — the most important one is enough for now.";
      }
      if (openGaps === 1) {
        return "One question is still open — it can wait until you have the answer.";
      }
      return null;
    })(),
  };
  assertComposedResponseProfessional(composed);
  assertResponseAcceptanceGate({
    composed,
    careMemoryState,
    observationCount: situation.observations.length,
    careWorthyCount,
    latestIsCareWorthy: false,
    latestRawText,
    turnClass,
  });
  // Slice 5.5 — optional G61 after acceptance; never blocks capture (identity hold path).
  applyRealCaregiverTestComposeGate({ composed, turnClass });
  return composed;
}

/**
 * Compose the only caregiver-facing copy for this turn.
 * Latest observation defines current state. History may appear as "Earlier:" only.
 * Disclosure plan gates Clarity / asks — panel must not bypass.
 */
export function composeCaregiverResponse(params: {
  turn: ActiveSituationTurn;
  latestRawText: string;
  kind: CareEventKind;
  hasDocuments?: boolean;
  /** Baseline→change note from Care Reality / baseline engines — never scenario templates. */
  baselineChangeNote?: string | null;
}): ComposedCaregiverResponse {
  const { turn, latestRawText, kind } = params;
  const baselineChangeNote = params.baselineChangeNote?.trim() || null;
  const situation = turn.situation;
  const turnClass = classifyCaregiverTurn({
    latestRawText,
    kind,
    turn,
    hasDocuments: params.hasDocuments,
  });
  if (turnClass === "identity_mismatch") {
    return composeIdentityMismatchTurn({ turn, latestRawText, kind });
  }
  const continuitySymptom = turnClass === "continuity_symptom";
  const latestSignals = latestObservationSignals(situation.observations);
  const fromText = detectObservationSignals(latestRawText, kind);
  const mergedLatest = [...new Set([...latestSignals, ...fromText])];
  const improvement = turnClass === "improvement" || isImprovementUpdate(mergedLatest);
  const heldSignals = collectSituationSignals(
    situation.observations.filter(
      (o) =>
        !isCaregiverGuidanceDemand(o.raw_text) &&
        !isCaregiverQuestionPushback(o.raw_text),
    ),
  );
  const pushback = turnClass === "pushback";

  const interpretationGather =
    classifyEpistemicClaim(latestRawText) === "caregiver_interpretation" &&
    !situation.observations.some(
      (o) =>
        o.epistemic_kind === "observable_observation" ||
        o.epistemic_kind === "mixed" ||
        (o.epistemic_kind !== "caregiver_interpretation" &&
          o.raw_text !== latestRawText &&
          classifyEpistemicClaim(o.raw_text) === "observable_observation"),
    );

  const continuityWorryTurn = turn.pattern_label === "continuity worry";
  const priorHeldReality = situation.observations.length > 1;
  const careWorthyCount = careRealityObservations(situation).length;
  const hasCareEvidence = hasCareEvidenceHeld(situation);
  const latestIsCareWorthy = latestObservationIsCareWorthy(situation);
  const careMemoryState = classifyCareMemoryState({
    observationCount: situation.observations.length,
    crsRevision: turn.crs_revision,
    crsObservationCount: turn.crs_observation_count,
    careWorthyObservationCount: careWorthyCount,
  });
  const isNewCareReality = careMemoryState === "new_care_reality";

  const crsKey = situation.care_recipient_id ?? situation.caregiver_id;
  const crs = getCareRealityState(crsKey);
  const crsCtx = resolveCrsComposeContext({
    crs,
    turn,
    latestRawText,
    latestIsCareWorthy,
    isNewCareReality,
    turnClass,
  });

  // Situation modeling BEFORE caregiver language — baseline→change→events→decisions→unknowns.
  // Pipeline: ingestion → extraction → prioritization → situation modeling → response (not UI patches).
  const situationModel = buildCareRealitySituationModel({
    situation,
    latestRawText,
    crs,
    baselineChangeNote,
    careKey: crsKey,
  });
  const modelOrientation = orientationFromSituationModel(situationModel);

// Care Situation Understanding — instant orientation from typed care reality (not summary).
  // Uses synchronous deterministic extraction path (no LLM dependency).
// Phase 5: Inject prior CRS continuity hooks and open unknowns so second-turn
  // reasoning reconnects to prior care reality (fall, mobility, medication thread)
  // rather than creating a new unrelated interpretation.
  const careUnderstanding = buildCareSituationUnderstandingFromExtraction({
    rawText: latestRawText,
    contributorId: situation.caregiver_id,
    careKey: crsKey,
    situation,
    personDisplayName: situation.subject_label || situationModel.person,
    priorContinuityHooks: crs?.continuity_hooks ?? [],
    priorUnknowns: crs?.open_uncertainties ?? [],
  });
  const careOrientation = careUnderstanding.can_orient
    ? projectCareSituationOrientation(careUnderstanding)
    : null;

// Phase 4: Response = Projection of Understanding.
  // The Response Contract is projected from the structured understanding model,
  // NOT from raw caregiver text, keyword-ladder clarity pillars, or /api/analyze compression.
  // Projection runs once here and feeds contract_output as the authoritative source.
  const careProjection = careUnderstanding.can_orient
    ? projectCareSituationToResponseContract(careUnderstanding)
    : null;

  // Prefer situation-model extraction
  let extraction: CareRealityExtractionResult | null =
    situationModel.extraction ?? null;
  if (!extraction && latestRawText.trim().length >= 12 && latestIsCareWorthy) {
    extraction = extractCareRealityFromText({
      rawText: latestRawText,
      contributorId: situation.caregiver_id,
    });
  }
  const extractionSurfaceLines = caregiverFacingLinesFromExtraction({
    extraction,
    latestRawText,
    max: 4,
    includeEvents: true,
    includeActions: true,
  });
  // Recognition / focus: observation-first; events/actions still allowed when no observation line.
  const extractionFocusLine =
    caregiverFacingLinesFromExtraction({
      extraction,
      latestRawText,
      max: 1,
      includeEvents: true,
      includeActions: true,
    })[0] ??
    heldFocusLines(situation, 1)[0] ??
    null;

  const gatheringContext =
    !improvement &&
    !pushback &&
    !continuityWorryTurn &&
    !(priorHeldReality && turnClass === "emotional_only") &&
    (turnClass === "emotional_only" ||
      turnClass === "empty_or_thin" ||
      interpretationGather);

  const facetsRaw = selectResponseFacets({
    turn,
    turnClass,
    gatheringContext,
    hasDocuments: params.hasDocuments,
    latestRawText,
  });
  // Slice 2.4 — explicit correction must surface what changed (not gather-hide).
  const facets = turn.memory_correction_applied
    ? {
        ...facetsRaw,
        show_what_changed: true,
        show_what_we_know: true,
        show_what_is_happening: true,
      }
    : facetsRaw;

  const pillars =
    continuitySymptom || pushback
      ? buildGuidanceOrientationPillars({
          situation,
          signals: heldSignals,
          baselineChangeNote,
        })
      : buildCareClarityPillars({
          situation,
          stage: turn.understanding_stage,
          signals: [
            ...new Set(
              situation.observations.flatMap((o) =>
                detectObservationSignals(o.raw_text, o.kind),
              ),
            ),
          ],
          latestSignals: mergedLatest,
          patternLabel: improvement
            ? "earlier concern with later improvement"
            : turn.pattern_label,
          kind,
          latestRawText,
          baselineChangeNote,
        });

  const priorObservationFacts = situation.observations
    .slice()
    .reverse()
    .filter((o) => !o.disputed_by_correction_id)
    .map((o) => observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }))
    .filter(
      (f): f is string =>
        typeof f === "string" &&
        f.length > 0 &&
        !isCaregiverGuidanceDemand(f) &&
        !isCaregiverQuestionPushback(f),
    );

  const who = situation.subject_label?.trim();
  const namedFromAcs =
    who && who !== "Your loved one" && who !== "they" && who !== "person" ? who : null;
  // Session kinship from Care Recipient Anchor (Locked A: not durable write).
  const named =
    namedFromAcs ??
    (situationModel.care_recipient_anchor.care_recipient &&
    situationModel.care_recipient_anchor.care_recipient !== "they"
      ? situationModel.care_recipient_anchor.care_recipient
      : null);

  let confirmation = resolveCareTurnConfirmation({
    turnClass,
    subjectLabel: named,
    careWorthyCount,
    latestIsCareWorthy,
    hasCareEvidence,
    isNewCareReality,
    gatheringContext,
    priorObservationFactsCount: priorObservationFacts.length,
    continuitySymptom,
    improvement,
    hasDocuments: Boolean(params.hasDocuments),
    kind,
    relation: turn.relation,
    patternLabel: turn.pattern_label,
    latestRawText,
  });

  // Output quality: situation-grounded recognition — never care-story theater before evidence.
  let recognition_line: string | null = null;
  if (
    turnClass !== "empty_or_thin" &&
    turnClass !== "pushback" &&
    turnClass !== "record_question"
  ) {
    if (!hasCareEvidence) {
      recognition_line = scrub(composeAwaitingCareEvidenceRecognition());
    } else if (
      !latestIsCareWorthy &&
      isProductSessionMetaText(latestRawText)
    ) {
      recognition_line = scrub(composeProductMetaTurnRecognition());
    } else if (hasCareEvidence) {
      const competingPreview = prioritizeCompetingAttention(latestRawText);
      const recognition = composeRecognitionLine({
        isNewCareReality,
        isCompeting: competingPreview.is_competing,
        hasCaregiverLoad:
          looksLikeCaregiverLoadLanguage(latestRawText) ||
          adaptForCaregiverCapacity(latestRawText).overload_likely,
        heldFocus: extractionFocusLine,
        subjectLabel: named,
        latestRawText,
      });
      if (recognition && !/i understand how you feel|i'm here for you/i.test(recognition)) {
        recognition_line = scrub(recognition);
      }
    }
  }

  let what_changed: string | null = null;
  if (
    turn.memory_correction_applied &&
    turn.what_changed_in_understanding
  ) {
    what_changed = scrub(turn.what_changed_in_understanding);
  }
  if (
    !what_changed &&
    crsCtx.usesCrsAsSource &&
    !latestIsCareWorthy &&
    crsCtx.whatChangedInUnderstanding &&
    !gatheringContext
  ) {
    what_changed = scrub(crsCtx.whatChangedInUnderstanding);
  }
  if (baselineChangeNote && !gatheringContext && !what_changed) {
    what_changed = scrub(baselineChangeNote);
  }
  if (
    !what_changed &&
    turn.what_changed_in_understanding &&
    (/usual pattern|differ from|daily-living changes|related care changes|days can vary|appeared clearer|meaningful change|safety (?:area|concern)|Remembered:|cause is not known|not treated as a crisis|matters for safety|not to assign blame|not choosing sides|missed care timing|care timing was missed|everyday language is enough|Oriented from what is already held|not a diagnosis|Sources do not fully agree|both are held|repeatedly — held as a pattern|without assigning a meaning|Uncertainty about what is usual|empty reassurance|routine looks disrupted|not dismissed|more going on behind|care transition is held|responsibility is held|earlier safety evidence|journey milestone|Advanced care wishes|will not make medical decisions|new observation is held|related care update is held|care choice is held|after what was already underway|Understanding of the care situation was updated|latest update changes what we understand/i.test(
      turn.what_changed_in_understanding,
    ))
  ) {
    what_changed = scrub(turn.what_changed_in_understanding);
  } else if (
    !what_changed &&
    situation.observations.length > 1 &&
    turn.what_changed_in_understanding &&
    (facets.show_what_changed ||
      earlyGatherIncomplete({ situation, signals: heldSignals }) ||
      /new observation is held|related care update is held|care choice is held|after what was already underway|Understanding of the care situation was updated|latest update changes what we understand/i.test(
        turn.what_changed_in_understanding,
      ))
  ) {
    if (improvement && turn.pattern_label !== "day-to-day fluctuation") {
      what_changed =
        "The latest update changes what we understand. Earlier understanding stays in the care record.";
    } else if (continuitySymptom) {
      what_changed =
        "Oriented from held care reality — preparation for your next conversation, not advice.";
    } else {
      what_changed = scrub(turn.what_changed_in_understanding);
      if (
        what_changed &&
        (/^today'?s care situation was updated\.?$/i.test(what_changed) ||
          /related note(?:s)?(?:\s+was\s+added|\s+(?:are|from)\b)/i.test(what_changed) ||
          /today'?s notes\b/i.test(what_changed) ||
          /held with today'?s notes/i.test(what_changed) ||
          containsWeakOrientation(what_changed))
      ) {
        what_changed = null;
      }
    }
  }

  if (turn.compound_signal && !what_changed && !gatheringContext) {
    what_changed = scrub(turn.compound_signal);
  }

  // Prefer Care Reality Situation Model (baseline→change) over weak echo / storage theater.
  if (
    !what_changed &&
    modelOrientation.what_changed &&
    !gatheringContext &&
    !pushback
  ) {
    what_changed = scrub(modelOrientation.what_changed);
  }

  let situation_summary: string | null = null;
  if (!facets.show_what_is_happening || gatheringContext) {
    situation_summary = null;
  } else if (continuitySymptom && priorObservationFacts.length > 0) {
    situation_summary = "What you already shared today is the open concern.";
  } else {
    if (facets.show_what_is_happening) {
      if (
        crsCtx.usesCrsAsSource &&
        !latestIsCareWorthy &&
        crsCtx.situationSummary &&
        !gatheringContext
      ) {
        situation_summary = scrub(crsCtx.situationSummary);
      } else if (improvement) {
        situation_summary = scrub(turn.what_seems_happening);
        if (!situation_summary && turn.current_understanding[0]) {
          situation_summary = scrub(turn.current_understanding[0]);
        }
      } else {
        situation_summary = scrub(turn.what_seems_happening);
      }
      if (
        situation_summary &&
        (/related (?:notes|pieces) from today/i.test(situation_summary) ||
          containsWeakOrientation(situation_summary))
      ) {
        situation_summary = null;
      }
    }
    // Situation model current understanding — orientation, not summary of words
    if (
      !situation_summary &&
      modelOrientation.current_understanding &&
      facets.show_what_is_happening &&
      !gatheringContext
    ) {
      situation_summary = scrub(modelOrientation.current_understanding);
    }
    // Prefer recipient-centered model understanding when family conflict was in the capture
    if (
      situationModel.care_recipient_anchor.contributor_context.length > 0 &&
      modelOrientation.current_understanding &&
      facets.show_what_is_happening &&
      !gatheringContext &&
      situationModel.care_recipient_anchor.recipient_changes.length > 0
    ) {
      situation_summary = scrub(modelOrientation.current_understanding);
    }
    // Always prefer structured Care Reality summary when we can orient (Response Contract).
    // Never dump the current ask into "what is happening" — asks are a separate field.
    const structuralUnknowns = careContextGapsRemain({ situation })
      ? ["whether this differs from usual, and when it started"]
      : [];
    const structured = buildSituationUnderstandingSummary({
      heldFacts:
        extractionSurfaceLines.length > 0
          ? extractionSurfaceLines.slice(0, 2)
          : crsCtx.usesCrsAsSource && crsCtx.heldUnderstanding.length > 0
            ? crsCtx.heldUnderstanding.slice(0, 2)
            : heldFocusLines(situation, 2),
      whatChanged: what_changed,
      isGathering: turn.understanding_stage === "gathering" && !facets.show_clarity,
      openUnknowns: structuralUnknowns,
    });
    if (
      structured &&
      (!situation_summary ||
        /don'?t know|not sure|unsure whether/i.test(situation_summary) ||
        containsWeakOrientation(situation_summary) ||
        facets.show_clarity)
    ) {
      situation_summary = structured;
    }
  }

  const factCap = 2;
  const understandingSource = crsCtx.heldUnderstanding.filter(
    (line) => !isCaregiverGuidanceDemand(line),
  );
  // Prefer partitioned extraction surfaces over ACS human_fact ≈ raw for what_we_know.
  let facts =
    extractionSurfaceLines.length > 0
      ? scrubList(extractionSurfaceLines, factCap)
      : continuitySymptom
        ? plainHeldFacts(
            understandingSource.length > 0 ? understandingSource : priorObservationFacts,
            factCap,
          )
        : scrubList(understandingSource, factCap);
  // Never promote product/session meta into "what is understood"
  facts = facts.filter((f) => isCareRealityAnchorText(f) || /you described/i.test(f));
  if (facts.length === 0 && !gatheringContext && facets.show_what_we_know) {
    const fromHeldExtraction = heldFocusLines(situation, factCap).filter(
      (line) => !isNearRawCaregiverFacet(line, latestRawText),
    );
    facts =
      fromHeldExtraction.length > 0
        ? scrubList(fromHeldExtraction, factCap)
        : continuitySymptom
          ? plainHeldFacts(priorObservationFacts, factCap)
          : scrubList(priorObservationFacts, factCap);
  }
  let what_we_know = withoutRedundantEchoOfLatest(facts, latestRawText);
  // G37 — never promote bare interpretive judgment as settled care fact
  what_we_know = what_we_know.filter(
    (line) => /you described/i.test(line) || !/held as your experience/i.test(line),
  );
  // Drop lines that are unframed character judgments
  what_we_know = what_we_know.filter((line) => {
    if (/you described/i.test(line)) return true;
    return !/\b(is being|was being|has been)\s+\w*difficult\b/i.test(line);
  });
  // Clean greeting / messy typing into short care facts
  what_we_know = what_we_know
    .map((line) => cleanHeldCareFactLine(line))
    .filter((line) => line.length > 3)
    .map((line) => (line.endsWith(".") ? line : `${line}.`));
  // Epistemic split — observations first; interpretations framed separately; never merge layers.
  if (what_we_know.length > 0) {
    const layers = separateEpistemicOutputLayers({
      factLines: what_we_know,
      latestRawText,
      epistemicKind: classifyEpistemicClaim(latestRawText),
    });
    const preferred = [...layers.observed, ...layers.interpretations].slice(0, factCap);
    if (preferred.length > 0) {
      what_we_know = preferred.map((line) =>
        line.endsWith(".") || line.endsWith("”") || line.endsWith('"')
          ? line
          : `${line}.`,
      );
    }
  }
  // Prefer care-situation observations over caregiver-load phrasing as "understood."
  what_we_know = preferCareSituationFacts(what_we_know).slice(0, factCap);
  // Never surface near-raw capture slices as "what is understood."
  what_we_know = what_we_know.filter(
    (line) => !isNearRawCaregiverFacet(line, latestRawText),
  );

  // Care Reality extraction — merge partitioned lines (already preferred above when present).
  // Keep block for unknowns / relationships; do not re-seed from near-raw human_fact.
  if (extraction && extractionSurfaceLines.length > 0 && what_we_know.length < factCap) {
    const structured = extractionSurfaceLines.filter(
      (line) => !isNearRawCaregiverFacet(line, latestRawText),
    );
    if (structured.length > 0) {
      const merged = preferCareSituationFacts([
        ...structured,
        ...what_we_know,
      ]).slice(0, Math.max(factCap, 3));
      // Re-apply epistemic framing — extraction lines must not surface bare judgments as facts.
      const layers = separateEpistemicOutputLayers({
        factLines: merged,
        latestRawText,
        epistemicKind: classifyEpistemicClaim(latestRawText),
      });
      const preferred = [...layers.observed, ...layers.interpretations].slice(
        0,
        Math.max(factCap, 3),
      );
      what_we_know =
        preferred.length > 0
          ? preferred.map((line) =>
              line.endsWith(".") || line.endsWith("”") || line.endsWith('"')
                ? line
                : `${line}.`,
            )
          : merged;
      what_we_know = what_we_know.filter(
        (line) => !isNearRawCaregiverFacet(line, latestRawText),
      );
    }
  }
  // If echo-filter dropped the only held line, restore Observation-layer facts only.
  // Never longest-clause ranking (family disagreement / load often win by length).
  if (what_we_know.length === 0 && facets.show_what_we_know) {
    const fromHeld = heldFocusLines(situation, Math.max(factCap, 2)).filter(
      (line) => !isNearRawCaregiverFacet(line, latestRawText),
    );
    if (fromHeld.length > 0) {
      what_we_know = preferCareSituationFacts(fromHeld).slice(0, factCap);
    } else if (
      crsCtx.usesCrsAsSource &&
      !latestIsCareWorthy &&
      crsCtx.heldUnderstanding[0] &&
      !isNearRawCaregiverFacet(crsCtx.heldUnderstanding[0], latestRawText)
    ) {
      what_we_know = [
        crsCtx.heldUnderstanding[0].endsWith(".")
          ? crsCtx.heldUnderstanding[0]
          : `${crsCtx.heldUnderstanding[0]}.`,
      ];
    }
    // Never seed what_we_know from human_fact ≈ raw — extraction/heldFocus already preferred.
  }
  // Keep held facts during gather — G1: Held + facts + asks (never asks-only empty)
  if (!facets.show_what_we_know) {
    what_we_know = [];
  }
  if (pushback) {
    what_we_know = plainHeldFacts(priorObservationFacts, 2);
    situation_summary = "What you already shared is still the open concern today.";
  }

  let still_unclear: string[] = [];
  if (facets.show_asks && !improvement && !pushback) {
    const needGapAsks =
      (gatheringContext && careWorthyCount <= 1) ||
      (facets.show_asks &&
        (earlyGatherIncomplete({ situation, signals: heldSignals }) ||
          careContextGapsRemain({ situation })) &&
        !continuitySymptom);
    if (needGapAsks) {
      const planned = scrubList(turn.what_needs_context, 3, false).filter(isCaregiverFacingAsk);
      still_unclear =
        planned.length > 0
          ? planned
          : nextQuestionsForUnderstanding({
              situation,
              stage: turn.understanding_stage,
              latestKind: kind,
              latestText: latestRawText,
              signals: heldSignals,
              patternLabel: turn.pattern_label,
              remainingOpen: [],
              maxQuestions: facets.max_asks,
            }).filter(isCaregiverFacingAsk);
      if (turnClass === "emotional_only" && still_unclear.length === 0) {
        // Locked A: one soft invite to care reality — never a two-ask interview.
        still_unclear = ["Has something changed with care recently?"];
      }
      if (turnClass === "empty_or_thin") {
        still_unclear = ["What happened, or what is on your mind?"];
      }
    } else if (facets.show_asks && !continuitySymptom) {
      const crsAsks = scrubList(crsCtx.openUncertainties, 3, false).filter(
        isCaregiverFacingAsk,
      );
      still_unclear =
        crsCtx.usesCrsAsSource && crsAsks.length > 0
          ? crsAsks
          : scrubList(turn.what_needs_context, 3, false).filter(isCaregiverFacingAsk);
    }
    still_unclear = still_unclear.slice(0, facets.max_asks);
  }

  if (turnClass === "answer_to_open" && turn.resolved_uncertainties.length > 0) {
    still_unclear = [];
  }

  still_unclear = filterSessionUncertaintyAsks({
    asks: still_unclear,
    askedQuestions: situation.asked_questions,
    resolvedUncertainties: [
      ...turn.resolved_uncertainties,
      ...(crs?.resolved_uncertainties ?? []),
    ],
    situation,
    currentTurnAsks: turn.what_needs_context,
  }).slice(0, facets.max_asks);

  // Phase 9 — capacity adaptation: reduce asks when overload language appears (never surface scores).
  const capacity = adaptForCaregiverCapacity(latestRawText);
  if (capacity.overload_likely) {
    still_unclear = still_unclear.slice(0, capacity.max_asks);
  }

  // Situation model asks: blank identity only when truly unknown (Locked A).
  // Session kinship (Mom/Dad in note) must NOT replace care understanding with "Who is this?".
  if (
    situationModel.care_recipient_anchor.needs_identity_ask &&
    facets.show_asks &&
    !pushback
  ) {
    still_unclear = [situationModel.care_recipient_anchor.identity_ask].slice(0, 1);
  } else if (
    facets.show_asks &&
    !improvement &&
    !pushback &&
    turnClass !== "answer_to_open" &&
    still_unclear.length === 0 &&
    modelOrientation.one_thing_to_add &&
    isCaregiverFacingAsk(modelOrientation.one_thing_to_add)
  ) {
    still_unclear = [modelOrientation.one_thing_to_add].slice(
      0,
      capacity.overload_likely ? capacity.max_asks : Math.min(1, facets.max_asks || 1),
    );
  } else if (
    facets.show_asks &&
    !improvement &&
    !pushback &&
    still_unclear.length === 0 &&
    modelOrientation.one_thing_to_add
  ) {
    // Model asks may be confirmation_gap family — allow when gather asks empty
    const ask = modelOrientation.one_thing_to_add;
    if (/confirmation|unclear|not held yet|when this change|what may explain|who is this situation/i.test(ask)) {
      still_unclear = [ask.endsWith("?") || ask.endsWith(".") ? ask : `${ask}`].slice(0, 1);
    }
  }

  // Unknown layer: surface extracted open gaps (preserve uncertainty — never invent answers).
  if (
    extraction &&
    facets.show_asks &&
    !improvement &&
    !pushback &&
    turnClass !== "answer_to_open"
  ) {
    const fromUnknowns = extraction.unknowns
      .map((u) => composeCaregiverUnknownAsk(u))
      .filter((q): q is string => Boolean(q))
      .filter(isCaregiverFacingAsk);
    if (fromUnknowns.length > 0) {
      still_unclear = filterSessionUncertaintyAsks({
        asks: [...fromUnknowns, ...still_unclear],
        askedQuestions: situation.asked_questions,
        resolvedUncertainties: [
          ...turn.resolved_uncertainties,
          ...(crs?.resolved_uncertainties ?? []),
        ],
        situation,
        currentTurnAsks: turn.what_needs_context,
      }).slice(0, capacity.overload_likely ? capacity.max_asks : facets.max_asks);
    }
  }

  // Clinical profile influence (dementia MVP default) — gaps from Unknowns profile,
  // caregiver wording stays gather-family / person language (ADR-005). Never diagnosis FAQ.
  let profileOpenCategories: string[] = [];
  let profileInfluenceAsks: string[] = [];
  if (
    facets.show_asks &&
    !improvement &&
    !pushback &&
    turnClass !== "answer_to_open" &&
    latestIsCareWorthy
  ) {
    const recipientProfile = getOrCreateProfile({
      caregiver_id: situation.caregiver_id,
    });
    const clinicalProfileId = resolveClinicalProfileFromCareContext(
      recipientProfile.care_context,
    );
    const eventTexts = [
      ...situation.observations.map((o) => o.raw_text),
      latestRawText,
    ].filter((t) => t.trim().length >= 4);
    const profileInfluence = caregiverAsksFromClinicalProfile({
      eventTexts,
      clinicalProfileId,
      maxAsks: capacity.overload_likely ? 1 : 2,
    });
    profileOpenCategories = profileInfluence.openCategories;
    profileInfluenceAsks = profileInfluence.asks;
    if (profileInfluenceAsks.length > 0) {
      still_unclear = filterSessionUncertaintyAsks({
        asks: [...profileInfluenceAsks, ...still_unclear],
        askedQuestions: situation.asked_questions,
        resolvedUncertainties: [
          ...turn.resolved_uncertainties,
          ...(crs?.resolved_uncertainties ?? []),
        ],
        situation,
        currentTurnAsks: turn.what_needs_context,
      }).slice(0, capacity.overload_likely ? capacity.max_asks : facets.max_asks);
    }
}

  const show_clarity = facets.show_clarity;
  let what_matters_now: string | null = null;
  let what_can_wait: string | null = null;
  let what_may_become_serious: string | null = null;

  // Phase 3: PRIMARY = CareSituationUnderstanding projection (impact-driven).
  // Keyword ladder pillars are degraded fallback when understanding confidence is low.
  const understandingCanPrioritize =
    careUnderstanding.can_orient &&
    careUnderstanding.confidence !== "low" &&
    !pushback &&
    !improvement;

  if (show_clarity) {
    if (pushback) {
      what_matters_now =
        "Staying with what you already shared — nothing more is needed right now.";
      what_can_wait = "Filling every missing detail tonight.";
      what_may_become_serious = null;
} else if (careProjection && understandingCanPrioritize) {
      what_matters_now = scrub(careProjection.what_matters_now);
      what_can_wait = scrub(careProjection.what_can_wait);
      what_may_become_serious = null;
    }
    // Fallback to dementia-profile hints only when understandingCanPrioritize is false
    if (!understandingCanPrioritize) {
      const profileMatters = caregiverMattersHintFromClinicalProfile({
        openCategories: profileOpenCategories,
        heldFocus: heldFocusLines(situation, 1)[0] ?? null,
        latestRawText,
      });
      if (profileMatters && (!what_matters_now || containsWeakOrientation(what_matters_now) || /how (?:this|these concerns) sit/i.test(what_matters_now))) {
        what_matters_now = profileMatters;
      }
    }

    // Trajectory-aware what_matters_now: if domains are worsening, surface that focus.
    if (show_clarity && what_matters_now && turn.trajectory_by_domain) {
      const worseningDomains = Object.entries(turn.trajectory_by_domain)
        .filter(([, t]) => t === "worsening")
        .map(([d]) => d.replace(/_/g, " "));
      if (worseningDomains.length > 0 && !/worsening|declin|getting worse/i.test(what_matters_now)) {
        const trajectoryNote = `${worseningDomains[0]?.replace(/_/g, " ")} changes are showing a concerning pattern`;
        if (!what_matters_now.includes(trajectoryNote)) {
          what_matters_now = `${trajectoryNote}. ${what_matters_now}`;
        }
      }
    }
  }

if (improvement) {
    what_may_become_serious = null;
    still_unclear = [];
  }

// CareOrientation projection as secondary gap-fill ONLY for what_we_know / recognition / what_is_happening.
  // matters_now, can_wait, and questions are SOLELY from careProjection (primary projection path above).
  // This block never overrides projection-derived values — only fills gaps the projection left empty.
  if (
    careOrientation &&
    careUnderstanding.can_orient &&
    !pushback &&
    !improvement &&
    turnClass !== "record_question" &&
    turnClass !== "empty_or_thin"
  ) {
    if (careOrientation.what_we_know.length > 0) {
      what_we_know = preferCareSituationFacts(
        careOrientation.what_we_know.map((l) => scrub(l) ?? l).filter(Boolean),
      ).slice(0, 5);
    }
    if (careOrientation.recognition_line && !recognition_line) {
      recognition_line = scrub(careOrientation.recognition_line);
    }
    if (
      careOrientation.what_is_happening &&
      (!situation_summary || containsSituationSummaryTheater(situation_summary))
    ) {
      situation_summary = scrub(careOrientation.what_is_happening);
    }
  }

  // Research validation: competing concerns → situation prioritization, not a task list.
  const competing = prioritizeCompetingAttention(latestRawText);
  if (
    competing.is_competing &&
    turnClass !== "record_question" &&
    turnClass !== "emotional_only" &&
    !pushback
  ) {
    const laneLines = formatCompetingSituationLines(competing);
    if (laneLines.length > 0) {
      what_we_know = preferCareSituationFacts(
        [...new Set([...laneLines, ...what_we_know])],
      ).slice(0, 3);
}
    if (competing.orientation) {
      situation_summary = competing.orientation;
    }
    // Only fill Clarity pillars when understanding projection has not already filled them.
    // Never override projection-derived what_matters_now (understanding is primary source).
    if (show_clarity && !understandingCanPrioritize) {
      const focus = laneLines[0]?.replace(/^Still unclear:\s*/i, "") ?? null;
what_matters_now = buildMattersNowOrientation({
        subjectLabel: named,
        heldFocus: focus,
        baselineChange: baselineChangeNote,
        topUnknown: null,
        patternContinues: careWorthyCount >= 3,
      });
      what_can_wait =
        "Explaining every detail or deciding everything for the week tonight.";
    }
  }

  // Care Signal Understanding — gap-fill only (care reality, not task list; no jargon).
  if (show_clarity && !pushback && !improvement && turnClass !== "emotional_only") {
    const csl = processCareSignalUnderstanding({
      raw_input: latestRawText,
      contributor_id: situation.caregiver_id,
    });
    if (
      (!what_matters_now || containsWeakOrientation(what_matters_now)) &&
      csl.what_matters_now
    ) {
      what_matters_now = scrub(csl.what_matters_now) ?? what_matters_now;
    }
    if (still_unclear.length === 0 && csl.uncertain.length > 0) {
      still_unclear = csl.uncertain.slice(
        0,
        capacity.overload_likely ? capacity.max_asks : facets.max_asks,
      );
    }
  }

  // Response Intelligence: soft / vague notes still get orientation (not empty storage).
  // Never bypass facets — only when what-is-happening is allowed.
  if (
    facets.show_what_is_happening &&
    turnClass !== "record_question" &&
    turnClass !== "empty_or_thin" &&
    !pushback &&
    what_we_know.length === 0 &&
    !situation_summary
  ) {
    const soft =
      latestRawText.trim().length > 0 &&
      latestRawText.trim().length < 120 &&
      !/\d{2,}/.test(latestRawText);
    if (soft || turnClass === "emotional_only" || continuitySymptom) {
      situation_summary = composeMemoryAwareSoftSummary({ state: careMemoryState });
      if (!what_changed) {
        what_changed = composeMemoryAwareWhatChanged({
          state: careMemoryState,
          baselineChangeNote,
        });
      }
    }
  }

  // Returning: surface already-known vs new when prior *care* facts exist (never meta).
  if (
    !isNewCareReality &&
    !gatheringContext &&
    turnClass !== "record_question" &&
    turnClass !== "empty_or_thin" &&
    !pushback
  ) {
    if (
      crsCtx.usesCrsAsSource &&
      !latestIsCareWorthy &&
      crsCtx.heldUnderstanding.length > 0 &&
      what_we_know.length < factCap &&
      facets.show_what_we_know
    ) {
      const crsLine = crsCtx.heldUnderstanding[0]!;
      const normalized = crsLine.endsWith(".") ? crsLine : `${crsLine}.`;
      if (
        !what_we_know.some((l) =>
          l.toLowerCase().includes(normalized.slice(0, Math.min(24, normalized.length)).toLowerCase()),
        )
      ) {
        what_we_know = [normalized, ...what_we_know].slice(0, factCap);
      }
    }
    const priorOnly = situation.observations
      .slice(0, -1)
      .map((o) => observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }))
      .filter((f): f is string => Boolean(f));
    const latestOnly = situation.observations
      .slice(-1)
      .map((o) => observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }))
      .filter((f): f is string => Boolean(f));
    const oriented = composeReturningOrientationLines({
      priorFacts: priorOnly,
      latestFacts: latestOnly,
    });
    if (oriented.what_is_new.length > 0 && !what_changed) {
      what_changed = composeMemoryAwareWhatChanged({
        state: careMemoryState,
        baselineChangeNote,
        priorFact: oriented.already_known[0] ?? null,
        latestFact: oriented.what_is_new[0] ?? null,
      });
    }
    if (
      oriented.already_known.length > 0 &&
      what_we_know.length < 3 &&
      facets.show_what_we_know
    ) {
      const knownLine = `Already held: ${oriented.already_known[0]!.replace(/\.$/, "")}.`;
      if (!what_we_know.some((l) => /already held/i.test(l))) {
        what_we_know = [...what_we_know, knownLine].slice(0, 3);
      }
    }
  }

  // New care reality: never keep fake-continuity lines in orientation fields.
  if (isNewCareReality) {
    if (situation_summary && containsFakeContinuity(situation_summary)) {
      situation_summary = composeMemoryAwareSoftSummary({ state: careMemoryState });
    }
    if (what_changed && containsFakeContinuity(what_changed)) {
      what_changed = composeMemoryAwareWhatChanged({
        state: careMemoryState,
        baselineChangeNote,
      });
    }
  }

  // Research validation: every capture creates understanding facets (not note-created).
  if (
    turnClass !== "record_question" &&
    turnClass !== "empty_or_thin" &&
    turnClass !== "emotional_only" &&
    !pushback
  ) {
    const mental = composeMentalLoadCaptureLines({
      observationCount: situation.observations.length,
      hasPriorConnection: !isNewCareReality,
      openUnknowns: still_unclear,
      whatChangedHeld: what_changed,
      isDocument: turnClass === "document" || Boolean(params.hasDocuments),
    });
    if (!what_changed && mental.what_changed) {
      what_changed = isNewCareReality
        ? composeMemoryAwareWhatChanged({ state: careMemoryState })
        : mental.what_changed;
    }
    if (
      !isNewCareReality &&
      mental.connected_line &&
      what_we_know.length < 3 &&
      !what_we_know.some((l) => /connected|already held/i.test(l))
    ) {
      what_we_know = [...what_we_know, mental.connected_line].slice(0, 3);
    }
  }

  const why_asking =
    facets.show_why_asking && still_unclear.length > 0
      ? composeWhyAsking({
          subjectLabel: situation.subject_label,
          signals: heldSignals,
        })
      : null;

  const supportingFacts = plainHeldFacts(
    [
      ...extractionSurfaceLines,
      ...crsSupportingFacts(crsCtx.supportingEvidence, 3),
      ...priorObservationFacts.filter(
        (f) => !isNearRawCaregiverFacet(f, latestRawText),
      ),
      ...crsCtx.heldUnderstanding,
    ].filter((f) => isCareRealityAnchorText(f) && !isNearRawCaregiverFacet(f, latestRawText)),
    3,
  );
  const openUncertainties = scrubList(
    [
      ...(crsCtx.usesCrsAsSource ? crsCtx.openUncertainties : []),
      ...situation.open_questions,
      ...still_unclear,
    ],
    2,
    false,
  );
  const revisionSummaries =
    crsCtx.understandingRevisions.length > 0
      ? crsCtx.understandingRevisions
          .map((r) => r.summary.trim())
          .filter(Boolean)
          .slice(-3)
      : facets.evidence_maturity >= 10
        ? (crs?.understanding_revisions ?? [])
            .map((r) => r.summary.trim())
            .filter(Boolean)
            .slice(-3)
        : [];

  let evidence_line = facets.show_evidence_line
    ? composeEvidenceLine({
        hasDocuments: params.hasDocuments,
        maturity: facets.evidence_maturity,
        supportingFacts,
        openUncertainties,
        revisionSummaries,
        latestRawText,
      })
    : null;

  // G13 — record questions answer from decision memory, never Clarity form
  if (turnClass === "record_question") {
    const decisionCareKey =
      situation.care_recipient_id ?? situation.caregiver_id;
    const answered = answerRecordQuestion({
      careKey: decisionCareKey,
      question: latestRawText,
      priorObservationTexts: situation.observations.map((o) => o.raw_text),
    });
    if (answered.lines.length > 0) {
      what_we_know = answered.lines.slice(0, 3);
    }
    if (answered.evidence_line) {
      evidence_line = answered.evidence_line;
    }
    if (answered.note && !what_changed) {
      what_changed = answered.note;
    }
    still_unclear = answered.reason_unknown
      ? ["Why this path was chosen is not held yet."]
      : [];
    what_matters_now = null;
    what_can_wait = null;
    what_may_become_serious = null;
  }

  // Decision preparation (continuity symptom / guidance) — never recommendation.
  if (continuitySymptom) {
    const decisionCareKey =
      situation.care_recipient_id ?? situation.caregiver_id;
    const prep = composeDecisionPreparation({
      careKey: decisionCareKey,
      maxLines: 2,
    });
    if (prep.has_decisions && prep.lines.length > 0) {
      const merged = [...prep.lines, ...what_we_know];
      what_we_know = [...new Set(merged)].slice(0, 3);
    }
    if (prep.open_unknowns.length > 0 && still_unclear.length === 0) {
      still_unclear = prep.open_unknowns.slice(0, 1);
    }
    if (!what_changed) {
      what_changed =
        "Oriented from held care reality — preparation for your next conversation, not advice.";
    }
  }

  // Output quality: surface decision memory (why) when held — not only on keyword turns.
  if (
    turnClass !== "empty_or_thin" &&
    turnClass !== "pushback" &&
    !gatheringContext
  ) {
    const decisionCareKey =
      situation.care_recipient_id ?? situation.caregiver_id;
    const recentDecisions = listDecisionMemory(decisionCareKey).slice(-1);
    const decisionInTurn =
      recentDecisions.length > 0 &&
      (looksLikeDecisionEvidence(latestRawText) ||
        continuitySymptom ||
        recentDecisions.some((d) =>
          latestRawText.toLowerCase().includes(d.what.toLowerCase().slice(0, 24)),
        ));
    if (decisionInTurn) {
      const d = recentDecisions[0]!;
      const decisionLines = formatDecisionMemoryForCaregiver({
        what: d.what,
        reason: d.reason,
        who: d.who,
        outcome: d.outcome,
        status: d.status,
      });
      if (decisionLines.length > 0 && facets.show_what_we_know) {
        what_we_know = [...new Set([...decisionLines.slice(0, 2), ...what_we_know])].slice(
          0,
          3,
        );
      }
      if (!d.reason && still_unclear.length === 0 && facets.show_asks) {
        still_unclear = ["Why this path was chosen is not held yet."];
      }
    }
  }

  // Output quality: connections — prior story (returning) + extraction relationships (plain language).
  let connection_note: string | null = null;
  // Situation Generator possible links — fold into what_changed on first capture
  // (connection_note is reserved for returning continuity; gate rejects it on new care reality)
  if (modelOrientation.connected_note) {
    const link = scrub(modelOrientation.connected_note);
    if (isNewCareReality) {
      if (what_changed && !/medication|related|around the same/i.test(what_changed)) {
        what_changed = `${what_changed.replace(/\.$/, "")}. ${link}`;
      } else if (!what_changed) {
        what_changed = link;
      } else if (link && !what_changed.includes(link.slice(0, 40))) {
        what_changed = `${what_changed.replace(/\.$/, "")}. ${link}`;
      }
    } else {
      connection_note = link;
    }
  }
  if (!isNewCareReality && turnClass !== "empty_or_thin" && turnClass !== "pushback") {
    const priorObs = [...situation.observations].slice(0, -1).reverse();
    // Connection priors from extraction surfaces — never human_fact ≈ raw blobs.
    let priorFact: string | null = null;
    for (const o of priorObs) {
      const fromPrior = caregiverFacingLinesFromCaptureText({
        rawText: o.raw_text || o.human_fact || "",
        max: 1,
        includeEvents: true,
        includeActions: true,
      });
      if (fromPrior[0] && !isNearRawCaregiverFacet(fromPrior[0], o.raw_text)) {
        priorFact = fromPrior[0]!;
        break;
      }
    }
    const latestFact =
      extractionFocusLine ??
      caregiverFacingLinesFromCaptureText({
        rawText: latestRawText,
        max: 1,
      })[0] ??
      null;
    connection_note = composeConnectionLine({
      isNewCareReality,
      priorFact,
      latestFact,
      observationCount: careWorthyCount,
    });
    // Defensive: never ship parenthetical prior paste from any path.
    if (
      connection_note &&
      /this connects to what was already held\s*\(/i.test(connection_note)
    ) {
      connection_note =
        "This connects to what was already held — not a separate story.";
    }
    if (connection_note && containsFakeContinuity(connection_note) && isNewCareReality) {
      connection_note = null;
    }
  }
  if (
    extraction &&
    extraction.relationships.length > 0 &&
    turnClass !== "empty_or_thin" &&
    turnClass !== "pushback"
  ) {
    const fromRels = composeCaregiverConnectionFromRelationships({
      relationships: extraction.relationships,
      observations: extraction.observations,
      events: extraction.events,
      decisions: extraction.decisions,
      isNewCareReality,
    });
    if (fromRels && !containsFakeContinuity(fromRels)) {
      if (isNewCareReality) {
        // First capture: relationships answer "what connects?" via what_changed —
        // never connection_note (that is prior-story continuity; gate rejects it).
        if (!what_changed) what_changed = fromRels;
      } else {
        connection_note = connection_note ?? fromRels;
      }
    }
  }
  if (!what_changed && connection_note) {
    what_changed = connection_note;
  }

  const show_connection =
    Boolean(connection_note?.trim()) && connection_note !== what_changed;


if (show_clarity && !pushback && what_matters_now) {
    what_matters_now = buildMattersNowOrientation({
      subjectLabel: named,
      heldFocus: heldFocusLines(situation, 1)[0] ?? null,
      baselineChange: baselineChangeNote,
      topUnknown: null,
      patternContinues: careWorthyCount >= 3,
    });
  }

  // Release-blocking relief default (Response Contract "What can wait" pillar):
  // Orientable Clarity must always relieve pressure with a "what can wait" line.
  // Improvement turns set matters_now but skip the projection path (understandingCanPrioritize
  // is false when improvement), leaving can_wait null → acceptance gate would throw and blank
  // the panel. Provide a genuine relief default — never blank Clarity, never a new ask.
  if (show_clarity && !pushback && !what_can_wait) {
    what_can_wait = improvement
      ? "Explaining every detail of the earlier concern tonight."
      : "Explaining every detail or deciding everything for the week tonight.";
  }
  // Hidden-blocker relief default: Clarity also demands what_matters_now (acceptance gate).
  // Some orientable turns (guidance / confidence-low / projection-off) leave matters_now null
  // while show_clarity is true → gate throws "Clarity without what_matters_now rejected".
  // Anchor matters from what the caregiver can act on — evidence-held focus, never a new ask.
  if (
    show_clarity &&
    !pushback &&
    !what_matters_now &&
    heldFocusLines(situation, 1)[0]
  ) {
    what_matters_now = buildMattersNowOrientation({
      subjectLabel: named,
      heldFocus: heldFocusLines(situation, 1)[0] ?? null,
      baselineChange: baselineChangeNote,
      topUnknown: still_unclear[0] ?? null,
      patternContinues: careWorthyCount >= 3,
    });
    if (!what_matters_now) {
      what_matters_now = improvement
        ? "Noticing whether today's change holds."
        : "Understanding what is changing for the person receiving care.";
    }
  }

  // After asks settle: rebuild situation summary with structural unknowns (not the ask text).
  if (show_clarity && facets.show_what_is_happening) {
    const structuralUnknowns = careContextGapsRemain({ situation })
      ? ["whether this differs from usual, and when it started"]
      : [];
    const layered = buildSituationUnderstandingSummary({
      heldFacts: heldFocusLines(situation, 2),
      whatChanged: what_changed,
      isGathering: false,
      openUnknowns: structuralUnknowns,
    });
    if (layered) situation_summary = layered;
  }

  // G16 — perspective attribution when views differ (not a chat feed).
  // Only attach to evidence at maturity ≥ 2 (related+) — never overwrite L1 source-only.
  if (turnClass !== "record_question") {
    const perspectives = composePerspectiveAttribution({
      situation,
      patternLabel: turn.pattern_label,
    });
    if (perspectives.show) {
      if (
        perspectives.evidence_line &&
        facets.show_evidence_line &&
        facets.evidence_maturity >= 2
      ) {
        evidence_line = perspectives.evidence_line;
      }
      if (
        facets.show_what_we_know &&
        perspectives.what_we_know_extra.length >= 2 &&
        what_we_know.length === 0
      ) {
        what_we_know = perspectives.what_we_know_extra.slice(0, 2);
      }
    }
  }

  const follow_up_items: string[] = [];
  if (facets.show_follow_up) {
    if (continuitySymptom) {
      follow_up_items.push("Add anything else that changed alongside this");
    } else if (show_clarity) {
      const decisionCareKey =
        situation.care_recipient_id ?? situation.caregiver_id;
      const recent = listDecisionMemory(decisionCareKey).slice(-1)[0];
      follow_up_items.push(
        ...composeReliefFollowUps({
          heldFocus: heldFocusLines(situation, 1)[0] ?? null,
          topUnknown: still_unclear[0] ?? null,
          decisionWhyUnknown: Boolean(recent && !recent.reason),
          max: 2,
          latestRawText,
        }),
      );
    }
  }

  // Fold Care Situation Understanding continuity into follow-ups / connection (after locals exist).
  if (
    careOrientation &&
    careUnderstanding.can_orient &&
    !pushback &&
    !improvement &&
    turnClass !== "record_question"
  ) {
    // connection_note is reserved for returning continuity — fold links into what_changed on first capture
    if (careOrientation.connection_note) {
      if (isNewCareReality) {
        const link = scrub(careOrientation.connection_note);
        if (link) {
          if (what_changed && !what_changed.includes(link.slice(0, 40))) {
            what_changed = `${what_changed.replace(/\.$/, "")}. ${link}`;
          } else if (!what_changed) {
            what_changed = link;
          }
        }
      } else if (!connection_note) {
        connection_note = scrub(careOrientation.connection_note);
      }
    }
    if (careOrientation.follow_up_items.length > 0 && facets.show_follow_up) {
      follow_up_items.unshift(
        ...careOrientation.follow_up_items
          .map((f) => scrub(f) ?? f)
          .filter((f): f is string => Boolean(f)),
      );
    }
  }

  // Architecture 2B — Initial Assessment: never claim change without comparable prior.
  // Returning Care Reality (prior ACS observations, CRS depth, or has_comparable_prior)
  // must not be overwritten with Initial Assessment copy.
  if (
    situationModel.baseline_comparison.mode === "initial_assessment" &&
    !situationModel.baseline_comparison.has_comparable_prior &&
    !priorHeldReality &&
    !(crsCtx.usesCrsAsSource && crsCtx.heldUnderstanding.length > 0)
  ) {
    if (what_changed && containsHallucinatedChangeLanguage(what_changed)) {
      what_changed = null;
    }
    if (situation_summary && containsHallucinatedChangeLanguage(situation_summary)) {
      situation_summary = modelOrientation.current_understanding
        ? scrub(modelOrientation.current_understanding)
        : situation_summary;
    }
    if (
      modelOrientation.current_understanding &&
      facets.show_what_is_happening &&
      !gatheringContext
    ) {
      situation_summary = scrub(modelOrientation.current_understanding);
    }
    if (
      facets.show_asks &&
      !pushback &&
      modelOrientation.one_thing_to_add &&
      still_unclear.length === 0
    ) {
      still_unclear = [modelOrientation.one_thing_to_add].slice(0, 1);
    }
  }

  if (
    situationModel.generated_situation?.is_rich_situation &&
    facets.show_asks &&
    !pushback
  ) {
    const asks = [
      ...(modelOrientation.one_thing_to_add ? [modelOrientation.one_thing_to_add] : []),
      ...modelOrientation.still_unclear,
    ].filter((q, i, arr) => arr.indexOf(q) === i);
    // Only caregiver-facing asks reach the panel
    const facing = asks.filter((q) =>
      /^(when|what|whether|who|how|before|has anything)/i.test(q.trim()) ||
      /medication changed|reason for the change|normal day/i.test(q),
    );
    if (facing.length > 0) {
      still_unclear = facing.slice(0, Math.min(3, facets.max_asks || 3));
    }
    if (
      modelOrientation.current_understanding &&
      facets.show_what_is_happening &&
      !gatheringContext
    ) {
      situation_summary = scrub(modelOrientation.current_understanding);
    }
    if (modelOrientation.what_changed && !gatheringContext && !what_changed) {
      what_changed = scrub(modelOrientation.what_changed);
    }
  }

  // Final Observation-layer guard — disagreement/load never become caregiver "known."
  what_we_know = preferCareSituationFacts(
    what_we_know.filter(
      (line) =>
        !looksLikeDisagreementPerspectiveLine(line) &&
        !looksLikeCaregiverExperienceOnly(line) &&
        !isNonObservationFocusLine(line) &&
        !isNearRawCaregiverFacet(line, latestRawText),
    ),
  ).slice(0, Math.max(factCap, 3));
  if (what_changed && looksLikeDisagreementPerspectiveLine(what_changed)) {
    what_changed = modelOrientation.what_changed
      ? scrub(modelOrientation.what_changed)
      : null;
    if (what_changed && looksLikeDisagreementPerspectiveLine(what_changed)) {
      what_changed = null;
    }
  }
  if (
    situation_summary &&
    looksLikeDisagreementPerspectiveLine(situation_summary)
  ) {
    situation_summary = modelOrientation.current_understanding
      ? scrub(modelOrientation.current_understanding)
      : situation_summary;
  }
  if (
    what_matters_now &&
    looksLikeDisagreementPerspectiveLine(what_matters_now)
  ) {
    what_matters_now =
      heldFocusLines(situation, 1)[0]?.replace(/\.$/, "") ??
      "Understanding what is changing for the person receiving care.";
}

// Improvement updates (Locked B): related outcome — never quiz or scare.
  // Later model/rich-situation asks must not re-open still_unclear.
  if (improvement) {
    what_may_become_serious = null;
    still_unclear = [];
  }

  // Phase 4: Response Contract = Projection of Understanding (PRIMARY).
const heldEvidenceTexts = situation.observations
    .map((o) =>
      observationCareFact({ human_fact: o.human_fact, raw_text: o.raw_text }),
    )
    .filter((f): f is string => Boolean(f));
  const riskFromEvidence = inferRiskFromHeldCareEvidence({
    heldTexts: heldEvidenceTexts,
    latestRawText,
  });
  const intelligence = careProjection && !pushback && !improvement && turnClass !== "record_question"
    ? buildResponseIntelligenceOutput({
        what_is_happening: careProjection.what_is_happening,
        what_matters_now: show_clarity ? careProjection.what_matters_now : null,
        what_to_ask_next: careProjection.what_to_ask_next,
        what_can_wait: show_clarity ? careProjection.what_can_wait : null,
        follow_up_items: careProjection.follow_up_items,
        risk_level: careProjection.risk_level,
        observation_count: situation.observations.length,
        has_open_unknowns: still_unclear.length > 0,
        has_meaningful_change: Boolean(what_changed) && situation.observations.length > 1,
      })
    : buildResponseIntelligenceOutput({
        what_is_happening: situation_summary ?? what_we_know[0] ?? null,
        what_matters_now: show_clarity ? what_matters_now : null,
        what_to_ask_next: still_unclear,
what_can_wait: show_clarity ? what_can_wait : null,
        follow_up_items,
        risk_level: riskFromEvidence,
        observation_count: situation.observations.length,
        has_open_unknowns: still_unclear.length > 0,
        has_meaningful_change: Boolean(what_changed) && situation.observations.length > 1,
      });

  const decisionCareKeyForStory =
    situation.care_recipient_id ?? situation.caregiver_id;
  const latestDecision = listDecisionMemory(decisionCareKeyForStory).slice(-1)[0];

  const care_story_update =
    turnClass === "empty_or_thin" ||
    turnClass === "pushback" ||
    !hasCareEvidence ||
    !latestIsCareWorthy
      ? null
      : scrub(
          composeCareStoryUpdate({
            isNewCareReality,
            subjectLabel: named,
            heldFocus: heldFocusLines(situation, 1)[0] ?? null,
            whatChanged: what_changed,
            decisionWhat: looksLikeDecisionEvidence(latestRawText)
              ? latestDecision?.what ?? null
              : null,
            openUnknownCount: still_unclear.length,
          }),
        );

  // Final ask filter — extraction/engine unknowns must not leak as caregiver interview chrome.
  still_unclear = still_unclear.filter(isCaregiverFacingAsk).slice(0, 3);

  // Re-apply clinical profile asks after rich-situation overwrite (dementia entry influence).
  if (!improvement && facets.show_asks && profileInfluenceAsks.length > 0) {
    still_unclear = filterSessionUncertaintyAsks({
      asks: [...profileInfluenceAsks, ...still_unclear],
      askedQuestions: situation.asked_questions,
      resolvedUncertainties: [
        ...turn.resolved_uncertainties,
        ...(crs?.resolved_uncertainties ?? []),
      ],
      situation,
      currentTurnAsks: turn.what_needs_context,
    })
      .filter(isCaregiverFacingAsk)
      .slice(0, capacity.overload_likely ? capacity.max_asks : Math.min(3, facets.max_asks || 3));
  }

  // Final paste scrub — connection / evidence / follow-ups / what_changed must not dump raw notes.
  const scrubPasteField = (text: string | null): string | null => {
    if (!text?.trim()) return null;
    if (
      containsRawNoteEchoInCopy({
        blob: text,
        latestRawText,
      })
    ) {
      return null;
    }
    if (/this connects to what was already held\s*\(/i.test(text)) {
      return "This connects to what was already held — not a separate story.";
    }
    if (/notice whether\s*[“"'][^“"']{20,}[”"']/i.test(text)) {
      return "Notice whether this continues and what else connects";
    }
return text;
  };

  // Scrub each field — never dump raw notes into caregiver-facing fields.
connection_note = scrubPasteField(connection_note);
  evidence_line = scrubPasteField(evidence_line);
  what_changed = scrubPasteField(what_changed);
  recognition_line = scrubPasteField(recognition_line);
  what_matters_now = scrubPasteField(what_matters_now);

  // Final relief guarantee (release-blocking): the paste-scrub above can null a valid
  // what_matters_now (it flags any line that echoes the raw note). Orientable Clarity must
  // never render with a blank "what matters now" — the acceptance gate would throw and blank
  // the whole panel. Anchor from what the caregiver can act on, never a new ask, never echo.
  if (show_clarity && !pushback && !what_matters_now) {
    const heldFocus = heldFocusLines(situation, 1)[0] ?? null;
    const oriented = heldFocus
      ? buildMattersNowOrientation({
          subjectLabel: named,
          heldFocus,
          baselineChange: baselineChangeNote,
          topUnknown: still_unclear[0] ?? null,
          patternContinues: careWorthyCount >= 3,
        })
      : null;
    what_matters_now = oriented ?? (
      improvement
        ? "Noticing whether today's change holds."
        : "Understanding what is changing for the person receiving care."
    );
  }

  // Profile matters hint applies only when understanding projection did NOT fill what_matters_now.
  // Dementia-entry nutrition/sleep safety gaps are secondary biases, never primary.
  if (
    !improvement &&
    show_clarity &&
    !pushback &&
    !understandingCanPrioritize &&
    profileOpenCategories.length > 0 &&
    (!what_matters_now ||
      containsWeakOrientation(what_matters_now) ||
      /how (?:this|these concerns) sit/i.test(what_matters_now))
  ) {
    const profileMattersLate = caregiverMattersHintFromClinicalProfile({
      openCategories: profileOpenCategories,
      heldFocus: heldFocusLines(situation, 1)[0] ?? null,
      latestRawText,
    });
    if (profileMattersLate) what_matters_now = profileMattersLate;
  }
  for (let i = 0; i < follow_up_items.length; i++) {
    const scrubbed = scrubPasteField(follow_up_items[i]!);
    follow_up_items[i] = scrubbed ?? "Notice whether this continues and what else connects";
  }
  // Drop follow-ups that still quote near-raw focus after scrub.
  const cleanedFollowUps = follow_up_items.filter(
    (item) =>
      !/notice whether\s*[“"']/i.test(item) ||
      !isNearRawCaregiverFacet(
        item.replace(/^notice whether\s*[“"']|[”"'].*$/gi, "").trim(),
        latestRawText,
      ),
  );
  follow_up_items.length = 0;
  follow_up_items.push(...cleanedFollowUps.slice(0, 2));

  const composed: ComposedCaregiverResponse = {
    recognition_line,
    confirmation,
    what_matters_now,
    what_can_wait,
    what_may_become_serious,
    what_changed,
    connection_note,
    show_connection,
    what_we_know,
    situation_summary,
    still_unclear,
    care_story_update,
    is_improvement: improvement,
    show_clarity,
    show_questions: still_unclear.length > 0,
    why_asking,
    evidence_line,
    evidence_maturity: facets.evidence_maturity,
    follow_up_items,
    contract_output: intelligence,
    mental_load_signal: (() => {
      const openGaps = still_unclear.length;
      const caregiverLoad =
        /a lot is unsettled|weight of keeping/i.test(recognition_line ?? "");
      if (caregiverLoad || openGaps >= 3) {
        return "Several things need attention at once — nothing has to be solved tonight.";
      }
      if (openGaps >= 2) {
        return "A few pieces are still missing — the most important one is enough for now.";
      }
      if (openGaps === 1) {
        return "One question is still open — it can wait until you have the answer.";
      }
      return null;
    })(),
  };

  assertComposedResponseProfessional(composed);
  if (
    centersContributorConflictOverRecipient({
      blob: [
        composed.situation_summary ?? "",
        composed.what_changed ?? "",
        composed.what_matters_now ?? "",
        ...(composed.what_we_know ?? []),
      ].join(" "),
      careRecipient: situationModel.care_recipient_anchor.care_recipient,
      hasRecipientChanges:
        situationModel.care_recipient_anchor.recipient_changes.length > 0,
    })
  ) {
    throw new Error(
      "Response acceptance: family disagreement centered over care recipient — rejected",
    );
  }
  if (
    situationModel.baseline_comparison.mode === "initial_assessment" &&
    !situationModel.baseline_comparison.has_comparable_prior &&
    containsHallucinatedChangeLanguage(
      [
        composed.situation_summary ?? "",
        composed.what_changed ?? "",
        composed.what_matters_now ?? "",
        ...(composed.what_we_know ?? []),
      ].join(" "),
    )
  ) {
    throw new Error(
      "Response acceptance: hallucinated change without comparable prior — rejected",
    );
  }
  if (
    containsSituationSummaryTheater(
      [
        composed.situation_summary ?? "",
        composed.what_changed ?? "",
        composed.what_matters_now ?? "",
        ...(composed.what_we_know ?? []),
      ].join(" "),
    )
  ) {
    throw new Error(
      "Response acceptance: situation summary theater (echo/tasks/diagnosis) — rejected",
    );
  }
  assertIntelligenceValidation({
    composed,
    latestRawText,
    careRecipient: situationModel.care_recipient_anchor.care_recipient,
    isRichCareCapture: situationModel.generated_situation?.is_rich_situation,
    hasComparablePrior: situationModel.baseline_comparison.has_comparable_prior,
    isInitialAssessment:
      situationModel.baseline_comparison.mode === "initial_assessment",
    hasRecipientChanges:
      situationModel.care_recipient_anchor.recipient_changes.length > 0 ||
      (situationModel.generated_situation?.observed_changes.length ?? 0) > 0,
  });
  assertUncertaintyPreservation({
    responseBlob: [
      composed.recognition_line ?? "",
      composed.confirmation,
      composed.situation_summary ?? "",
      ...(composed.what_we_know ?? []),
      composed.connection_note ?? "",
      composed.what_changed ?? "",
      composed.what_matters_now ?? "",
      ...(composed.still_unclear ?? []),
      composed.care_story_update ?? "",
    ].join("\n"),
    model: situationModel.generated_situation?.uncertainty_preservation ?? null,
  });
  assertUnknownPreservation({
    responseBlob: [
      composed.recognition_line ?? "",
      composed.confirmation,
      composed.situation_summary ?? "",
      ...(composed.what_we_know ?? []),
      composed.connection_note ?? "",
      composed.what_changed ?? "",
      composed.what_matters_now ?? "",
      ...(composed.still_unclear ?? []),
      composed.care_story_update ?? "",
    ].join("\n"),
    unknowns: situationModel.extraction?.unknowns,
  });
  assertCaregiverUnderstandingTest({
    composed,
    latestRawText,
    careRecipient: situationModel.care_recipient_anchor.care_recipient,
    isRichCareCapture: situationModel.generated_situation?.is_rich_situation,
    hasRecipientChanges:
      situationModel.care_recipient_anchor.recipient_changes.length > 0 ||
      (situationModel.generated_situation?.observed_changes.length ?? 0) > 0,
  });
  assertResponseAcceptanceGate({
    composed,
    careMemoryState,
    observationCount: situation.observations.length,
    careWorthyCount,
    latestIsCareWorthy,
    latestRawText,
    turnClass,
  });

  // Slice 5.5 / ADR-025 — optional G61 after acceptance.
  // Dev: throw on fail. Prod (flagged): log only. Never blocks capture (ingest already done).
  applyRealCaregiverTestComposeGate({ composed, turnClass });

  if (peekFeedbackContainmentAdaptation(resolveCareRealityStoreKey(crsKey)).active) {
    consumeFeedbackContainment(crsKey);
  }

  return composed;
}

/** Verify a composed response does not contain banned caregiver phrasing. */
export function assertComposedResponseProfessional(
  composed: ComposedCaregiverResponse,
): void {
  const blob = [
    composed.recognition_line ?? "",
    composed.confirmation,
    composed.what_matters_now ?? "",
    composed.what_can_wait ?? "",
    composed.what_may_become_serious ?? "",
    composed.what_changed ?? "",
    composed.connection_note ?? "",
    composed.situation_summary ?? "",
    composed.care_story_update ?? "",
    composed.why_asking ?? "",
    composed.evidence_line ?? "",
    ...composed.what_we_know,
    ...composed.still_unclear,
    ...composed.follow_up_items,
  ].join("\n");

  for (const phrase of CAREGIVER_RESPONSE_BANNED_PHRASES) {
    if (blob.toLowerCase().includes(phrase.toLowerCase())) {
      throw new Error(`Caregiver response banned phrase: ${phrase}`);
    }
  }
if (containsInternalLanguage(blob)) {
    const diagMatch = INTERNAL_LANGUAGE_BANS.filter((p) =>
      blob.toLowerCase().includes(p.toLowerCase()),
    );
    throw new Error(
      `Caregiver response contains internal architecture language: ${JSON.stringify(diagMatch)} :: ${blob.slice(0, 400)}`,
    );
  }
  assertNoAiProductLanguage(
    [
      composed.confirmation,
      composed.what_matters_now,
      composed.what_can_wait,
      composed.what_changed,
      composed.situation_summary,
      composed.evidence_line,
      ...composed.what_we_know,
      ...composed.still_unclear,
    ],
    "composed caregiver response",
  );
  assertNoResponseContractNeverSay(
    [
      composed.confirmation,
      composed.what_matters_now,
      composed.what_can_wait,
      composed.what_changed,
      composed.situation_summary,
      ...composed.what_we_know,
      ...composed.still_unclear,
      ...composed.follow_up_items,
    ],
    "composed caregiver response",
  );
  if (composed.is_improvement && composed.what_may_become_serious) {
    throw new Error("Improvement updates must not show what may become serious");
  }
  if (composed.is_improvement && composed.still_unclear.length > 0) {
    throw new Error("Improvement updates must not quiz the caregiver");
  }
  if (composed.still_unclear.length > 3) {
    throw new Error("At most three clarifying asks");
  }
  for (const q of composed.still_unclear) {
    if (!isCaregiverFacingAsk(q)) {
      throw new Error(`Non-caregiver-facing ask reached caregiver: ${q}`);
    }
  }
  if (!composed.show_clarity) {
    if (composed.what_matters_now || composed.what_can_wait || composed.what_may_become_serious) {
      throw new Error("Clarity fields must be null when show_clarity is false");
    }
  }
}

export {
  resolveCrsComposeContext,
  crsSupportingFacts,
  type CrsComposeContext,
} from "./crs-compose-sot";
