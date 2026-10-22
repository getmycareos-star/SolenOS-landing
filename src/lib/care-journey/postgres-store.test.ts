import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import { resetCareJourneyPoolForTests, tryLoadCareJourneyEvents, trySaveCareJourneyEvent } from "./postgres-store";

jest.mock("../telemetry-persistence/postgres-store", () => ({ createPostgresPool: jest.fn() }));
const mockedCreatePool = jest.mocked(createPostgresPool);

describe("care-journey database failure policy", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  beforeEach(() => {
    resetCareJourneyPoolForTests();
    jest.clearAllMocks();
    process.env.DATABASE_URL = "postgres://configured";
  });
  afterAll(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("surfaces timeline read failures instead of falling back to memory", async () => {
    mockedCreatePool.mockResolvedValue({ query: jest.fn().mockRejectedValue(new Error("offline")) } as never);
    await expect(tryLoadCareJourneyEvents("caregiver-1")).rejects.toThrow(
      "Care journey history could not be loaded from the configured database",
    );
  });

  it("surfaces timeline write failures instead of returning null", async () => {
    mockedCreatePool.mockResolvedValue({ query: jest.fn().mockRejectedValue(new Error("offline")) } as never);
    await expect(trySaveCareJourneyEvent({
      caregiver_id: "caregiver-1",
      description: "Follow-up appointment scheduled",
    })).rejects.toThrow("Care journey persistence failed");
  });
});
