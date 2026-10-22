import {
  ensureClientDurableCareKey,
  requireCareKeyFromRequest,
  resolveDurableCareKey,
} from "./durable-care-key";
import { getOrCreateCaregiverSelfProfile } from "../capacity-self/caregiver-profile/store";
import { getOrCreateProfile } from "../cognitive-relief/care-recipient-profile/store";
import { recordObservation, getObservationExport, resetObservationStore } from "../observation-intelligence";
import { getOrCreateGraph, getGraphForCaregiver, resetCareJourneyGraphStore } from "../care-journey-graph/graph-store";
import { createCareEvent, resetCareEventStore, listCareEventsForCaregiver } from "../care-events/store";
import { recordCareEvent } from "../care-events/record-care-event";
import { retrieveHistoricalContext } from "../care-record/retrieve";
import { isObservationDurablyPersisted } from "../voice-observation/persistence-guard";
import { tryLoadCaregiverSelfProfile } from "../capacity-self/caregiver-profile/postgres-store";
import { tryLoadProfile } from "../cognitive-relief/care-recipient-profile/postgres-store";
import { recordCareJourneyEvent } from "../care-journey/server";
import { resetCareJourneyStore, listCareJourneyEventsForCaregiver } from "../care-journey/store";
import { processCareJourneyInputAsync } from "../care-journey-graph/server";

describe("identity isolation boundaries", () => {
  afterEach(() => {
    resetCareJourneyGraphStore();
    resetCareEventStore();
    resetCareJourneyStore();
    resetObservationStore();
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

  it("does not report an observation as saved when durable persistence is not wired", async () => {
    const result = recordObservation({
      caregiver_id: "cg_persistence_test",
      raw_text: "caregiver-entered verification note",
    });
    expect(result.persistence_status).toBe("unavailable");
    expect(result.persistence_message).toMatch(/not durably saved/i);

    expect(isObservationDurablyPersisted(result.persistence_status)).toBe(false);
    expect(isObservationDurablyPersisted(undefined)).toBe(false);
    expect(isObservationDurablyPersisted("persisted")).toBe(true);
  });

  it("distinguishes database unavailable from an empty profile or timeline", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(tryLoadCaregiverSelfProfile("cg_db_unavailable")).rejects.toThrow(/DATABASE_URL is not configured/i);
      await expect(tryLoadProfile("cg_db_unavailable", null)).rejects.toThrow(/DATABASE_URL is not configured/i);

      await expect(
        recordCareJourneyEvent({
          caregiver_id: "cg_db_unavailable",
          description: "verification record must not be memory-only",
        }),
      ).rejects.toThrow(/DATABASE_URL is not configured/i);
      expect(listCareJourneyEventsForCaregiver("cg_db_unavailable")).toHaveLength(0);

      await expect(
        processCareJourneyInputAsync({
          caregiver_id: "cg_db_unavailable",
          description: "verification graph must not report a memory-only save",
        }),
      ).rejects.toThrow(/DATABASE_URL is not configured/i);
      expect(getGraphForCaregiver("cg_db_unavailable")).toBeUndefined();
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("does not report an in-memory care event as durably recorded", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(
        recordCareEvent({
          content: "verification care event",
          created_by: "cg_no_database",
          provenance: { input_type: "text" },
        }),
      ).rejects.toThrow(/DATABASE_URL is not configured/i);
      expect(listCareEventsForCaregiver("cg_no_database")).toHaveLength(0);
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("does not label an empty historical result as evidence-backed", () => {
    expect(retrieveHistoricalContext([], "caregiver query")).toMatchObject({
      matches: [],
      evidence_backed: false,
      status: "no_matches",
    });
  });
