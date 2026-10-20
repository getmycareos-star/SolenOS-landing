import type { CareEventKind } from "../living-care-record-ux/event-clarifiers";
import {
  buildCareClarityPillars,
  heldFocusLines,
} from "../progressive-understanding/clarity-pillars";
import { understandingSufficient } from "../progressive-understanding/questions";
import { buildMattersNowOrientation } from "../output-quality";
import { processProgressiveUnderstanding } from "../progressive-understanding";
import { reconcileOpenUncertainties } from "../progressive-understanding/uncertainty-lifecycle";
import {
  buildDisclosurePlan,
  clearCareRealityState,
  getCareRealityState,
  primaryScreenQuestionFor,
  resetCareRealityStateStore,
  updateCareRealityState,
  type CareRealityState,
  type ResponseEvolutionEvaluation,
} from "../care-reality-state";
import {
  classifySituationRelation,
  isHardEventKind,
  refineHumanFact,
  situationThemeFor,
} from "./classify";
import {
  evaluateSituationRelationship,
  findReinforcementTargetObservation,
  composeIdentityMismatchAsk,
} from "../situation-relationship-engine";
import { resolveSubjectLabel } from "../care-recipient-identity";
import {
  classifyEpistemicClaim,
  evaluateCaregiverMissedCare,
  evaluateChangeVsCrisis,
  evaluateContinuityWorry,
  evaluateDayFluctuation,
  evaluateDisagreeingViews,
  evaluateGradualChange,
  evaluateNaturalLanguageObservation,
  evaluatePersonhoodLifeChange,
  evaluatePreferenceRecall,
  evaluateSafetyContinuity,
  evaluateUnknownCauseChange,
  familiarityDeviationNote,
  listFamiliarityBaseline,
  recordDailyLivingSignal,
  recordFamiliarityFromText,
} from "../care-epistemics";
import { caregiverFacingFragmentText } from "../thread-ingestion/detect";
import { evaluateSourceConflict, recordSourceClaim, sourcePriorityRank } from "../source-conflict";
import {
  linkDecisionOutcome,
  recordDecisionFromText,
  looksLikeDecisionEvidence,
} from "../decision-memory";
import { extractCareRealityFromText } from "../care-reality-extraction";
import { clearSoftInviteWhenUncertaintyGone } from "../return-continuity";
import {
  evaluateAmbiguousBehaviorShift,
  evaluateAdvancedCareSensitivity,
  evaluateCaregiverRoleTransition,
  evaluateCareTransition,
  evaluateHistoricalImportance,
  evaluateJourneyMilestone,
  evaluateNormalcyUncertainty,
  evaluateRepeatedQuestionPattern,
  evaluateRoutineDisruption,
  evaluateSituationBehindFact,
} from "../dementia-entry-extended";
import {
  detectObservationSignals,
  isImprovementUpdate,
} from "../progressive-understanding/detect-signals";
import type {
  ActiveCareSituation,
  ActiveSituationTurn,
  SituationObservation,
  SituationRelation,
} from "./types";
import type { SituationRelationshipDecision } from "../situation-relationship-engine";
import {
  acsCache,
  clearActiveCareSituationMemoryCache,
  deleteActiveCareSituationDurable,
  loadActiveCareSituationFromDurable,
  persistActiveCareSituationToDurable,
  resetActiveCareSituationDurableStore,
} from "./durable-store";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";
import { applyReliefFieldsToDisclosurePlan } from "../response-contract/disclosure-merge";
import {
  classifyCaregiverTurn,
  resolveReliefDecisionForTurn,
} from "../response-behavior";
import { recordMemoryCorrection } from "../care-reality-engine/memory-correction";
import {
  extractCorrectedClaimFromCorrection,
  findCorrectionTargetObservation,
  looksLikeExplicitMemoryCorrection,
} from "../care-reality-engine/detect-memory-correction";

export function resetActiveCareSituationStore(): void {
  resetActiveCareSituationDurableStore();
  resetCareRealityStateStore();
}

function realityKey(contributorOrRealityId: string): string {
  return resolveCareRealityStoreKey(contributorOrRealityId);
}

export function getActiveCareSituation(contributorId: string): ActiveCareSituation | null {
  const careRecipientId = realityKey(contributorId);
  const cached = acsCache().get(careRecipientId);
  if (cached) return cached;

  let durable = loadActiveCareSituationFromDurable(careRecipientId);
  if (!durable && careRecipientId !== contributorId) {
    durable = loadActiveCareSituationFromDurable(contributorId);
  }
  if (!durable) return null;

  const normalized: ActiveCareSituation = {
    ...durable,
    care_recipient_id: durable.care_recipient_id ?? careRecipientId,
  };
  acsCache().set(careRecipientId, normalized);
  if (!durable.care_recipient_id) {
    persistActiveCareSituationToDurable(normalized);
  }
  return normalized;
}

/**
 * Test / hard-reset only — deletes ACS + CRS for a care key.
 * Never call from Done for now (solenos-done-for-now-continuity Locked A).
 */
export function clearActiveCareSituation(contributorId: string): void {
  const careRecipientId = realityKey(contributorId);
  acsCache().delete(careRecipientId);
  deleteActiveCareSituationDurable(careRecipientId);
  if (careRecipientId !== contributorId) {
    acsCache().delete(contributorId);
    deleteActiveCareSituationDurable(contributorId);
  }
  clearCareRealityState(careRecipientId);
  if (careRecipientId !== contributorId) {
    clearCareRealityState(contributorId);
  }
}

/**
 * Done for now — pause interaction session only.
 * Persists ACS + CRS unchanged. Does not resolve or quiet the care situation —
 * lifecycle is engine/evidence-owned (solenos-done-for-now-continuity Locked A).
 */
export function pauseActiveCareSituationSession(
  contributorId: string,
): ActiveCareSituation | null {
  const current = getActiveCareSituation(contributorId);
  if (!current) return null;
  const careRecipientId = current.care_recipient_id ?? realityKey(contributorId);
  const paused: ActiveCareSituation = {
    ...current,
    care_recipient_id: careRecipientId,
    interaction_paused_at: new Date().toISOString(),
  };
  acsCache().set(careRecipientId, paused);
  persistActiveCareSituationToDurable(paused);
  return paused;
}

/** Clear interaction pause when caregiver adds a new note — does not mutate lifecycle. */
export function resumeActiveCareSituationSession(contributorId: string): void {
  const current = getActiveCareSituation(contributorId);
  if (!current?.interaction_paused_at) return;
  const careRecipientId = current.care_recipient_id ?? realityKey(contributorId);
  const resumed: ActiveCareSituation = {
    ...current,
    care_recipient_id: careRecipientId,
    interaction_paused_at: null,
  };
  acsCache().set(careRecipientId, resumed);
  persistActiveCareSituationToDurable(resumed);
}

const EMPTY_RESPONSE_EVOLUTION: ResponseEvolutionEvaluation = {
  updates_active_situation: false,
  answers_previous_uncertainty: false,
  strengthens_existing_hypothesis: false,
  introduces_new_pattern: false,
  changes_what_matters_now: false,
  invalidates_previous_understanding: false,
};

function attachCareRealityFields(
  base: Omit<
    ActiveSituationTurn,
    | "care_reality_state_id"
    | "crs_observation_count"
    | "crs_revision"
    | "disclosure_stage"
    | "disclosure_plan"
    | "response_evolution"
    | "primary_screen_question"
  >,
  crs: CareRealityState | null,
): ActiveSituationTurn {
  if (crs) {
    const disclosure_plan = buildDisclosurePlan(crs.disclosure_stage);
    return {
      ...base,
      // Disclosure owns ask count — never dump the full open-question queue.
      what_needs_context: base.what_needs_context.slice(0, disclosure_plan.max_questions),
      care_reality_state_id: crs.id,
      crs_observation_count: crs.observation_count,
      crs_revision: crs.revision,
      disclosure_stage: crs.disclosure_stage,
      disclosure_plan,
      response_evolution: crs.response_evolution,
      primary_screen_question: crs.primary_screen_question,
    };
  }
  const disclosure_stage = "early" as const;
  const obs = base.situation.observations.length;
  const disclosure_plan = buildDisclosurePlan(disclosure_stage);
  return {
    ...base,
    what_needs_context: base.what_needs_context.slice(0, disclosure_plan.max_questions),
    care_reality_state_id: null,
    crs_observation_count: obs,
    crs_revision: Math.max(1, obs),
    disclosure_stage,
    disclosure_plan,
    response_evolution: EMPTY_RESPONSE_EVOLUTION,
    primary_screen_question: primaryScreenQuestionFor(disclosure_stage),
  };
}

export { clearActiveCareSituationMemoryCache };

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function dedupeUncertaintyLines(lines: readonly string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) continue;
    out.push(t);
  }
  return out;
}

function getPreferredSubject(
  priorLabel: string,
  detected: string,
  careKey: string,
): string {
  const durable = resolveSubjectLabel({ careKey });
  if (durable !== "Your loved one" && durable !== "they") return durable;
  return priorLabel ?? detected;
}

function turnFromProgressive(
  situation: ActiveCareSituation,
  relation: SituationRelation,
  progressive: ReturnType<typeof processProgressiveUnderstanding>,
  crs: CareRealityState | null,
): ActiveSituationTurn {
  const attached = attachCareRealityFields(
    {
      relation,
      situation,
      confirmation_title: progressive.confirmation_title,
      confirmation_body: progressive.confirmation_body,
      understanding_heading: progressive.understanding_heading,
      understanding_stage: progressive.understanding_stage,
      current_understanding: progressive.current_understanding,
      insufficiency_note: progressive.insufficiency_note,
      connection_note: progressive.connection_note,
      what_needs_context: progressive.open_questions,
      what_will_be_remembered: progressive.what_will_be_remembered,
      what_seems_happening: progressive.synthesis,
      what_matters_now: progressive.what_matters_now,
      show_attention_sections: progressive.show_attention_sections,
      what_changed_in_understanding: progressive.what_changed_in_understanding,
      understanding_effect: progressive.effect,
      resolved_uncertainties: progressive.resolved_uncertainties,
      pattern_label: progressive.pattern_label,
      what_can_wait: progressive.what_can_wait,
      what_may_become_serious: progressive.what_may_become_serious,
      compound_signal: progressive.compound_signal,
      trajectory_by_domain: progressive.trajectory_by_domain,
    },
    crs,
  );
  const latestObs = situation.observations[situation.observations.length - 1];
  const latestRaw = latestObs?.raw_text ?? "";
  const latestKind = (latestObs?.kind ?? "general") as CareEventKind;
  const turnClass = classifyCaregiverTurn({
    latestRawText: latestRaw,
    kind: latestKind,
    turn: attached,
    hasDocuments: false,
  });
  const relief = resolveReliefDecisionForTurn({
    turn: attached,
    turnClass,
    latestRawText: latestRaw,
  });
  const reliefPlan = applyReliefFieldsToDisclosurePlan({
    crsPlan: attached.disclosure_plan,
    relief,
  });
  // Relief tree owns Clarity — CRS stage plan cannot unlock pillars early.
  const showClarity = reliefPlan.show_what_matters_now;
  let what_matters_now = showClarity ? attached.what_matters_now : null;
  let what_can_wait = showClarity ? attached.what_can_wait : null;
  let what_may_become_serious = showClarity
    ? attached.what_may_become_serious
    : null;
  if (showClarity && !what_matters_now) {
    const signals = situation.observations.flatMap((o) =>
      detectObservationSignals(o.raw_text, o.kind),
    );
    const pillars = buildCareClarityPillars({
      situation,
      stage: attached.understanding_stage,
      signals,
      latestSignals: signals,
      patternLabel: progressive.pattern_label,
      kind: (situation.observations[situation.observations.length - 1]?.kind ??
        "general") as CareEventKind,
    });
    what_matters_now =
      pillars.what_matters_now ||
      buildMattersNowOrientation({
        subjectLabel: situation.subject_label,
        heldFocus: heldFocusLines(situation, 1)[0] ?? null,
        baselineChange: null,
        topUnknown: attached.what_needs_context[0] ?? null,
        patternContinues: situation.observations.length >= 3,
      });
    what_can_wait =
      pillars.what_can_wait ||
      "Explaining every detail or answering questions you do not know yet.";
    what_may_become_serious = pillars.what_may_become_serious;
  }
  return {
    ...attached,
    disclosure_plan: reliefPlan,
    what_seems_happening: attached.disclosure_plan.show_situation_summary
      ? attached.what_seems_happening
      : null,
    what_matters_now,
    what_can_wait,
    what_may_become_serious,
    show_attention_sections: showClarity && understandingSufficient({ situation }),
  };
}

/** Project a stored ACS into a caregiver turn without mutating the store. */
export function projectActiveSituationTurn(
  situation: ActiveCareSituation,
  relation?: SituationRelation,
): ActiveSituationTurn {
  const resolved: SituationRelation =
    relation ??
    (situation.observations.length <= 1 ? "opens_new" : "updates_active");

  const latest = situation.observations[situation.observations.length - 1];
  const crsKey =
    situation.care_recipient_id ??
    realityKey(situation.caregiver_id);
  if (!latest) {
    const crs = getCareRealityState(crsKey);
    return attachCareRealityFields(
      {
        relation: resolved,
        situation,
        confirmation_title: "Added to the Living Care Record",
        confirmation_body: "Added to the Living Care Record.",
        understanding_heading: "What is understood about this situation",
        understanding_stage: situation.understanding_stage,
        current_understanding: [],
        insufficiency_note: "More context would help explain why.",
        connection_note: situation.connection_note,
        what_needs_context: situation.open_questions,
        what_will_be_remembered: ["Care timeline continuity"],
        what_seems_happening: situation.synthesis,
        what_matters_now: situation.what_matters_now,
        show_attention_sections: situation.understanding_stage === "synthesizing",
        what_changed_in_understanding: situation.last_understanding_delta ?? null,
        understanding_effect: situation.last_understanding_effect ?? "opens_situation",
        resolved_uncertainties: [],
        pattern_label: situation.pattern_label ?? null,
        what_can_wait: "Explaining every detail tonight.",
        what_may_become_serious: null,
      },
      crs,
    );
  }

  const progressive = processProgressiveUnderstanding({
    prior:
      situation.observations.length <= 1
        ? null
        : {
            ...situation,
            observations: situation.observations.slice(0, -1),
          },
    relation: resolved,
    observation: latest,
    kind: latest.kind,
    rawText: latest.raw_text,
    draft: situation,
  });

  const baseTurn = turnFromProgressive(situation, resolved, progressive, null);
  const crs =
    getCareRealityState(crsKey) ??
    updateCareRealityState({
      caregiverId: crsKey,
      turn: baseTurn,
      situation,
      relation: resolved,
    });

  return turnFromProgressive(situation, resolved, progressive, crs);
}

/** Merge spine events onto held observation — no new ACS timeline row. */
function ingestReinforcementExisting(params: {
  prior: ActiveCareSituation;
  signalText: string;
  eventIds: string[];
  nowIso: string;
  careRecipientId: string;
}): ActiveSituationTurn {
  const target = findReinforcementTargetObservation(params.prior, params.signalText);
  const targetId = target?.id ?? params.prior.observations[params.prior.observations.length - 1]?.id;
  const observations: SituationObservation[] = params.prior.observations.map((obs) => {
    if (obs.id !== targetId || params.eventIds.length === 0) return obs;
    const mergedIds = [...new Set([...obs.event_ids, ...params.eventIds])];
    return { ...obs, event_ids: mergedIds };
  });
  const situation: ActiveCareSituation = {
    ...params.prior,
    updated_at: params.nowIso,
    observations,
  };
  acsCache().set(params.careRecipientId, situation);
  persistActiveCareSituationToDurable(situation);
  return projectActiveSituationTurn(situation, "updates_active");
}

/** Hold prior ACS — mismatched note is not appended until caregiver clarifies (G17). */
function ingestIdentityMismatchHold(params: {
  prior: ActiveCareSituation;
  signalText: string;
  trimmed: string;
  nowIso: string;
  careRecipientId: string;
}): ActiveSituationTurn {
  const ask = composeIdentityMismatchAsk(params.prior.subject_label, params.signalText);
  const base = projectActiveSituationTurn(params.prior, "updates_active");
  return {
    ...base,
    identity_mismatch: true,
    identity_mismatch_input: params.trimmed,
    connection_note: null,
    what_needs_context: [ask],
    confirmation_title: "Need a quick clarification",
    confirmation_body:
      "This update is saved — it will be linked to the care record once we confirm who it is about.",
    what_changed_in_understanding: null,
  };
}

/**
 * Slice 2.4 — Explicit memory correction on an open Care Reality.
 * Same path for text / document / snap / scan / upload (kind is attribution only).
 * Never silent overwrite: prior observation stays, marked disputed.
 */
function ingestMemoryCorrection(params: {
  prior: ActiveCareSituation;
  target: SituationObservation;
  trimmed: string;
  signalText: string;
  kind: CareEventKind;
  eventIds: string[];
  nowIso: string;
  careRecipientId: string;
  contributorId: string;
}): ActiveSituationTurn {
  const correctedValue = extractCorrectedClaimFromCorrection(params.signalText);
  const originalValue = (params.target.human_fact || params.target.raw_text).trim();
  const correction = recordMemoryCorrection({
    careRecipientId: params.careRecipientId,
    fieldLabel: "held_observation",
    originalValue,
    correctedValue,
    correctedBy: params.contributorId,
    reason: params.trimmed.slice(0, 240),
    nowIso: params.nowIso,
  });

  const observations: SituationObservation[] = params.prior.observations.map((obs) =>
    obs.id === params.target.id
      ? { ...obs, disputed_by_correction_id: correction.id }
      : obs,
  );

  const observation: SituationObservation = {
    id: newId("obs"),
    raw_text: params.trimmed,
    human_fact: correctedValue,
    kind: params.kind,
    captured_at: params.nowIso,
    event_ids: params.eventIds,
    epistemic_kind: classifyEpistemicClaim(params.signalText),
    contributor_id: params.contributorId,
    corrects_observation_id: params.target.id,
  };

  const situation: ActiveCareSituation = {
    ...params.prior,
    care_recipient_id: params.prior.care_recipient_id ?? params.careRecipientId,
    caregiver_id: params.contributorId,
    updated_at: params.nowIso,
    observations: [...observations, observation],
    synthesis: null,
  };

  const progressive = processProgressiveUnderstanding({
    prior: params.prior,
    relation: "updates_active",
    observation,
    kind: params.kind,
    rawText: params.signalText,
    draft: situation,
  });

  const correctedLine = correctedValue.endsWith(".")
    ? correctedValue
    : `${correctedValue}.`;
  const originalNeedle = originalValue.slice(0, 24).toLowerCase();
  const orientedUnderstanding = [
    correctedLine,
    ...progressive.current_understanding.filter(
      (line) => !originalNeedle || !line.toLowerCase().includes(originalNeedle),
    ),
  ].slice(0, 6);

  const whatChanged =
    "Prior understanding was corrected — earlier evidence kept as disputed.";

  acsCache().set(params.careRecipientId, situation);
  persistActiveCareSituationToDurable(situation);

  const progressiveOriented = {
    ...progressive,
    current_understanding: orientedUnderstanding,
    what_changed_in_understanding: whatChanged,
  };
  const baseTurn = turnFromProgressive(
    situation,
    "updates_active",
    progressiveOriented,
    null,
  );
  const turnPatched: ActiveSituationTurn = {
    ...baseTurn,
    memory_correction_applied: true,
    what_changed_in_understanding: whatChanged,
    current_understanding: orientedUnderstanding,
  };
  const crs = updateCareRealityState({
    caregiverId: params.careRecipientId,
    turn: turnPatched,
    situation,
    relation: "updates_active",
    nowIso: params.nowIso,
    memory_correction: {
      record_id: correction.id,
      original_observation: originalValue,
      corrected_value: correctedValue,
    },
  });

  return {
    ...turnFromProgressive(situation, "updates_active", progressiveOriented, crs),
    memory_correction_applied: true,
    what_changed_in_understanding: whatChanged,
    current_understanding: orientedUnderstanding,
  };
}

export function ingestActiveCareObservation(params: {
  caregiverId: string;
  rawText: string;
  kind: CareEventKind;
  eventIds?: string[];
  nowIso?: string;
  /** @deprecated Ignored — relation is server-owned from ACS + content. */
  entryIntent?: "initial" | "update";
  /** Pre-planned situation id from spine link (must match CareEvent.situation_id). */
  situationId?: string;
  /** Pre-planned situation root event id. */
  rootEventId?: string | null;
  /** G3 — contributor on shared Care Reality (defaults to caregiverId). */
  contributorId?: string;
  /**
   * Thread ingest (Locked B): keep fragments on one ACS.
   * When set, skips Relationship Engine open_new for subsequent fragments.
   */
  forceRelation?: SituationRelation;
  /** Pre-evaluated SRE decision from spine link — must match stamped CareEvents. */
  relationshipDecision?: SituationRelationshipDecision;
  /** When true, skip observation append and merge spine events onto held observation. */
  isReinforcement?: boolean;
  /** Pre-evaluated SRE identity conflict — hold ACS until caregiver clarifies (G17). */
  identityMismatch?: boolean;
  /** SRE improvement outcome link — not a care decision for Decision Memory. */
  isImprovementOutcome?: boolean;
  /**
   * Continuity decision from Care Identity engine.
   * Enables the composer to branch behavior for new vs returning caregivers.
   */
  continuityDecision?: import("../care-identity").ContinuityDecision;
}): ActiveSituationTurn {
  const nowIso = params.nowIso ?? new Date().toISOString();
  const careRecipientId = realityKey(params.caregiverId);
  const contributorId = params.contributorId ?? params.caregiverId;
  resumeActiveCareSituationSession(params.caregiverId);
  const prior = getActiveCareSituation(params.caregiverId);
  const trimmed = params.rawText.trim();
  // Interpretation uses caregiver-facing fragment — never thread-source envelope.
  const signalText = caregiverFacingFragmentText(trimmed) || trimmed;
  const eventIds = params.eventIds ?? [];

  // Idempotent — React re-renders must not restart / duplicate observations.
  if (prior) {
    const already = prior.observations.some(
      (o) =>
        o.raw_text.trim().toLowerCase() === trimmed.toLowerCase() ||
        (eventIds.length > 0 && eventIds.some((id) => o.event_ids.includes(id))),
    );
    if (already) {
      const relation: SituationRelation =
        prior.observations.length <= 1 ? "opens_new" : "updates_active";
      return projectActiveSituationTurn(prior, relation);
    }
  }

  // Slice 2.4 — explicit correction before reinforce / identity / open_new.
  // Requires held Care Reality; never invent correction theater on empty ACS.
  if (prior && looksLikeExplicitMemoryCorrection(signalText)) {
    const target = findCorrectionTargetObservation(prior, signalText);
    if (target) {
      return ingestMemoryCorrection({
        prior,
        target,
        trimmed,
        signalText,
        kind: params.kind,
        eventIds,
        nowIso,
        careRecipientId,
        contributorId,
      });
    }
  }

  const reinforceExisting =
    prior &&
    (params.isReinforcement === true ||
      params.relationshipDecision === "REINFORCE_EXISTING" ||
      evaluateSituationRelationship({
        active: prior,
        rawText: signalText,
        kind: params.kind,
        nowIso,
      }).decision === "REINFORCE_EXISTING");
  if (prior && reinforceExisting) {
    return ingestReinforcementExisting({
      prior,
      signalText,
      eventIds,
      nowIso,
      careRecipientId,
    });
  }

  const identityMismatchPending =
    prior &&
    (params.identityMismatch === true ||
      params.relationshipDecision === "UNCERTAIN_NEEDS_REVIEW" ||
      evaluateSituationRelationship({
        active: prior,
        rawText: signalText,
        kind: params.kind,
        nowIso,
      }).identity_mismatch);
  if (prior && identityMismatchPending) {
    return ingestIdentityMismatchHold({
      prior,
      signalText,
      trimmed,
      nowIso,
      careRecipientId,
    });
  }

  const relationRaw =
    params.forceRelation ??
    classifySituationRelation({
      active: prior,
      rawText: signalText,
      kind: params.kind,
      nowIso,
    });
  /**
   * Locked B: when another contributor adds soft evidence to an open Care Reality,
   * do not replace the Active Care Situation (that recreates per-caregiver realities).
   * Same-contributor and hard incidents may still open new per Relationship Engine.
   */
  const priorContributorIds = new Set(
    (prior?.observations ?? [])
      .map((o) => o.contributor_id)
      .filter((id): id is string => Boolean(id)),
  );
  if (prior?.caregiver_id) priorContributorIds.add(prior.caregiver_id);
  const otherContributorAdding =
    priorContributorIds.size > 0 && !priorContributorIds.has(contributorId);
  const relation: SituationRelation =
    prior &&
    relationRaw === "opens_new" &&
    otherContributorAdding &&
    !isHardEventKind(params.kind) &&
    prior.lifecycle_status !== "resolved" &&
    prior.lifecycle_status !== "historical"
      ? "adds_context"
      : relationRaw;

  const detected = resolveSubjectLabel({
    careKey: careRecipientId,
    rawText: params.rawText,
  });
  // Prefer durable display name always when present (already inside resolveSubjectLabel).
  const subject =
    relation === "opens_new" || !prior
      ? detected
      : prior.subject_label === "Your loved one" || prior.subject_label === "they"
        ? detected !== "Your loved one" && detected !== "they"
          ? detected
          : getPreferredSubject(prior.subject_label, detected, careRecipientId)
        : getPreferredSubject(prior.subject_label, detected, careRecipientId);

  const epistemic = classifyEpistemicClaim(signalText);
  // Locked B: caregiver-facing fact is the fragment — never the [thread-source] dump.
  const factSource = caregiverFacingFragmentText(trimmed) || trimmed;
  const observation: SituationObservation = {
    id: newId("obs"),
    raw_text: trimmed,
    human_fact: refineHumanFact(factSource, subject, {
      isFirst: relation === "opens_new" || !prior,
    }),
    kind: params.kind,
    captured_at: nowIso,
    event_ids: eventIds,
    epistemic_kind: epistemic,
    contributor_id: contributorId,
  };

  const sourceConflict = evaluateSourceConflict({
    careKey: careRecipientId,
    priorObservations: (prior?.observations ?? []).map((o) => ({
      raw_text: o.raw_text,
      kind: o.kind,
      captured_at: o.captured_at,
      contributor_id: o.contributor_id,
    })),
    incomingText: factSource,
    incomingKind: params.kind,
    incomingCapturedAt: nowIso,
    incomingContributorId: contributorId,
  });
  recordSourceClaim({
    careKey: careRecipientId,
    rawText: factSource,
    kind: params.kind,
    capturedAt: nowIso,
  });

  const priorBaselineCount = listFamiliarityBaseline(careRecipientId).length;

  if (
    epistemic === "baseline_establishment" ||
    /\b(loves?|hate[sd]?|prefers?|usually|normally|always)\b/i.test(trimmed)
  ) {
    recordFamiliarityFromText({
      careKey: careRecipientId,
      rawText: trimmed,
      subjectLabel: subject,
      nowIso,
    });
  }

  recordDailyLivingSignal({
    careKey: careRecipientId,
    rawText: trimmed,
    nowIso,
  });

  const familiarityLines = listFamiliarityBaseline(careRecipientId).map(
    (f) => f.statement,
  );
  const deviation = familiarityDeviationNote({
    careKey: careRecipientId,
    rawText: trimmed,
    subjectLabel: subject,
    hadPriorBaseline: priorBaselineCount > 0,
    nowIso,
  });
  const gradual = evaluateGradualChange(careRecipientId);
  const priorTexts = (prior?.observations ?? []).map((o) => o.raw_text);
  const fluctuation = evaluateDayFluctuation({
    priorTexts,
    latestText: trimmed,
  });
  const personhood = evaluatePersonhoodLifeChange({
    careKey: params.caregiverId,
    rawText: trimmed,
    subjectLabel: subject,
  });
  const preference = evaluatePreferenceRecall({
    careKey: params.caregiverId,
    rawText: trimmed,
    subjectLabel: subject,
  });
  const safety = evaluateSafetyContinuity({
    careKey: params.caregiverId,
    rawText: trimmed,
  });
  const unknownCause = evaluateUnknownCauseChange({
    rawText: trimmed,
    subjectLabel: subject,
  });
  const changeVsCrisis = evaluateChangeVsCrisis({ rawText: trimmed });
  const missedCare = evaluateCaregiverMissedCare({ rawText: trimmed });
  const disagreeing = evaluateDisagreeingViews({
    priorTexts,
    rawText: trimmed,
  });
  const naturalLanguage = evaluateNaturalLanguageObservation({ rawText: trimmed });
  const continuityWorry = evaluateContinuityWorry({
    rawText: trimmed,
    observationCount: (prior?.observations.length ?? 0) + 1,
  });
  const repeatedQuestions = evaluateRepeatedQuestionPattern({
    priorTexts,
    latestText: trimmed,
  });
  const ambiguousShift = evaluateAmbiguousBehaviorShift({ rawText: trimmed });
  const normalcy = evaluateNormalcyUncertainty({ rawText: trimmed });
  const routineDisruption = evaluateRoutineDisruption({
    rawText: trimmed,
    familiarityStatements: familiarityLines,
  });
  const situationBehind = evaluateSituationBehindFact({ rawText: trimmed });
  const careTransition = evaluateCareTransition({ rawText: trimmed });
  const roleTransition = evaluateCaregiverRoleTransition({ rawText: trimmed });
  const historical = evaluateHistoricalImportance({
    priorTexts,
    rawText: trimmed,
  });
  const milestone = evaluateJourneyMilestone({ rawText: trimmed });
  const advancedCare = evaluateAdvancedCareSensitivity({ rawText: trimmed });

  let draft: ActiveCareSituation;

  if (relation === "opens_new" || !prior) {
    const situationId = params.situationId ?? newId("acs");
    const rootEventId = params.rootEventId ?? eventIds[0] ?? null;
    draft = {
      id: situationId,
      care_recipient_id: careRecipientId,
      caregiver_id: contributorId,
      opened_at: nowIso,
      updated_at: nowIso,
      root_event_id: rootEventId,
      subject_label: subject,
      theme: situationThemeFor(params.kind, params.rawText),
      observations: [observation],
      open_questions: [],
      asked_questions: [],
      understanding_stage: "gathering",
      connection_note: null,
      synthesis: null,
      what_matters_now: null,
      last_understanding_effect: null,
      last_understanding_delta: null,
      pattern_label: null,
      familiarity_baseline: familiarityLines,
    };
  } else {
    draft = {
      ...prior,
      care_recipient_id: prior.care_recipient_id ?? careRecipientId,
      caregiver_id: contributorId,
      updated_at: nowIso,
      root_event_id: prior.root_event_id ?? params.rootEventId ?? eventIds[0] ?? null,
      subject_label: subject,
      observations: [...prior.observations, observation],
      synthesis: null,
      what_matters_now: prior.what_matters_now,
      familiarity_baseline: familiarityLines,
    };
  }

  const progressive = processProgressiveUnderstanding({
    prior: relation === "opens_new" ? null : prior,
    relation,
    observation,
    kind: params.kind,
    rawText: signalText,
    draft,
  });

  const decisionSource =
    params.kind === "document" ? "document" : "caregiver_note";
  const sreDecisionLink =
    params.relationshipDecision === "ADD_RELATED_EVENT" &&
    params.isImprovementOutcome !== true;
  if (looksLikeDecisionEvidence(factSource) || sreDecisionLink) {
    recordDecisionFromText({
      careKey: careRecipientId,
      rawText: factSource,
      nowIso,
      who: [contributorId],
      situationId: draft.id,
      contextSummary: draft.subject_label ?? null,
      source: decisionSource,
      eventId: observation.event_ids[0],
      forceFromRelationshipEngine:
        sreDecisionLink && !looksLikeDecisionEvidence(factSource),
    });
  }

  // Care Reality extraction for Decision + Outcome + Unknown layers (any care-worthy length).
  const extractedOpenUnknownAsks: string[] = [];
  if (trimmed.length >= 40) {
    const extracted = extractCareRealityFromText({
      rawText: trimmed,
      contributorId,
    });
    for (const d of extracted.decisions) {
      recordDecisionFromText({
        careKey: careRecipientId,
        rawText: d.description,
        nowIso,
        who: d.who,
        situationId: draft.id,
        contextSummary: draft.subject_label ?? null,
        source: decisionSource,
        eventId: observation.event_ids[0],
        forceFromRelationshipEngine: true,
        reason: d.why,
        reasonUnknown: d.reason_unknown,
        alternatives: d.alternatives,
        outcome: d.outcome,
        status:
          d.status === "needs_review"
            ? "needs_review"
            : d.status === "pending"
              ? "pending"
              : d.status === "uncertain"
                ? "uncertain"
                : d.reason_unknown
                  ? "needs_review"
                  : "active",
      });
    }
    for (const out of extracted.outcomes) {
      if (out.related_type !== "decision") continue;
      // Never invent success — store neutral observed/uncertain result text only
      linkDecisionOutcome({
        careKey: careRecipientId,
        outcomeText: out.description,
        eventId: observation.event_ids[0],
        matchTokens: out.raw_fragment
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2),
        nowIso,
        status: out.status === "uncertain" ? "uncertain" : undefined,
      });
    }
    for (const u of extracted.unknowns) {
      if (u.status !== "open") continue;
      extractedOpenUnknownAsks.push(u.question);
    }
  }

  const improvementSignals = detectObservationSignals(factSource, params.kind);
  if (isImprovementUpdate(improvementSignals) || relation === "answers_uncertainty") {
    linkDecisionOutcome({
      careKey: careRecipientId,
      outcomeText: factSource,
      eventId: observation.event_ids[0],
      matchTokens: factSource
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2),
      nowIso,
    });
  }

  const what_changed =
    advancedCare.note ??
    continuityWorry.note ??
    normalcy.note ??
    careTransition.note ??
    roleTransition.note ??
    milestone.note ??
    historical.note ??
    situationBehind.note ??
    personhood.note ??
    routineDisruption.note ??
    repeatedQuestions.note ??
    ambiguousShift.note ??
    sourceConflict.note ??
    missedCare.note ??
    disagreeing.note ??
    fluctuation.note ??
    safety.note ??
    preference.note ??
    (gradual.emerging ? gradual.note : null) ??
    changeVsCrisis.note ??
    unknownCause.note ??
    naturalLanguage.note ??
    deviation ??
    progressive.what_changed_in_understanding;

  const pattern_label =
    advancedCare.pattern_label ??
    continuityWorry.pattern_label ??
    normalcy.pattern_label ??
    careTransition.pattern_label ??
    roleTransition.pattern_label ??
    milestone.pattern_label ??
    historical.pattern_label ??
    situationBehind.pattern_label ??
    personhood.pattern_label ??
    routineDisruption.pattern_label ??
    repeatedQuestions.pattern_label ??
    ambiguousShift.pattern_label ??
    sourceConflict.pattern_label ??
    missedCare.pattern_label ??
    disagreeing.pattern_label ??
    fluctuation.pattern_label ??
    safety.pattern_label ??
    (gradual.emerging ? gradual.pattern_label : null) ??
    changeVsCrisis.pattern_label ??
    (unknownCause.is_unknown_cause_change ? "change with unknown cause" : null) ??
    naturalLanguage.pattern_label ??
    progressive.pattern_label;

  let open_questions = [...progressive.open_questions];
  let known_unknowns = [...progressive.known_unknowns];
  const newlyMintedAsks = new Set(
    progressive.open_questions.map((q) => q.toLowerCase()),
  );
  const addOpenAsk = (ask: string) => {
    if (!open_questions.some((q) => q.toLowerCase() === ask.toLowerCase())) {
      open_questions = [ask, ...open_questions].slice(0, 3);
    }
    if (!known_unknowns.some((q) => q.toLowerCase() === ask.toLowerCase())) {
      known_unknowns = [ask, ...known_unknowns].slice(0, 8);
    }
    newlyMintedAsks.add(ask.toLowerCase());
  };
  if (unknownCause.open_ask) {
    addOpenAsk(unknownCause.open_ask);
  }
  if (situationBehind.open_ask) {
    addOpenAsk(situationBehind.open_ask);
  }
  if (ambiguousShift.open_ask) {
    addOpenAsk(ambiguousShift.open_ask);
  }
  if (sourceConflict.open_ask) {
    addOpenAsk(sourceConflict.open_ask);
  }
  for (const ask of extractedOpenUnknownAsks.slice(0, 4)) {
    addOpenAsk(ask);
  }

  const priorCrs = getCareRealityState(careRecipientId);
  // Only reconcile PRIOR open gaps against this note — never "answer" asks minted this turn
  // (same capture would false-resolve "What else…?" via "has not" in care notes).
  const priorOpenOnly = known_unknowns.filter(
    (q) => !newlyMintedAsks.has(q.toLowerCase()),
  );
  const lifecycle = reconcileOpenUncertainties({
    situation: draft,
    openQuestions: priorOpenOnly,
    rawText: factSource,
    priorResolved: priorCrs?.resolved_uncertainties ?? [],
  });
  const newlyMintedList = known_unknowns.filter((q) =>
    newlyMintedAsks.has(q.toLowerCase()),
  );
  known_unknowns = dedupeUncertaintyLines([
    ...lifecycle.open,
    ...newlyMintedList,
  ]).slice(0, 8);
  open_questions = open_questions.filter((q) =>
    known_unknowns.some((o) => o.toLowerCase() === q.toLowerCase()),
  );
  const lifecycleResolved = lifecycle.resolved.filter(
    (r) =>
      !progressive.resolved_uncertainties.some(
        (p) => p.toLowerCase() === r.toLowerCase(),
      ),
  );
  const mergedResolved = dedupeUncertaintyLines([
    ...progressive.resolved_uncertainties,
    ...lifecycleResolved,
  ]);
  let finalRelation: SituationRelation =
    mergedResolved.length > 0 && relation !== "opens_new"
      ? "answers_uncertainty"
      : relation;
  if (
    lifecycle.resolved.length > progressive.resolved_uncertainties.length &&
    finalRelation !== "opens_new"
  ) {
    finalRelation = "answers_uncertainty";
  }

  // Prefer higher-priority source text for orientation facts when conflicted.
  let orientedUnderstanding = [...progressive.current_understanding];
  if (sourceConflict.has_conflict) {
    const preferredText =
      sourceConflict.priority_for_orientation === "prior"
        ? sourceConflict.prior_text
        : sourceConflict.priority_for_orientation === "incoming"
          ? sourceConflict.incoming_text
          : null;
    if (preferredText) {
      const clinicalFact = preferredText.replace(/^\[document:[^\]]*\]\s*/i, "").trim();
      const preferredKind =
        sourceConflict.priority_for_orientation === "prior"
          ? "document"
          : params.kind;
      if (
        clinicalFact &&
        sourcePriorityRank(preferredKind, preferredText) >= 80 &&
        !orientedUnderstanding.some((l) => l.includes(clinicalFact.slice(0, 40)))
      ) {
        orientedUnderstanding = [clinicalFact.slice(0, 160), ...orientedUnderstanding].slice(
          0,
          4,
        );
      }
    }
  }

  const situation: ActiveCareSituation = {
    ...draft,
    care_recipient_id: draft.care_recipient_id ?? careRecipientId,
    theme: progressive.theme,
    understanding_stage: progressive.understanding_stage,
    open_questions: known_unknowns,
    asked_questions: progressive.asked_questions,
    connection_note: progressive.connection_note,
    synthesis: progressive.synthesis,
    what_matters_now: progressive.what_matters_now,
    last_understanding_effect: progressive.effect,
    last_understanding_delta: what_changed,
    pattern_label,
    familiarity_baseline: familiarityLines,
  };

  acsCache().set(careRecipientId, situation);
  persistActiveCareSituationToDurable(situation);

  clearSoftInviteWhenUncertaintyGone({
    careKey: params.caregiverId,
    openUncertainties: known_unknowns,
  });

  if (careRecipientId !== params.caregiverId) {
    clearSoftInviteWhenUncertaintyGone({
      careKey: careRecipientId,
      openUncertainties: known_unknowns,
    });
  }

  const progressiveOriented = {
    ...progressive,
    open_questions,
    known_unknowns,
    current_understanding: orientedUnderstanding,
    resolved_uncertainties: mergedResolved,
    effect:
      finalRelation === "answers_uncertainty" ? ("answers_uncertainty" as const) : progressive.effect,
  };
  const baseTurn = turnFromProgressive(situation, finalRelation, progressiveOriented, null);
  const turnPatched = {
    ...baseTurn,
    what_changed_in_understanding: what_changed,
    pattern_label,
    resolved_uncertainties: mergedResolved,
    relation: finalRelation,
    understanding_effect:
      finalRelation === "answers_uncertainty"
        ? ("answers_uncertainty" as const)
        : baseTurn.understanding_effect,
  };
  const crs = updateCareRealityState({
    caregiverId: careRecipientId,
    turn: turnPatched,
    situation,
    relation: finalRelation,
    nowIso,
  });
  const continuityDecision = params.continuityDecision;

  return {
    ...turnFromProgressive(situation, finalRelation, progressiveOriented, crs),
    what_changed_in_understanding: what_changed,
    pattern_label,
    resolved_uncertainties: mergedResolved,
    relation: finalRelation,
    continuity_decision: continuityDecision,
  };
}
