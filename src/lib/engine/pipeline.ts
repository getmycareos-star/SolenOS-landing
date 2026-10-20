import type { CareInput, ClarityState, StateTrace } from "./domain/types";
import { interpret, toCareInput } from "./interpret";
import { computeLoad } from "./compute-load";
import { prioritize } from "./prioritize";
import { generateActions } from "./generate-actions";
import { generateClarity } from "./generate-clarity";

export interface PipelineResult {
  clarity: ClarityState;
  trace: StateTrace;
}

/**
 * care_analysis_tool — sole allowed tool.
 * Transforms input → structured output through state machine.
 * Pure logic. No UI. No DB. No side effects.
 */
export function careAnalysisTool(input: CareInput): PipelineResult {
  const interpreted = interpret(input);
  const cognitive_load = computeLoad(interpreted);
  const priority = prioritize(interpreted, cognitive_load);
  const actions = generateActions(interpreted, priority);
  const clarity = generateClarity(interpreted, priority, actions);

  return {
    clarity,
    trace: {
      interpreted,
      cognitive_load,
      priority,
      actions,
      clarity,
    },
  };
}

export function analyzeRawText(
  rawText: string,
  source: CareInput["source"] = "user_note",
): PipelineResult {
  return careAnalysisTool(toCareInput(rawText, source));
}
