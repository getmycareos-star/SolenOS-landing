import { afterEach, describe, expect, it } from "@jest/globals";
import { recordCareJourneyEvent } from "./record";
import { listCareJourneyEventsForCaregiver, resetCareJourneyStore } from "./store";

afterEach(() => resetCareJourneyStore());

describe("durable care journey", () => {
  it("does not fall back to an in-memory timeline when Postgres is unavailable", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(
        recordCareJourneyEvent({
          caregiver_id: "caregiver_journey_persistence_test",
          description: "test-only journey event",
        }),
      ).rejects.toThrow(/DATABASE_URL is not configured/i);
      expect(listCareJourneyEventsForCaregiver("caregiver_journey_persistence_test")).toHaveLength(0);
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });
});
