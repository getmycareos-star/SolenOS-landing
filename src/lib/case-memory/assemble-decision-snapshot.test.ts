import { assembleDecisionSnapshot } from "./assemble-decision-snapshot";

describe("case-memory snapshot evidence boundaries", () => {
  it("does not invent a previously successful intervention when none is recorded", () => {
    const snapshot = assembleDecisionSnapshot({
      caseEntity: {
        profile: { preferredName: null, displayName: "Care recipient" },
        understanding: { successfulInterventions: [] },
      } as any,
      facts: {
        events: [{ eventType: "wandering" }],
        conditions: [],
      } as any,
      policy: {
        state: "C",
        preferredIntervention: undefined,
        topEvents: [],
      } as any,
      rawInput: "Wandering is happening again",
    });

    expect(snapshot.what_matters_now).toMatch(/no previously successful intervention is recorded/i);
    expect(snapshot.what_matters_now).not.toMatch(/reduced agitation quickly|reduced escalation quickly|grounding object/i);
    expect(snapshot.follow_up_items[0]).toMatch(/do not assume an intervention is effective/i);
    expect(snapshot.risk_level).toBe("medium");
  });

  it("preserves explicit evidence-backed risk instead of raising or lowering it by policy state", () => {
    const snapshot = assembleDecisionSnapshot({
      caseEntity: {
        profile: { preferredName: null, displayName: "Care recipient" },
        understanding: { successfulInterventions: [] },
      } as any,
      facts: {
        events: [{ eventType: "wandering", riskLevel: "low" }],
        conditions: [{ name: "condition noted" }],
      } as any,
      policy: {
        state: "C",
        preferredIntervention: undefined,
        topEvents: [],
      } as any,
      rawInput: "Wandering is happening again",
    });

    expect(snapshot.risk_level).toBe("low");
  });
});
