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
import { retrieveHistoricalContext } from "../care-record/retrieve";
import { isObservationDurablyPersisted } from "../voice-observation/persistence-guard";
import { tryLoadCaregiverSelfProfile } from "../capacity-self/caregiver-profile/postgres-store";
import { tryLoadProfile } from "../cognitive-relief/care-recipient-profile/postgres-store";
import { resetCareJourneyStore, listCareJourneyEventsForCaregiver } from "../care-journey/store";
import { tryLoadCareJourneyEvents } from "../care-journey/postgres-store";
import { tryLoadGraphForCaregiver } from "../care-journey-graph/postgres-store";
import { tryPersistCareEvent, tryLoadCareEventsForCaregiver } from "../care-events/postgres-store";

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
    expect(ensureClientDurableCareKey("DEFAULT_CAREGIVER")).toMatch(/^care_/);
  });

  it("never promotes an interaction session ID to a durable caregiver key", () => {
    const key = ensureClientDurableCareKey("sess_legacy_session");
    expect(key).toMatch(/^care_/);
    expect(key).not.toBe("sess_legacy_session");
  });

  it("refuses shared placeholders and interaction-session IDs across caregiver-scoped stores", () => {
    for (const invalidId of ["", "default_caregiver", "DEFAULT_CAREGIVER", "sess_legacy_session"]) {
      expect(() => getOrCreateCaregiverSelfProfile(invalidId)).toThrow(/caregiver identity/i);
      expect(() => getOrCreateProfile({ caregiver_id: invalidId })).toThrow(/caregiver identity/i);
      expect(() => getOrCreateGraph(invalidId, null)).toThrow(/caregiver identity/i);
      expect(getGraphForCaregiver(invalidId)).toBeUndefined();
      expect(() => getObservationExport(invalidId)).toThrow(/caregiver identity/i);
      expect(() => listCareEventsForCaregiver(invalidId)).toThrow(/caregiver identity/i);
      expect(() => createCareEvent({
        content: "test note",
        created_by: invalidId,
        provenance: { input_type: "text" },
      } as any)).toThrow(/caregiver identity|caregiver attribution/i);
    }
  });


  it("does not report process-memory observations as durably persisted", () => {
    const result = recordObservation({
      caregiver_id: "cg_persistence_test",
      raw_text: "Test-only observation",
      source: "text",
    });
    expect(result.persistence_status).toBe("unavailable");
    expect(result.persistence_message).toMatch(/process memory|not durably saved/i);
    expect(() => getObservationExport("default_caregiver")).toThrow(/distinct caregiver identity/i);
  });

  it("refuses un-attributed observations and care events", () => {
    expect(() => recordObservation({ caregiver_id: "", raw_text: "care note" })).toThrow(/caregiver identity/i);
    expect(() => getObservationExport("")).toThrow(/caregiver identity/i);
    expect(() =>
      createCareEvent({
        content: "care note",
        provenance: { input_type: "text" },
      } as any),
    ).toThrow(/caregiver identity|caregiver attribution/i);
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
      await expect(tryLoadCareJourneyEvents("cg_db_unavailable")).rejects.toThrow(/DATABASE_URL is not configured/i);
      await expect(tryLoadGraphForCaregiver("cg_db_unavailable")).rejects.toThrow(/DATABASE_URL is not configured/i);
      await expect(tryLoadCareEventsForCaregiver("cg_db_unavailable")).rejects.toThrow(/DATABASE_URL is not configured/i);
      await expect(tryPersistCareEvent({
        content: "verification event",
        created_by: "cg_db_unavailable",
        provenance: { input_type: "text" },
      })).rejects.toThrow(/DATABASE_URL is not configured/i);
      expect(listCareJourneyEventsForCaregiver("cg_db_unavailable")).toHaveLength(0);
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
