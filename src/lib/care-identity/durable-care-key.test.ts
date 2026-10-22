import {
  ensureClientDurableCareKey,
  requireCareKeyFromRequest,
  resolveDurableCareKey,
} from "./durable-care-key";
import { getOrCreateCaregiverSelfProfile } from "../capacity-self/caregiver-profile/store";
import { getOrCreateProfile } from "../cognitive-relief/care-recipient-profile/store";
import { recordObservation, getObservationExport } from "../observation-intelligence";
import { getOrCreateGraph, getGraphForCaregiver, resetCareJourneyGraphStore } from "../care-journey-graph/graph-store";
import { createCareEvent, resetCareEventStore } from "../care-events/store";

describe("identity isolation boundaries", () => {
  afterEach(() => {
    resetCareJourneyGraphStore();
    resetCareEventStore();
  });

  it("never resolves a missing caregiver from a session ID", () => {
    expect(() => resolveDurableCareKey({ care_session_id: "sess_abc" })).toThrow(/explicit caregiver identity/i);
    expect(() => resolveDurableCareKey({ care_session_id: "legacy-key" })).toThrow(/session IDs cannot identify/i);
    expect(requireCareKeyFromRequest({ care_session_id: "legacy-key" }).ok).toBe(false);
  });

  it("discards the legacy shared identity rather than reusing it", () => {
    const key = ensureClientDurableCareKey("default_caregiver");
    expect(key).toMatch(/^care_/);
    expect(key).not.toBe("default_caregiver");
  });

  it("refuses to create caregiver-scoped stores without a valid identity", () => {
    expect(() => getOrCreateCaregiverSelfProfile("")).toThrow(/caregiver identity/i);
    expect(() => getOrCreateCaregiverSelfProfile("default_caregiver")).toThrow(/caregiver identity/i);
    expect(() => getOrCreateProfile({ caregiver_id: "default_caregiver" })).toThrow(/caregiver identity/i);
    expect(() => getOrCreateGraph("default_caregiver", null)).toThrow(/caregiver identity/i);
    expect(getGraphForCaregiver("default_caregiver")).toBeUndefined();
  });

  it("refuses un-attributed observations and care events", () => {
    expect(() => recordObservation({ caregiver_id: "", raw_text: "care note" })).toThrow(/caregiver identity/i);
    expect(() => getObservationExport("")).toThrow(/caregiver identity/i);
    expect(() =>
      createCareEvent({
        content: "care note",
        provenance: { input_type: "text" },
      } as any),
    ).toThrow(/caregiver attribution/i);
  });
});
