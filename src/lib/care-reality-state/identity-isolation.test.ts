import { afterEach, describe, expect, it } from "@jest/globals";
import type { CareRealityState } from "./types";
import {
  clearCareRealityState,
  getCareRealityState,
  updateCareRealityState,
} from "./process";
import { persistCareRealityStateToDurable } from "./durable-store";

const RECIPIENT = "recipient_identity_isolation_test";
const CAREGIVER = "caregiver_identity_isolation_test";

afterEach(() => {
  clearCareRealityState(RECIPIENT);
});

describe("Care Reality State identity isolation", () => {
  it("does not resolve another caregiver ID as a care-recipient storage key", () => {
    const state = {
      id: "crs_identity_isolation_test",
      care_recipient_id: RECIPIENT,
      caregiver_id: CAREGIVER,
      current_understanding: [],
      supporting_evidence: [],
      understanding_revisions: [],
      open_uncertainties: [],
      resolved_uncertainties: [],
      continuity_hooks: [],
    } as unknown as CareRealityState;

    persistCareRealityStateToDurable(state);

    expect(getCareRealityState(RECIPIENT)?.care_recipient_id).toBe(RECIPIENT);
    expect(getCareRealityState("unlinked_caregiver_identity_test")).toBeNull();
  });

  it("rejects a state mutation when caregiver-to-recipient mapping does not authorize it", () => {
    expect(() =>
      updateCareRealityState({
        caregiverId: "unlinked_caregiver_identity_test",
        situation: { care_recipient_id: RECIPIENT } as never,
      } as never),
    ).toThrow(/not linked to this care recipient/i);
  });

  it("rejects default identities", () => {
    expect(() => getCareRealityState("default_caregiver")).toThrow(/explicit care-recipient identity/i);
  });
});
