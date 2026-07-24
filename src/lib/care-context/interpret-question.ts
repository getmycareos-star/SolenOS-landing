import type { CareEventType } from "../care-snapshot/types";
import { classifyEventType } from "../care-snapshot/classify";
import { cleanText, extractDate, splitIntoSentences } from "../care-snapshot/normalize";
import type {
  EngineAction,
  QuestionInterpretation,
  SignalTheme,
} from "./types";
import {
  classifyDemandType,
  detectSignalThemes,
  underlyingNeedForTheme,
} from "./question-signals";

function extractEventsFromQuestion(
  question: string,
  referenceDate: string,
): QuestionInterpretation["proposedEvents"] {
  const sentences = splitIntoSentences(question);
  return sentences
    .filter((s) => !/^(how|what|when|should|is it|does|can i)\b/i.test(s))
    .map((sentence) => {
      const { date, dateLabel } = extractDate(sentence, referenceDate);
      const type: CareEventType = classifyEventType(sentence);
      return {
        date,
        dateLabel,
        description: cleanText(sentence),
        type,
        source: "question" as const,
      };
    })
    .filter((e) => e.description.length > 3);
}

function deriveEngineActions(
  themes: SignalTheme[],
  demandType: QuestionInterpretation["demandType"],
  question: string,
): EngineAction[] {
  const actions: EngineAction[] = [
    "create_care_events",
    "update_timeline",
    "compare_historical_context",
    "preserve_longitudinal_journey",
  ];

  if (themes.includes("disease_progression") || demandType === "continuity") {
    actions.push("detect_progression", "compute_changes");
  }

  actions.push("highlight_uncertainty", "prioritize_next_actions");

  if (
    /\b(time for|professional care|doctor|physician|specialist|hospital|emergency)\b/i.test(
      question,
    ) ||
    themes.includes("decision_making")
  ) {
    actions.push("recommend_professional_consultation");
  }

  return [...new Set(actions)];
}

function deriveUncertainties(
  themes: SignalTheme[],
  demandType: QuestionInterpretation["demandType"],
): string[] {
  const uncertainties: string[] = [];

  if (themes.includes("decision_making")) {
    uncertainties.push(
      "Care level threshold cannot be determined from a single question without longitudinal context.",
    );
  }
  if (themes.includes("disease_progression")) {
    uncertainties.push(
      "Rate and cause of progression require observation over time and professional assessment.",
    );
  }
  if (themes.includes("financial_uncertainty")) {
    uncertainties.push(
      "Coverage and cost depend on specific plans, location, and eligibility — not available in care context alone.",
    );
  }
  if (demandType === "continuity") {
    uncertainties.push(
      "Historical care events may be incomplete — reconstruction depends on available records.",
    );
  }

  return uncertainties;
}

function buildContinuityFraming(
  themes: SignalTheme[],
  demandType: QuestionInterpretation["demandType"],
): string {
  if (demandType === "search" && themes.length === 1 && themes[0] === "financial_uncertainty") {
    return "This question signals information need, but the deeper product opportunity is tracking care decisions made under financial uncertainty over time.";
  }

  const needs = themes.map(underlyingNeedForTheme).filter(Boolean);
  if (needs.length === 0) {
    return "This question signals a need to understand an evolving care situation — not to receive an isolated answer.";
  }

  return `Underlying signals: ${needs.join(" ")} SolenOS should reconstruct CareContext before any guidance.`;
}

/**
 * Interpret a caregiver question as product intelligence.
 * Returns engine actions and proposed events — NOT a search-engine answer.
 */
export function interpretQuestion(
  question: string,
  options: { referenceDate?: string } = {},
): QuestionInterpretation {
  const referenceDate = options.referenceDate ?? new Date().toISOString();
  const signalThemes = detectSignalThemes(question);
  const demandType = classifyDemandType(question);
  const proposedEvents = extractEventsFromQuestion(question, referenceDate);
  const engineActions = deriveEngineActions(signalThemes, demandType, question);
  const uncertainties = deriveUncertainties(signalThemes, demandType);

  return {
    rawQuestion: question.trim(),
    demandType,
    signalThemes,
    proposedEvents,
    engineActions,
    uncertainties,
    continuityFraming: buildContinuityFraming(signalThemes, demandType),
  };
}
