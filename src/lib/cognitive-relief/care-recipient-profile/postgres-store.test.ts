import { createPostgresPool } from "../../telemetry-persistence/postgres-store";
import {
  loadProfileFromPostgres,
  resetCognitiveReliefPoolForTests,
  saveProfileToPostgres,
  tryLoadProfile,
  trySaveProfile,
} from "./postgres-store";
import { getOrCreateProfile, resetCareRecipientProfileStore } from "./store";

jest.mock("../../telemetry-persistence/postgres-store", () => ({
  createPostgresPool: jest.fn(),
}));

const mockedCreatePool = jest.mocked(createPostgresPool);

describe("care-recipient profile persistence truth", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    resetCognitiveReliefPoolForTests();
    resetCareRecipientProfileStore();
    jest.clearAllMocks();
    process.env.DATABASE_URL = "postgres://configured";
  });

  afterAll(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("does not claim a database record exists when storage is not configured", async () => {
    delete process.env.DATABASE_URL;
    await expect(tryLoadProfile("caregiver-1", null)).resolves.toBeNull();
    await expect(
      trySaveProfile({
        id: "crp_local",
        case_id: null,
        caregiver_id: "caregiver-1",
        profile: {
          care_recipient_basics: "",
          known_conditions: [],
          current_medications: [],
          key_dates: [],
          care_team: [],
          tagged_event_log: [],
          location_index: [],
        },
        care_context: "general",
        dementia_context: null,
        last_checkin_at: null,
        checkin_period: null,
        optional_budget: null,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      }),
    ).resolves.toBe("local_only");
  });

  it("propagates a configured database read failure instead of creating an empty profile", async () => {
    mockedCreatePool.mockResolvedValue({
      query: jest.fn().mockRejectedValue(new Error("connection refused")),
    } as never);

    await expect(tryLoadProfile("caregiver-1", null)).rejects.toThrow(
      "Care-recipient profile could not be loaded from the configured database",
    );
  });

  it("propagates a configured database write failure instead of reporting success", async () => {
    mockedCreatePool.mockResolvedValue({
      query: jest.fn().mockRejectedValue(new Error("write failed")),
    } as never);

    await expect(
      trySaveProfile({
        id: "crp_local",
        case_id: null,
        caregiver_id: "caregiver-1",
        profile: {
          care_recipient_basics: "",
          known_conditions: [],
          current_medications: [],
          key_dates: [],
          care_team: [],
          tagged_event_log: [],
          location_index: [],
        },
        care_context: "general",
        dementia_context: null,
        last_checkin_at: null,
        checkin_period: null,
        optional_budget: null,
        created_at: new Date(0).toISOString(),
        updated_at: new Date(0).toISOString(),
      }),
    ).rejects.toThrow("Care-recipient profile persistence failed");
  });

  it("caches a loaded database profile so update helpers target the loaded record", async () => {
    mockedCreatePool.mockResolvedValue({
      query: jest.fn().mockResolvedValue({
        rows: [{
          id: "db-profile-1",
          case_id: null,
          caregiver_id: "caregiver-1",
          profile: { care_recipient_basics: "Uses a walking frame" },
          care_context: "general",
          dementia_context: null,
          last_checkin_at: null,
          checkin_period: null,
          optional_budget: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        }],
      }),
    } as never);

    const loaded = await tryLoadProfile("caregiver-1", null);
    expect(loaded?.id).toBe("db-profile-1");
    const indexed = getOrCreateProfile({ caregiver_id: "caregiver-1" });
    expect(indexed.id).toBe("db-profile-1");
    expect(indexed.profile.care_recipient_basics).toBe("Uses a walking frame");
  });
});


describe("care-recipient profile case isolation", () => {
  const profile = (caseId: string | null) => ({
    id: "profile-existing",
    case_id: caseId,
    caregiver_id: "caregiver-1",
    profile: {
      care_recipient_basics: "",
      known_conditions: [],
      current_medications: [],
      key_dates: [],
      care_team: [],
      tagged_event_log: [],
      location_index: [],
    },
    care_context: "general" as const,
    dementia_context: null,
    last_checkin_at: null,
    checkin_period: null,
    optional_budget: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  });

  it("loads only the selected case, including an exact null-case match", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    await loadProfileFromPostgres(
      { query } as never,
      "caregiver-1",
      "11111111-1111-4111-8111-111111111111",
    );
    expect(query.mock.calls[0]?.[0]).toContain("case_id IS NOT DISTINCT FROM $2::uuid");
    expect(query.mock.calls[0]?.[1]).toEqual([
      "caregiver-1",
      "11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("uses case-aware upsert targets and never caregiver-only overwrite semantics", async () => {
    const query = jest.fn().mockResolvedValue({
      rows: [{
        id: "profile-existing",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-02T00:00:00.000Z",
      }],
    });
    const pool = { query } as never;

    await saveProfileToPostgres(
      pool,
      profile("11111111-1111-4111-8111-111111111111"),
    );
    await saveProfileToPostgres(pool, profile(null));

    expect(query.mock.calls[0]?.[0]).toContain(
      "ON CONFLICT (caregiver_id, case_id) WHERE case_id IS NOT NULL",
    );
    expect(query.mock.calls[1]?.[0]).toContain(
      "ON CONFLICT (caregiver_id) WHERE case_id IS NULL",
    );
    expect(query.mock.calls[0]?.[0]).not.toContain("ON CONFLICT (caregiver_id)\n");
  });
});
