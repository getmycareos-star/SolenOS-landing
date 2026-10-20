import type { CanonicalCareEvent } from "../situation-entry/types";
import type { ReasoningChain, ReasoningStep } from "./types";

export function buildReasoningChain(input: {
  question?: string | null;
  events: CanonicalCareEvent[];
  what_changed: string[];
  conclusion?: string;
}): ReasoningChain {
  const steps: ReasoningStep[] = [];
  let stepNum = 1;

  for (const event of input.events.slice(0, 5)) {
    steps.push({
      step: stepNum++,
      description: `${event.extracted_type.replace(/_/g, " ")} recorded: ${event.raw_input.slice(0, 80)}`,
      evidence_ids: [event.id],
    });
  }

  for (const change of input.what_changed.slice(0, 3)) {
    steps.push({
      step: stepNum++,
      description: change,
      evidence_ids: input.events.map((e) => e.id),
    });
  }

  const conclusion =
    input.conclusion ??
    (steps.length > 0
      ? "Answer generated from these validated CareEvents."
      : "No validated CareEvents available to support a conclusion.");

  return {
    question: input.question ?? null,
    steps,
    conclusion,
    evidence_event_ids: input.events.map((e) => e.id),
    generated_from: "validated_care_events",
  };
}

export function buildReasoningChains(input: {
  events_created: CanonicalCareEvent[];
  what_changed: string[];
  clarification_questions: string[];
}): ReasoningChain[] {
  const chains: ReasoningChain[] = [];

  if (input.what_changed.length > 0) {
    chains.push(
      buildReasoningChain({
        question: "What changed since the last input?",
        events: input.events_created,
        what_changed: input.what_changed,
      }),
    );
  }

  if (input.events_created.length > 0) {
    chains.push(
      buildReasoningChain({
        question: "What does SolenOS understand from this input?",
        events: input.events_created,
        what_changed: [],
        conclusion: `${input.events_created.length} CareEvent(s) structured from retrieved evidence.`,
      }),
    );
  }

  for (const q of input.clarification_questions.slice(0, 2)) {
    chains.push(
      buildReasoningChain({
        question: q,
        events: input.events_created,
        what_changed: [],
        conclusion: "Insufficient evidence to resolve — clarification needed.",
      }),
    );
  }

  return chains;
}

export function formatReasoningChain(chain: ReasoningChain): string {
  const lines = [
    chain.question ? `Question: ${chain.question}` : null,
    "Reasoning:",
    ...chain.steps.map((s) => `- ${s.description}`),
    chain.conclusion,
  ].filter(Boolean);
  return lines.join("\n");
}
