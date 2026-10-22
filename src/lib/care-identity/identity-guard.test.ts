import { recordObservation } from "../observation-intelligence";
import {
  saveObservation,
  listObservationsForCaregiver,
} from "../observation-intelligence/stores/observation-store";
import { ingestCareEntry } from "../cognitive-relief/ingest-entry";
import { processCapacitySelfSession } from "../capacity-self/process-session";
import { linkCaregiverToRecipient, resolveCareRealityStoreKey } from "../multi-caregiver-context-model";

describe("production caregiver identity guards", () => {
  it("rejects the legacy shared identity before recording observations", () => {
    expect(() =>
      recordObservation({
        caregiver_id: "default_caregiver",
        raw_text: "identity isolation regression",
      }),
    ).toThrow(/distinct caregiver identity/i);

    expect(() =>
      saveObservation("default_caregiver", "identity isolation regression", "text", []),
    ).toThrow(/distinct caregiver identity/i);

    expect(() => listObservationsForCaregiver("default_caregiver")).toThrow(
      /distinct caregiver identity/i,
    );
  });

  it("rejects the legacy shared identity before creating cognitive-relief profiles", async () => {
    await expect(
      ingestCareEntry({
        caregiver_id: "default_caregiver",
        content: "identity isolation regression",
        raw_entry_id: "test-only-entry",
      }),
    ).rejects.toThrow(/distinct caregiver identity/i);
  });

  it("rejects the legacy shared identity before creating capacity-self profiles", async () => {
    await expect(
      processCapacitySelfSession({
        caregiver_id: "default_caregiver",
        input: "identity isolation regression",
      }),
    ).rejects.toThrow(/distinct caregiver identity/i);
  });


  it("rejects the legacy shared care-recipient placeholder", () => {
    expect(() => resolveCareRealityStoreKey("default_care_recipient")).toThrow(
      /distinct care-recipient or linked contributor identity/i,
    );
    expect(() =>
      linkCaregiverToRecipient("caregiver-real-1", "default_care_recipient"),
    ).toThrow(/distinct care-recipient identity/i);
    expect(() =>
      linkCaregiverToRecipient("default_caregiver", "cr_recipient-real-1"),
    ).toThrow(/distinct contributor identity/i);
  });

  it("rejects missing identities in all three production entry points", async () => {
    expect(() =>
      recordObservation({ caregiver_id: "", raw_text: "identity isolation regression" }),
    ).toThrow(/distinct caregiver identity/i);

    await expect(
      ingestCareEntry({ caregiver_id: "", content: "identity isolation regression", raw_entry_id: "test-only-entry" }),
    ).rejects.toThrow(/distinct caregiver identity/i);

    await expect(
      processCapacitySelfSession({ caregiver_id: "", input: "identity isolation regression" }),
    ).rejects.toThrow(/distinct caregiver identity/i);
  });
});
