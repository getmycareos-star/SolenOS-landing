import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import { getMemorySolenEvents, insertSolenEvent, resetSolenEventsMemoryForTests } from "./insert-event";

jest.mock("../telemetry-persistence/postgres-store", () => ({ createPostgresPool: jest.fn() }));
const mockedCreatePool = jest.mocked(createPostgresPool);

describe("ops telemetry persistence status", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    resetSolenEventsMemoryForTests();
    jest.clearAllMocks();
    delete process.env.DATABASE_URL;
  });

  afterAll(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  const input = {
    user_id: "user-1",
    event_name: "page_view",
    session_id: "session-1",
    metadata: {},
  };

  it("labels memory-only telemetry as non-durable", async () => {
    const result = await insertSolenEvent(input);
    expect(result).toEqual({ success: true, persistence_status: "memory_only" });
    expect(getMemorySolenEvents()).toHaveLength(1);
  });

  it("labels telemetry server-persisted only after PostgreSQL confirms the insert", async () => {
    process.env.DATABASE_URL = "postgres://configured";
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    mockedCreatePool.mockResolvedValue({ query } as never);

    const result = await insertSolenEvent(input);
    expect(result).toEqual({ success: true, persistence_status: "server_persisted" });
    expect(getMemorySolenEvents()).toHaveLength(0);
  });

  it("retains non-blocking telemetry but reports memory-only when configured PostgreSQL fails", async () => {
    process.env.DATABASE_URL = "postgres://configured";
    mockedCreatePool.mockResolvedValue({
      query: jest.fn().mockRejectedValue(new Error("database unavailable")),
    } as never);

    const result = await insertSolenEvent(input);
    expect(result).toEqual({ success: true, persistence_status: "memory_only" });
    expect(getMemorySolenEvents()).toHaveLength(1);
  });

  it("does not throw to product callers if pool creation fails", async () => {
    process.env.DATABASE_URL = "postgres://configured";
    mockedCreatePool.mockRejectedValue(new Error("connection failed"));

    await expect(insertSolenEvent(input)).resolves.toEqual({
      success: true,
      persistence_status: "memory_only",
    });
    expect(getMemorySolenEvents()).toHaveLength(1);
  });
});
