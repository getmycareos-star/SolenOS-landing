/**
 * Progressive Understanding Engine — process one observation against ACS state.
 */

import type { ProgressiveUnderstandingInput, ProgressiveUnderstandingResult } from "./types";
import {
  collectSituationSignals,
  detectObservationSignals,
  emotionalSignalCount,
  isImprovementUpdate,
  latestObservationSignals,
  patternLabelFor,
} from "./detect-signals";
import {
  isCaregiverQuestionPushback,
  mergeKnownUnknowns,
  resolveAnsweredUncertainties,
} from "./resolve-uncertainty";
import {
  buildEvolvingUnderstandingLines,
  evolveSynthesis,
  evolveUnderstandingDelta,
  stageFromSignals,
} from "./evolve-synthesis";
import {
  nextQuestionsForUnderstanding,
  rememberedThemesForUnderstanding,
  understandingSufficient,
} from "./questions";
import {
  buildCareClarityPillars,
  isCaregiverFacingFactLine,
} from "./clarity-pillars";
import {
  buildProgressiveTurnCopy,
  classifyUnderstandingEffect,
  connectionNoteForProgress,
} from "./turn-copy";
import { situationThemeFor } from "../active-care-situation/classify";

export function processProgressiveUnderstanding(
  input: ProgressiveUnderstandingInput,
): ProgressiveUnderstandingResult {
  const { prior, relation, observation, kind, rawText, draft } = input;

  const priorSignals = prior
    ? collectSituationSignals(prior.observations)
    : [];
  const allSignals = collectSituationSignals(draft.observations);
  const latestSignals = latestObservationSignals(draft.observations);
  const latestSignalsDetected = detectObservationSignals(rawText, kind);
  const newSignals = latestSignalsDetected.filter(
    (s) => !priorSignals.includes(s) && s !== "general",
  );

  const introducedDimension =
    (latestSignals.includes("appetite") &&
      priorSignals.some((s) => s !== "appetite" && s !== "general")) ||
    (latestSignals.includes("medication") && prior != null) ||
    (latestSignals.includes("fall") &&
      prior != null &&
      prior.theme === "emotional_behavior");

  const { remaining, resolved } = resolveAnsweredUncertainties({
    openQuestions: prior?.open_questions ?? [],
    rawText,
  });

  const patternLabel = patternLabelFor(allSignals, latestSignals);
  const understanding_stage = stageFromSignals(draft.observations.length, allSignals);
  const improvement = isImprovementUpdate(latestSignals);

  let theme = draft.theme;
  if (
    emotionalSignalCount(allSignals) >= 1 ||
    situationThemeFor(kind, rawText) === "emotional_behavior"
  ) {
    theme =
      prior?.theme === "incident" && introducedDimension && latestSignals.includes("fall")
        ? "mixed"
        : emotionalSignalCount(allSignals) >= 1
          ? "emotional_behavior"
          : draft.theme;
  }

  const priorMatters = prior?.what_matters_now ?? null;
  const claritySufficient = understandingSufficient({
    situation: { ...draft, theme, understanding_stage },
    signals: allSignals,
  });
  const clarity = claritySufficient
    ? buildCareClarityPillars({
        situation: { ...draft, theme, understanding_stage },
        stage: understanding_stage,
        signals: allSignals,
        latestSignals,
        patternLabel,
        kind,
      })
    : {
        what_matters_now: null as string | null,
        what_can_wait: null as string | null,
        what_may_become_serious: null as string | null,
      };
  const what_matters_now = clarity.what_matters_now;
  const what_can_wait = clarity.what_can_wait;
  const what_may_become_serious = clarity.what_may_become_serious;
  const mattersChanged = Boolean(
    what_matters_now && what_matters_now !== priorMatters && prior != null,
  );

  const effect = classifyUnderstandingEffect({
    relation,
    resolvedCount: resolved.length,
    newSignalCount: newSignals.length,
    introducedDimension,
    mattersChanged,
    stage: understanding_stage,
    priorStage: prior?.understanding_stage ?? null,
    invalidatesPrior:
      improvement ||
      (Boolean(prior?.synthesis) &&
        Boolean(patternLabel) &&
        patternLabel !== prior?.pattern_label &&
        understanding_stage === "synthesizing"),
  });

  const synthesis = evolveSynthesis({
    situation: { ...draft, theme, understanding_stage },
    stage: understanding_stage,
    signals: allSignals,
    latestSignals,
    patternLabel,
  });

  const what_changed_in_understanding = evolveUnderstandingDelta({
    prior,
    stage: understanding_stage,
    signals: allSignals,
    priorSignals,
    patternLabel,
    resolvedCount: resolved.length,
    effectLabel: effect,
    latestSignals,
    latestRawText: rawText,
  });

  const open_questions = improvement || isCaregiverQuestionPushback(rawText)
    ? []
    : nextQuestionsForUnderstanding({
        situation: {
          ...draft,
          theme,
          understanding_stage,
          open_questions: remaining,
          asked_questions: prior?.asked_questions ?? draft.asked_questions,
        },
        stage: understanding_stage,
        latestKind: kind,
        latestText: rawText,
        signals: allSignals,
        patternLabel,
        remainingOpen: remaining,
      });
  // Only NEW asks this turn — never re-surface prior unanswered asks (trust).
  // Remaining known-unknowns still persist on ACS/CRS for soft return invite (Locked B).
  const known_unknowns = mergeKnownUnknowns(remaining, open_questions);

  // Track every question shown so the next turn never repeats the same ask.
  const asked_questions = [
    ...(prior?.asked_questions ?? draft.asked_questions),
    ...open_questions.filter(
      (q) =>
        !(prior?.asked_questions ?? draft.asked_questions).some(
          (a) => a.toLowerCase() === q.toLowerCase(),
        ),
    ),
  ].slice(-24);

  const connection_note = connectionNoteForProgress({
    relation,
    stage: understanding_stage,
    count: draft.observations.length,
    effect,
  });

  const current_understanding = buildEvolvingUnderstandingLines({
    ...draft,
    theme,
    understanding_stage,
  }).filter(isCaregiverFacingFactLine);

  // Prefer observation human_facts; ensure at least latest fact present when it is caregiver-facing
  if (
    observation.human_fact &&
    isCaregiverFacingFactLine(observation.human_fact) &&
    !current_understanding.some(
      (l) => l.toLowerCase() === observation.human_fact.toLowerCase(),
    )
  ) {
    current_understanding.push(
      observation.human_fact.endsWith(".")
        ? observation.human_fact
        : `${observation.human_fact}.`,
    );
  }

  const copy = buildProgressiveTurnCopy({
    relation,
    stage: understanding_stage,
    effect,
    observationCount: draft.observations.length,
    whatChanged: what_changed_in_understanding,
    patternLabel,
  });

  const show_attention_sections = claritySufficient;

  return {
    understanding_stage,
    theme,
    open_questions,
    known_unknowns,
    asked_questions,
    resolved_uncertainties: resolved,
    connection_note,
    synthesis,
    what_matters_now,
    what_can_wait,
    what_may_become_serious,
    current_understanding: current_understanding.slice(0, 4),
    understanding_heading: copy.understanding_heading,
    confirmation_title: copy.confirmation_title,
    confirmation_body: copy.confirmation_body,
    insufficiency_note: copy.insufficiency_note,
    what_will_be_remembered: rememberedThemesForUnderstanding(
      { ...draft, theme },
      patternLabel,
    ),
    show_attention_sections,
    what_changed_in_understanding,
    effect,
    signals_present: allSignals,
    pattern_label: patternLabel,
  };
}
