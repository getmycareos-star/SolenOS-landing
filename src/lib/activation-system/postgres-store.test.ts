import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import {
  resetActivationPoolForTests,
  tryLoadUserStateFromPostgres,
  trySaveEventToPostgres,
  trySaveUserStateToPostgres,
} from "./postgres-store";

jest.mock("../telemetry-persistence/postgres-store", () => ({ createPostgresPool: jest.fn() }));
const mockedCreatePool = jest.mocked(createPostgresPool);

describe("activation persistence failure policy", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  beforeEach(() => {
    resetActivationPoolForTests();
    jest.clearAllMocks();
    process.env.DATABASE_URL = "postgres://configured";
  });
  afterAll(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("surfaces state read failures instead of using an empty state", async () => {
    mockedCreatePool.mockResolvedValue({ query: jest.fn().mockRejectedValue(new Error("offline")) } as never);
    await expect(tryLoadUserStateFromPostgres("user-1")).rejects.toThrow(
      "Activation state could not be loaded from the configured database",
    );
  });

  it("surfaces state write failures", async () => {
    mockedCreatePool.mockResolvedValue({ query: jest.fn().mockRejectedValue(new Error("offline")) } as never);
    await expect(trySaveUserStateToPostgres({
      user_id: "user-1",
      total_entries: 1,
      first_entry_at: null,
      last_entry_at: null,
      voice_entry_count: 0,
      document_entry_count: 0,
      trust_stage: "early",
      habit_hour: null,
      updated_at: new Date(0).toISOString(),
    })).rejects.toThrow("Activation state persistence failed");
  });

  it("surfaces event write failures", async () => {
    mockedCreatePool.mockResolvedValue({ query: jest.fn().mockRejectedValue(new Error("offline")) } as never);
    await expect(trySaveEventToPostgres({
      id: "event-1",
      user_id: "user-1",
      event_type: "ENTRY_CREATED",
      payload: {},
      created_at: new Date(0).toISOString(),
    })).rejects.toThrow("Activation event persistence failed");
  });
});
