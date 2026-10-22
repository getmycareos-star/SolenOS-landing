import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import { resetCareJourneyGraphPoolForTests, tryLoadGraphForCaregiver, trySaveGraphEvent } from "./postgres-store";

jest.mock("../telemetry-persistence/postgres-store", () => ({ createPostgresPool: jest.fn() }));
const mockedCreatePool = jest.mocked(createPostgresPool);

describe("care-journey graph database failure policy", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  beforeEach(() => {
    resetCareJourneyGraphPoolForTests();
    jest.clearAllMocks();
    process.env.DATABASE_URL = "postgres://configured";
  });
  afterAll(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("surfaces graph read failures instead of treating them as an absent graph", async () => {
    mockedCreatePool.mockResolvedValue({ query: jest.fn().mockRejectedValue(new Error("offline")) } as never);
    await expect(tryLoadGraphForCaregiver("caregiver-1")).rejects.toThrow(
      "Care journey graph could not be loaded from the configured database",
    );
  });

  it("surfaces graph write failures instead of returning false", async () => {
    mockedCreatePool.mockResolvedValue({ query: jest.fn().mockRejectedValue(new Error("offline")) } as never);
    await expect(trySaveGraphEvent({} as never, [])).rejects.toThrow("Care journey graph persistence failed");
  });
});
