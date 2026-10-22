import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import { resetCareEventPoolForTests, tryLoadCareEventsForCaregiver, tryPersistCareEvent } from "./postgres-store";

jest.mock("../telemetry-persistence/postgres-store", () => ({ createPostgresPool: jest.fn() }));
const mockedCreatePool = jest.mocked(createPostgresPool);

describe("care-event database failure policy", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  beforeEach(() => {
    resetCareEventPoolForTests();
    jest.clearAllMocks();
    process.env.DATABASE_URL = "postgres://configured";
  });
  afterAll(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("does not turn a configured database read failure into an empty timeline", async () => {
    mockedCreatePool.mockResolvedValue({ query: jest.fn().mockRejectedValue(new Error("offline")) } as never);
    await expect(tryLoadCareEventsForCaregiver("caregiver-1")).rejects.toThrow(
      "Care-event history could not be loaded from the configured database",
    );
  });

  it("does not turn a configured database write failure into a missing event", async () => {
    mockedCreatePool.mockResolvedValue({ connect: jest.fn().mockRejectedValue(new Error("offline")) } as never);
    await expect(tryPersistCareEvent({
      content: "Breakfast mostly uneaten",
      provenance: { input_type: "text", captured_at: "2026-10-22T12:00:00.000Z" },
    })).rejects.toThrow("Care event persistence failed");
  });
});
