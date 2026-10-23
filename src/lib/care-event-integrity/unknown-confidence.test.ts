import { createIntegrityState } from "./lifecycle";

describe("uncalibrated event confidence", () => {
  it("preserves unknown rather than assigning a synthetic numeric confidence", () => {
    const integrity = createIntegrityState({ confidenceScore: null, originalExtraction: "caregiver text" });
    expect(integrity.field_confidence.extracted_fact).toEqual({
      extraction: "unknown",
      user_confirmed: false,
    });
    expect(integrity.field_confidence.event_time).toEqual({
      extraction: "unknown",
      user_confirmed: false,
    });
  });
});
