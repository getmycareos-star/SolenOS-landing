import { describe, expect, it } from "@jest/globals";
import type { CareSituationUnderstanding } from "./types";
import { buildNextStepGuidance } from "./next-step-guidance";

function understanding(
  overrides: Partial<CareSituationUnderstanding> = {},
): CareSituationUnderstanding {
  return {
    care_recipient: null,
    facts: [],
    interpretations: [],
    unknowns: [],
    possible_links: [],
    changes_from_baseline: [],
    matters_now: [],
    can_wait: [],
    follow_up_questions: [],
    context_only: [],
    continuity_hooks: [],
    can_orient: true,
    instant_path: true,
    confidence: "medium",
    ...overrides,
  };
}

describe("buildNextStepGuidance", () => {
  it("returns no actions when the held understanding cannot orient", () => {
    expect(buildNextStepGuidance(understanding({ can_orient: false }))).toEqual([]);
  });

  it("asks from an explicit open question and preserves its source basis", () => {
    const result = buildNextStepGuidance(understanding({
      unknowns: ["When did the change begin?"],
      follow_up_questions: ["When did the change begin?"],
    }));
    expect(result[0]).toMatchObject({
      kind: "ask",
      message: "When did the change begin?",
      source_basis: ["When did the change begin?"],
      certainty: "needs-confirmation",
    });
  });

  it("checks interpretations without promoting them to facts", () => {
    const result = buildNextStepGuidance(understanding({
      interpretations: [{ text: "The new routine may be affecting sleep", reason: "possible_link" }],
    }));
    expect(result[0]?.kind).toBe("check");
    expect(result[0]?.source_basis).toContain("The new routine may be affecting sleep");
  });

  it("monitors a real continuity hook instead of inventing a generic task", () => {
    const result = buildNextStepGuidance(understanding({
      continuity_hooks: ["Whether the reported change continues"],
    }));
    expect(result).toContainEqual(expect.objectContaining({
      kind: "monitor",
      source_basis: ["Whether the reported change continues"],
    }));
  });

  it("does not turn medication-related decisions into do instructions", () => {
    const result = buildNextStepGuidance(understanding({
      facts: [{ kind: "decision", text: "Increase medication dose", source_fragment: "Increase medication dose" }],
    }));
    expect(result.some((item) => item.kind === "do")).toBe(false);
  });

  it("only offers do when a non-treatment decision is already held", () => {
    const result = buildNextStepGuidance(understanding({
      facts: [{ kind: "decision", text: "Family agreed to update the shared handoff", source_fragment: "Family agreed to update the shared handoff" }],
    }));
    expect(result).toContainEqual(expect.objectContaining({
      kind: "do",
      source_basis: ["Family agreed to update the shared handoff"],
    }));
  });
});
