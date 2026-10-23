import type { CareSituationUnderstanding } from "./types";

export type NextStepKind = "ask" | "check" | "monitor" | "do";

export type NextStepGuidance = {
  kind: NextStepKind;
  message: string;
  /** The exact held understanding items that justify this guidance. */
  source_basis: string[];
  certainty: "evidence-linked" | "needs-confirmation";
};

const MAX_GUIDANCE = 3;
const SENSITIVE_ACTION_PATTERN =
  /\b(?:medication|medicine|prescription|dose|dosage|start|stop|increase|decrease|change treatment|administer)\b/i;

/**
 * Translate structured care understanding into a small, evidence-linked next step.
 *
 * This is deliberately conservative: no diagnosis, causal claim, urgency escalation,
 * new treatment instruction, or action inferred from a topic keyword. The only "do"
 * item can repeat a held decision that is not medication/treatment-related, and it
 * still requires that the recorded decision remains current and authorized.
 */
export function buildNextStepGuidance(
  understanding: CareSituationUnderstanding,
): NextStepGuidance[] {
  if (!understanding.can_orient) return [];

  const output: NextStepGuidance[] = [];
  const seen = new Set<string>();
  const add = (item: NextStepGuidance) => {
    const key = item.kind + ":" + item.message.toLowerCase();
    if (seen.has(key) || !item.message.trim() || item.source_basis.length === 0) return;
    seen.add(key);
    output.push(item);
  };

  const nextQuestion =
    understanding.follow_up_questions.find((question) => question.trim()) ??
    understanding.unknowns.find((unknown) => unknown.trim());

  if (nextQuestion) {
    const question = /\?\s*$/.test(nextQuestion.trim())
      ? nextQuestion.trim()
      : `What is known about ${nextQuestion.trim().replace(/[.?!]+$/, "")}?`;
    add({
      kind: "ask",
      message: question,
      source_basis: [nextQuestion],
      certainty: "needs-confirmation",
    });
  }

  const uncertainSource = understanding.interpretations[0];
  if (uncertainSource) {
    add({
      kind: "check",
      message: "Check the original report with the person who provided it before treating this interpretation as established.",
      source_basis: [uncertainSource.text],
      certainty: "needs-confirmation",
    });
  } else if (understanding.unknowns.length > 0 && nextQuestion) {
    const remainingUnknown = understanding.unknowns.find(
      (unknown) => unknown.trim() && unknown.trim() !== nextQuestion.trim(),
    );
    if (remainingUnknown) {
      add({
        kind: "check",
        message: `Confirm what is recorded about ${remainingUnknown.trim().replace(/[.?!]+$/, "")}.`,
        source_basis: [remainingUnknown],
        certainty: "needs-confirmation",
      });
    }
  }

  const continuity = understanding.continuity_hooks[0] ??
    understanding.changes_from_baseline[0];
  if (continuity) {
    add({
      kind: "monitor",
      message: `Keep track of whether this changes or continues: ${continuity.trim()}`,
      source_basis: [continuity],
      certainty: "evidence-linked",
    });
  }

  const explicitDecision = understanding.facts.find(
    (fact) => fact.kind === "decision" && fact.text.trim() &&
      !SENSITIVE_ACTION_PATTERN.test(fact.text),
  );
  if (explicitDecision && output.length < MAX_GUIDANCE) {
    add({
      kind: "do",
      message: `Use the recorded decision only if it is still current and authorized: ${explicitDecision.text.trim()}`,
      source_basis: [explicitDecision.text],
      certainty: "needs-confirmation",
    });
  }

  return output.slice(0, MAX_GUIDANCE);
}
