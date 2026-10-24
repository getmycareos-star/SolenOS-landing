import { afterEach, describe, expect, it } from "@jest/globals";
import { recordCareEvent } from "./record-care-event";
import { listCareEventsForCaregiver, resetCareEventStore } from "./store";

afterEach(() => resetCareEventStore());

describe("durable care event capture", () => {
  it("rejects unavailable persistence and does not cache an unsaved event", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(
        recordCareEvent({
          content: "test-only care event",
          created_by: "caregiver_persistence_test",
          provenance: { input_type: "text" },
        }),
      ).rejects.toThrow(/DATABASE_URL is not configured/i);
      expect(listCareEventsForCaregiver("caregiver_persistence_test")).toHaveLength(0);
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });
});
