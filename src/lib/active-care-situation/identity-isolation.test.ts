import { afterEach, describe, expect, it } from "@jest/globals";
import type { ActiveCareSituation } from "./types";
import {
  clearActiveCareSituation,
  getActiveCareSituation,
} from "./ingest";
import { persistActiveCareSituationToDurable } from "./durable-store";

const RECIPIENT = "recipient_acs_identity_isolation_test";
const CAREGIVER = "caregiver_acs_identity_isolation_test";

afterEach(() => {
  clearActiveCareSituation(RECIPIENT);
});

describe("Active Care Situation identity isolation", () => {
  it("loads a situation only by its care-recipient key, not an unrelated caregiver ID", () => {
    const situation = {
      id: "acs_identity_isolation_test",
      care_recipient_id: RECIPIENT,
      caregiver_id: CAREGIVER,
      observations: [],
    } as unknown as ActiveCareSituation;

    persistActiveCareSituationToDurable(situation);

    expect(getActiveCareSituation(RECIPIENT)?.care_recipient_id).toBe(RECIPIENT);
    expect(getActiveCareSituation("unlinked_caregiver_acs_test")).toBeNull();
  });

  it("does not accept a default recipient key", () => {
    expect(() => getActiveCareSituation("default_caregiver")).toThrow(/invalid|explicit|identity/i);
  });
});
