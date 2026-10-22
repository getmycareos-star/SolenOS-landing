import { normalizeBackendSituationResponse } from "./backend-response";

describe("normalizeBackendSituationResponse", () => {
  it("preserves persisted projection and analysis status without inventing events or claims", () => {
    const activeSituation = {
      id: "situation-1",
      caregiver_id: "caregiver-1",
      care_recipient_id: "person-1",
      observations: [{
        id: "evidence-1",
        raw_text: "Breakfast was mostly uneaten.",
        human_fact: "Breakfast was mostly uneaten.",
        captured_at: "2026-10-22T12:00:00.000Z",
        event_ids: ["event-1"],
      }],
    };
    const normalized = normalizeBackendSituationResponse({
      ok: true,
      message: "Care input recorded; analysis is incomplete.",
      analysis_status: "partial",
      analysis_warning: "Change and situation analysis could not be completed.",
      care_key: "client-care-key",
      care_recipient_id: "person-1",
      active_care_situation: activeSituation,
      active_care_situation_turn: { what_seems_happening: null },
      what_changed: "No confirmed change was established.",
      events: [{ id: "event-1", title: "Breakfast observation" }],
    });

    expect(normalized.analysis_status).toBe("partial");
    expect(normalized.analysis_warning).toContain("could not be completed");
    expect(normalized.care_key).toBe("client-care-key");
    expect(normalized.active_care_situation).toBe(activeSituation);
    expect(normalized.active_care_situation_turn).toBeUndefined();
    expect(normalized.what_changed).toEqual(["No confirmed change was established."]);
    expect(normalized.what_i_understood).toEqual([]);
    expect(normalized.events_created).toEqual([]);
  });

  it("rejects a malformed response instead of fabricating a fallback care record", () => {
    expect(() => normalizeBackendSituationResponse(null)).toThrow(
      "invalid capture response",
    );
    expect(() => normalizeBackendSituationResponse("saved")).toThrow(
      "invalid capture response",
    );
  });
});
