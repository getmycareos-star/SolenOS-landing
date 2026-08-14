import type { CareRealityState, UpdateCareRealityStateInput } from "./types";
import {
  buildDisclosurePlan,
  disclosureStageFor,
  evaluateResponseEvolution,
  primaryScreenQuestionFor,
} from "./disclosure";
import {
  crsCache,
  deleteCareRealityStateDurable,
  loadCareRealityStateFromDurable,
  persistCareRealityStateToDurable,
  resetCareRealityStateDurableStore,
  clearCareRealityStateMemoryCache,
} from "./durable-store";
import { resolveCareRealityStoreKey } from "../multi-caregiver-context-model";
import {
  isCareRealityAnchorText,
  isProductSessionMetaText,
  observationCareFact,
} from "../care-epistemics";
import { projectOpenUncertaintiesForState } from "../progressive-understanding/uncertainty-lifecycle";

export function resetCareRealityStateStore(): void {
  resetCareRealityStateDurableStore();
}

export { clearCareRealityStateMemoryCache };

function realityKey(contributorOrRealityId: string): string {
  return resolveCareRealityStoreKey(contributorOrRealityId);
}

export function getCareRealityState(contributorOrRealityId: string): CareRealityState | null {
  const careRecipientId = realityKey(contributorOrRealityId);
  const cached = crsCache().get(careRecipientId);
  if (cached) return normalizeCareRealityState(cached);
  let durable = loadCareRealityStateFromDurable(careRecipientId);
  if (!durable && careRecipientId !== contributorOrRealityId) {
    durable = loadCareRealityStateFromDurable(contributorOrRealityId);
  }
  if (!durable) return null;
  const normalized = normalizeCareRealityState({
    ...durable,
    care_recipient_id: durable.care_recipient_id ?? careRecipientId,
  });
  crsCache().set(careRecipientId, normalized);
  if (!durable.care_recipient_id) {
    persistCareRealityStateToDurable(normalized);
  }
  return normalized;
}

function normalizeCareRealityState(state: CareRealityState): CareRealityState {
  return {
    ...state,
    supporting_evidence: state.supporting_evidence ?? [],
    understanding_revisions: state.understanding_revisions ?? [],
    open_uncertainties: state.open_uncertainties ?? [],
    resolved_uncertainties: state.resolved_uncertainties ?? [],
    current_understanding: state.current_understanding ?? [],
    continuity_hooks: state.continuity_hooks ?? [],
  };
}

export function clearCareRealityState(contributorOrRealityId: string): void {
  const careRecipientId = realityKey(contributorOrRealityId);
  crsCache().delete(careRecipientId);
  deleteCareRealityStateDurable(careRecipientId);
  if (careRecipientId !== contributorOrRealityId) {
    crsCache().delete(contributorOrRealityId);
    deleteCareRealityStateDurable(contributorOrRealityId);
  }
}

function newId(): string {
  return `crs_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
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

/** Care-facing understanding lines — excludes product/session meta.
 * Sequential: later thin lines may count via earlier care anchors (Slice 5.4).
 */
function filterCareUnderstandingLines(lines: readonly string[]): string[] {
  const out: string[] = [];
  const priorFacts: string[] = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (!l || isProductSessionMetaText(l)) continue;
    if (isCareRealityAnchorText(l, { priorFacts }) || /you described/i.test(l)) {
      out.push(l);
      if (isCareRealityAnchorText(l, { priorFacts })) priorFacts.push(l);
    }
  }
  return out;
}

function situationHasSubstantiveCare(
  observations: UpdateCareRealityStateInput["situation"]["observations"],
): boolean {
  const priorFacts: string[] = [];
  for (const o of observations) {
    const fact = observationCareFact({
      human_fact: o.human_fact,
      raw_text: o.raw_text,
      priorFacts,
    });
    if (fact) {
      priorFacts.push(fact);
      return true;
    }
  }
  return false;
}

/**
 * Phase 5.1 — non-substantive turns must not wipe durable CRS belief.
 */
function preservePriorCrsWhenIncomingIsThin(params: {
  prior: CareRealityState | null;
  relation: UpdateCareRealityStateInput["relation"];
  incomingUnderstanding: string[];
  incomingEvidence: CareRealityState["supporting_evidence"];
  situationHasCare: boolean;
}): {
  preserve: boolean;
  understanding: string[];
  supporting_evidence: CareRealityState["supporting_evidence"];
  open_uncertainties: string[];
  situation_summary: string | null;
  observation_count: number;
} {
  const priorHeld = filterCareUnderstandingLines(params.prior?.current_understanding ?? []);
  const incomingHeld = filterCareUnderstandingLines(params.incomingUnderstanding);
  const preserve =
    Boolean(params.prior) &&
    priorHeld.length > 0 &&
    incomingHeld.length === 0 &&
    !params.situationHasCare;

  if (!preserve || !params.prior) {
    return {
      preserve: false,
      understanding: params.incomingUnderstanding,
      supporting_evidence: params.incomingEvidence,
      open_uncertainties: [],
      situation_summary: null,
      observation_count: 0,
    };
  }

  const priorEvidence = params.prior.supporting_evidence ?? [];
  const mergedEvidence = [
    ...priorEvidence,
    ...params.incomingEvidence.filter(
      (e) =>
        !priorEvidence.some(
          (p) => p.observation.toLowerCase() === e.observation.toLowerCase(),
        ),
    ),
  ].slice(0, 12);

  return {
    preserve: true,
    understanding: priorHeld,
    supporting_evidence: mergedEvidence,
    open_uncertainties: params.prior.open_uncertainties ?? [],
    situation_summary: params.prior.situation_summary,
    observation_count: Math.max(
      params.prior.observation_count ?? 0,
      params.incomingEvidence.length,
    ),
  };
}

/**
 * Update Care Reality State from an Active Situation turn (after Progressive Understanding).
 * Caregiver responses must be projected from this state — not from the latest message alone.
 */
export function updateCareRealityState(
  input: UpdateCareRealityStateInput,
): CareRealityState {
  const nowIso = input.nowIso ?? new Date().toISOString();
  const prior = getCareRealityState(input.caregiverId);
  const { turn, situation, relation } = input;

  const disclosure_stage = disclosureStageFor(
    turn.understanding_stage,
    situation.observations.length,
    turn.pattern_label,
    {
      theme: situation.theme,
      relation,
      resolvedUncertaintyCount: turn.resolved_uncertainties.length,
    },
  );

  const response_evolution = evaluateResponseEvolution({
    relation,
    effect: turn.understanding_effect,
    resolvedCount: turn.resolved_uncertainties.length,
    priorSummary: prior?.situation_summary ?? null,
    nextSummary: turn.what_seems_happening,
    priorMatters: prior?.what_matters_now ?? null,
    nextMatters: turn.what_matters_now,
    patternLabel: turn.pattern_label,
    priorPattern: prior?.pattern_label ?? null,
  });
  const responseEvolution = input.memory_correction
    ? { ...response_evolution, invalidates_previous_understanding: true }
    : response_evolution;

  const revisionSummary =
    turn.what_changed_in_understanding ??
    turn.what_seems_happening ??
    turn.current_understanding.slice(0, 2).join(" ") ??
    "Understanding updated.";

  const supporting_evidence = situation.observations
    .slice()
    .reverse()
    .slice(0, 12)
    .map((o) => {
      const date = (o.captured_at || nowIso).slice(0, 10);
      const observation = (o.human_fact || o.raw_text).trim().slice(0, 200);
      const source: "caregiver_note" | "document" | "related_observation" =
        o.kind === "document" ? "document" : "caregiver_note";
      return { source, date, observation };
    })
    .filter((e) => e.observation.length > 0);

  let mergedSupportingEvidence: CareRealityState["supporting_evidence"] =
    supporting_evidence;
  let mergedUnderstanding = turn.current_understanding;

  if (input.memory_correction) {
    const { original_observation, corrected_value } = input.memory_correction;
    const originalSnippet = original_observation.trim().slice(0, 160);
    const correctedSnippet = corrected_value.trim().slice(0, 160);
    mergedSupportingEvidence = [
      {
        source: "caregiver_note" as const,
        date: nowIso.slice(0, 10),
        observation: `Correction: ${correctedSnippet}`,
      },
      {
        source: "caregiver_note" as const,
        date: nowIso.slice(0, 10),
        observation: `Prior (disputed, kept): ${originalSnippet}`,
      },
      ...supporting_evidence.filter(
        (e) =>
          !e.observation.includes(originalSnippet.slice(0, 32)) &&
          !e.observation.toLowerCase().includes("correction:"),
      ),
    ].slice(0, 12);
    const correctedLine = correctedSnippet.endsWith(".")
      ? correctedSnippet
      : `${correctedSnippet}.`;
    mergedUnderstanding = [
      correctedLine,
      ...turn.current_understanding.filter(
        (line) =>
          !line.toLowerCase().includes(originalSnippet.slice(0, 24).toLowerCase()),
      ),
    ].slice(0, 6);
  }

  const situationHasCare = situationHasSubstantiveCare(situation.observations);
  const preservation = preservePriorCrsWhenIncomingIsThin({
    prior,
    relation,
    incomingUnderstanding: mergedUnderstanding,
    incomingEvidence: mergedSupportingEvidence,
    situationHasCare,
  });
  if (preservation.preserve) {
    mergedUnderstanding = preservation.understanding;
    mergedSupportingEvidence = preservation.supporting_evidence;
  }

  const preserveContinuity = preservation.preserve;
  const crsId =
    preserveContinuity || (relation !== "opens_new" && prior) ? prior!.id : newId();
  const crsRevision = preserveContinuity
    ? (prior!.revision ?? 0) + 1
    : relation === "opens_new" || !prior
      ? 1
      : (prior.revision ?? 0) + 1;
  const crsObservationCount = preserveContinuity
    ? preservation.observation_count
    : situation.observations.length;
  const latestObsText =
    situation.observations[situation.observations.length - 1]?.raw_text?.trim() ?? "";
  const uncertaintyProjection = projectOpenUncertaintiesForState({
    situation,
    crsOpen: preserveContinuity
      ? preservation.open_uncertainties
      : [...(prior?.open_uncertainties ?? []), ...situation.open_questions],
    rawText: latestObsText,
    priorResolved: [
      ...(prior?.resolved_uncertainties ?? []),
      ...turn.resolved_uncertainties,
    ],
  });
  const crsOpenUncertainties =
    preserveContinuity && preservation.open_uncertainties.length > 0
      ? preservation.open_uncertainties
      : uncertaintyProjection.open;
  const crsResolvedUncertainties = dedupeUncertaintyLines(uncertaintyProjection.resolved).slice(
    -20,
  );
  const crsSituationSummary = preserveContinuity
    ? preservation.situation_summary
    : turn.what_seems_happening;
  const crsWhatChanged = preserveContinuity
    ? prior!.what_changed_in_understanding
    : turn.what_changed_in_understanding;
  const priorRevisions =
    relation === "opens_new" && !preserveContinuity
      ? []
      : prior?.understanding_revisions ?? [];
  const crsRevisions = preserveContinuity
    ? [
        ...(prior!.understanding_revisions ?? []).slice(-19),
        {
          at: nowIso,
          disclosure_stage,
          summary: "Held prior care understanding — latest note did not replace it.",
          effect: turn.understanding_effect,
        },
      ]
    : [
        ...priorRevisions.slice(-19),
        {
          at: nowIso,
          disclosure_stage,
          summary: revisionSummary.slice(0, 280),
          effect: turn.understanding_effect,
        },
      ];

  const state: CareRealityState = {
    id: crsId,
    care_recipient_id:
      situation.care_recipient_id ??
      prior?.care_recipient_id ??
      realityKey(input.caregiverId),
    caregiver_id:
      situation.care_recipient_id ??
      prior?.care_recipient_id ??
      realityKey(input.caregiverId),
    care_recipient_label: situation.subject_label,
    updated_at: nowIso,
    situation_id: situation.id,
    root_event_id: situation.root_event_id,
    understanding_stage: turn.understanding_stage,
    disclosure_stage,
    current_understanding: mergedUnderstanding,
    supporting_evidence: mergedSupportingEvidence,
    situation_summary: crsSituationSummary,
    pattern_label: preserveContinuity ? prior!.pattern_label : turn.pattern_label,
    what_matters_now: preserveContinuity ? prior!.what_matters_now : turn.what_matters_now,
    open_uncertainties: crsOpenUncertainties,
    resolved_uncertainties: crsResolvedUncertainties,
    what_changed_in_understanding: crsWhatChanged,
    understanding_effect: turn.understanding_effect,
    response_evolution: responseEvolution,
    primary_screen_question: primaryScreenQuestionFor(disclosure_stage),
    observation_count: crsObservationCount,
    revision: crsRevision,
    continuity_hooks:
      preserveContinuity && (prior?.continuity_hooks ?? []).length > 0
        ? [...new Set([...(prior!.continuity_hooks ?? []), ...(turn.continuity_hooks ?? [])])]
        : turn.continuity_hooks ?? [],
    understanding_revisions: crsRevisions,
    care_domain_trajectories: turn.trajectory_by_domain ?? prior?.care_domain_trajectories ?? {},
    compound_signals: turn.compound_signal ? [turn.compound_signal] : prior?.compound_signals ?? [],
    change_classifications: (() => {
      const priorClass = preserveContinuity ? [...(prior?.change_classifications ?? [])] : [];
      const fromTurn = turn.what_changed_in_understanding
        ? turn.what_changed_in_understanding
            .split(/[:\-]/)[0]?.trim()
            .toUpperCase()
        : null;
      const valid = ["NEW", "WORSENED", "IMPROVED", "RECURRING", "PERSISTENT", "RESOLVED", "UNCERTAIN", "CONFLICTING", "STABLE"];
      if (fromTurn && valid.includes(fromTurn) && !priorClass.includes(fromTurn)) {
        return [...priorClass, fromTurn];
      }
      return priorClass;
    })(),
  };

  crsCache().set(state.care_recipient_id ?? state.caregiver_id, state);
  persistCareRealityStateToDurable(state);
  return state;
}

export function projectDisclosureFromState(state: CareRealityState) {
  return buildDisclosurePlan(state.disclosure_stage);
}
