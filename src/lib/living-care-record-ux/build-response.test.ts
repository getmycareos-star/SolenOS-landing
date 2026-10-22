import { buildLivingCareRecordResponse } from "./build-response";
import type { SituationResponse } from "../situation-entry";

describe("Living Care Record source-of-truth boundary", () => {
  it("refuses to synthesize an Active Care Situation when the pipeline omitted one", () => {
    const incomplete = {
      events_created: [],
      what_i_understood: [],
      what_is_uncertain: [],
      what_needs_clarification: [],
      what_will_be_tracked: [],
      what_changed: [],
      what_merged_or_split: [],
      context: { caregiver_id: "caregiver-1" },
      care_key: "caregiver-1",
    } as unknown as SituationResponse;

    expect(() =>
      buildLivingCareRecordResponse({
        response: incomplete,
        rawInput: "Breakfast was mostly uneaten.",
      }),
    ).toThrow("A persisted Active Care Situation is required");
  });
});
