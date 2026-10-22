import {
  resetCapacitySelfPoolForTests,
  tryLoadCaregiverSelfProfile,
  trySaveCaregiverSelfProfile,
} from "./postgres-store";
import { createPostgresPool } from "../../telemetry-persistence/postgres-store";

jest.mock("../../telemetry-persistence/postgres-store", () => ({
  createPostgresPool: jest.fn(),
}));

const createPoolMock = createPostgresPool as jest.MockedFunction<typeof createPostgresPool>;

describe("configured profile storage failures", () => {
  const oldUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://configured";
    resetCapacitySelfPoolForTests();
    createPoolMock.mockReset();
    createPoolMock.mockResolvedValue({
      query: jest.fn().mockRejectedValue(new Error("storage unavailable")),
    } as never);
  });

  afterAll(() => {
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
  });

  it("rejects reads when the configured database is unavailable", async () => {
    await expect(tryLoadCaregiverSelfProfile("caregiver_test")).rejects.toThrow(
      /could not be loaded from the configured database/i,
    );
  });

  it("rejects writes when the configured database cannot confirm the save", async () => {
    const record = {
      id: "csp_test",
      caregiver_id: "caregiver_test",
      profile: {},
      session_capacity: null,
      resolved_items: [],
      created_at: "2026-10-22T00:00:00.000Z",
      updated_at: "2026-10-22T00:00:00.000Z",
    } as never;
    await expect(trySaveCaregiverSelfProfile(record)).rejects.toThrow(
      /persistence failed.*did not confirm the save/i,
    );
  });
});
