import { afterEach, describe, expect, it } from "@jest/globals";
import { trySaveGraphEvent } from "./postgres-store";
import {
  getGraphForCaregiver,
  getOrCreateGraph,
  resetCareJourneyGraphStore,
  restoreGraphForCaregiver,
} from "./graph-store";

afterEach(() => resetCareJourneyGraphStore());

describe("durable care journey graph", () => {
  it("rejects unavailable database writes", async () => {
    const originalDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      await expect(trySaveGraphEvent({} as never, [])).rejects.toThrow(/DATABASE_URL is not configured/i);
    } finally {
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it("restores the prior graph snapshot after a failed write", () => {
    getOrCreateGraph("caregiver_graph_rollback_test", null);
    expect(getGraphForCaregiver("caregiver_graph_rollback_test", null)).toBeDefined();
    restoreGraphForCaregiver("caregiver_graph_rollback_test", null, null);
    expect(getGraphForCaregiver("caregiver_graph_rollback_test", null)).toBeUndefined();
  });
});
