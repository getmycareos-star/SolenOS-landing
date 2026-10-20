/**
 * Phase 5.1 — CRS as source of truth for caregiver compose.
 * Latest message is delta only; durable belief lives in Care Reality State.
 */
import type { ActiveSituationTurn } from "../active-care-situation/types";
import type { CareRealityState } from "../care-reality-state/types";
import {
  isCareRealityAnchorText,
  isProductSessionMetaText,
} from "../care-epistemics";
import type { CaregiverTurnClass } from "../response-behavior";
import {
  filterOpenUncertaintiesForCareBlob,
} from "../progressive-understanding/uncertainty-lifecycle";

export type CrsComposeContext = {
  /** Returning user with CRS depth — compose must not re-derive from latest alone. */
  usesCrsAsSource: boolean;
  heldUnderstanding: string[];
  openUncertainties: string[];
  whatChangedInUnderstanding: string | null;
  understandingRevisions: CareRealityState["understanding_revisions"];
  supportingEvidence: CareRealityState["supporting_evidence"];
  situationSummary: string | null;
  crsRevision: number;
};

function filterCareUnderstanding(lines: readonly string[]): string[] {
  return lines
    .map((l) => l.trim())
    .filter(
      (l) =>
        l.length > 0 &&
        !isProductSessionMetaText(l) &&
        (isCareRealityAnchorText(l) || /you described/i.test(l)),
    );
}

/**
 * Resolve compose inputs: CRS first, turn as fallback; latest is delta when returning.
 */
export function resolveCrsComposeContext(params: {
  crs: CareRealityState | null;
  turn: ActiveSituationTurn;
  latestRawText: string;
  latestIsCareWorthy: boolean;
  isNewCareReality: boolean;
  turnClass: CaregiverTurnClass;
}): CrsComposeContext {
  const { crs, turn, latestIsCareWorthy, isNewCareReality } = params;

  const turnUnderstanding = filterCareUnderstanding(turn.current_understanding);
  const fallbackHeld =
    turnUnderstanding.length > 0 ? turnUnderstanding : turn.current_understanding;

  const fallback: CrsComposeContext = {
    usesCrsAsSource: false,
    heldUnderstanding: fallbackHeld,
    openUncertainties: [
      ...new Set([...turn.situation.open_questions, ...turn.what_needs_context]),
    ],
    whatChangedInUnderstanding: turn.what_changed_in_understanding,
    understandingRevisions: [],
    supportingEvidence: [],
    situationSummary: turn.what_seems_happening,
    crsRevision: turn.crs_revision ?? 0,
  };

  if (!crs) return fallback;

  const crsHeld = filterCareUnderstanding(crs.current_understanding);
  const hasCrsDepth =
    crsHeld.length > 0 &&
    (!isNewCareReality ||
      (crs.revision ?? 0) >= 2 ||
      (crs.observation_count ?? 0) >= 2);

  if (!hasCrsDepth) {
    return {
      ...fallback,
      heldUnderstanding: crsHeld.length > 0 ? crsHeld : fallbackHeld,
      openUncertainties:
        crs.open_uncertainties.length > 0
          ? crs.open_uncertainties
          : fallback.openUncertainties,
      understandingRevisions: crs.understanding_revisions ?? [],
      supportingEvidence: crs.supporting_evidence ?? [],
      situationSummary: crs.situation_summary ?? fallback.situationSummary,
      crsRevision: crs.revision,
    };
  }

  const heldUnderstanding = crsHeld.length > 0 ? crsHeld : turnUnderstanding;

  const openUncertainties = filterOpenUncertaintiesForCareBlob(
    turn.situation,
    [
      ...new Set([...(crs.open_uncertainties ?? []), ...turn.situation.open_questions]),
    ].filter(Boolean),
  ).filter(
    (q) =>
      !(crs.resolved_uncertainties ?? []).some(
        (r) => r.toLowerCase() === q.toLowerCase(),
      ),
  );

  const whatChangedInUnderstanding =
    latestIsCareWorthy && turn.what_changed_in_understanding
      ? turn.what_changed_in_understanding
      : crs.what_changed_in_understanding ?? turn.what_changed_in_understanding;

  const situationSummary =
    !latestIsCareWorthy && crs.situation_summary
      ? crs.situation_summary
      : turn.what_seems_happening ?? crs.situation_summary;

  return {
    usesCrsAsSource: true,
    heldUnderstanding,
    openUncertainties,
    whatChangedInUnderstanding,
    understandingRevisions: crs.understanding_revisions ?? [],
    supportingEvidence: crs.supporting_evidence ?? [],
    situationSummary,
    crsRevision: crs.revision,
  };
}

/** Care-anchor facts from CRS supporting evidence for evidence line compose. */
export function crsSupportingFacts(
  evidence: CrsComposeContext["supportingEvidence"],
  max = 3,
): string[] {
  return evidence
    .map((e) => e.observation.trim())
    .filter((o) => o.length > 0 && isCareRealityAnchorText(o))
    .slice(0, max);
}
