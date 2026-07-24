import { checkInformationCompleteness } from "../risk-uncertainty-engine/completeness-check";
import type { ContextReasoningOutput } from "./types";

export function runContextReasoning(input: string): ContextReasoningOutput {
  const completeness = checkInformationCompleteness(input);
  const known: string[] = [];
  const unknown = [...completeness.missing_signals];
  const questions = completeness.missing_signals.map((m) => `Can you clarify: ${m}?`).slice(0, 5);

  const sentences = input
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
  known.push(...sentences.slice(0, 5));

  let confidence: ContextReasoningOutput["confidence"] = "insufficient";
  let completeness_score = 0.3;

  if (completeness.status === "COMPLETE") {
    confidence = "high";
    completeness_score = 0.9;
  } else if (completeness.status === "PARTIALLY_COMPLETE") {
    confidence = "medium";
    completeness_score = 0.6;
  }

  if (completeness.status === "INSUFFICIENT") {
    questions.push("What happened between the last recorded event and now?");
    questions.push("When did this condition or situation start?");
  }

  return {
    known,
    unknown,
    confidence,
    questions: [...new Set(questions)].slice(0, 5),
    completeness_score,
  };
}
