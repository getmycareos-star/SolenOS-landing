import { join } from "path";
import { createPostgresPool } from "../telemetry-persistence/postgres-store";
import { RawEvidenceStore } from "./store";
import type { RawEvidence } from "./types";

jest.mock("fs", () => {
  const actual = jest.requireActual("fs");
  return {
    ...actual,
    existsSync: jest.fn(() => false),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(),
    readdirSync: jest.fn(() => []),
    rmSync: jest.fn(),
    writeFileSync: jest.fn(),
  };
});
jest.mock("../telemetry-persistence/postgres-store", () => ({ createPostgresPool: jest.fn() }));

const fsMock = jest.requireMock("fs") as {
  existsSync: jest.Mock;
  mkdirSync: jest.Mock;
  readFileSync: jest.Mock;
  readdirSync: jest.Mock;
  rmSync: jest.Mock;
  writeFileSync: jest.Mock;
};
const mockedCreatePool = jest.mocked(createPostgresPool);

const input = {
  id: "evidence-1",
  caregiver_id: "caregiver-1",
  input_type: "text" as const,
  content: "Breakfast was mostly uneaten.",
  captured_at: "2026-10-22T12:00:00.000Z",
};

describe("raw evidence persistence truth", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
    jest.clearAllMocks();
    fsMock.existsSync.mockReturnValue(false);
    fsMock.readdirSync.mockReturnValue([]);
    fsMock.writeFileSync.mockImplementation(() => undefined);
    fsMock.mkdirSync.mockImplementation(() => undefined);
    mockedCreatePool.mockReset();
  });

  afterAll(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  });

  it("reports local_queued only after the queue file write succeeds", async () => {
    const result = await new RawEvidenceStore({ pool: null }).save(input);
    expect(result.persisted).toBe(true);
    expect(result.persistence_status).toBe("local_queued");
  });

  it("reports memory_only when both configured storage and local queue are unavailable", async () => {
    fsMock.writeFileSync.mockImplementation(() => {
      throw new Error("filesystem unavailable");
    });
    const result = await new RawEvidenceStore({ pool: null }).save(input);
    expect(result.persisted).toBe(false);
    expect(result.persistence_status).toBe("memory_only");
  });

  it("lazily connects to configured PostgreSQL and reports server_persisted only after the write", async () => {
    process.env.DATABASE_URL = "postgres://configured";
    fsMock.writeFileSync.mockImplementation(() => {
      throw new Error("filesystem unavailable");
    });
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    mockedCreatePool.mockResolvedValue({ query } as never);

    const result = await new RawEvidenceStore({ pool: null }).save(input);
    expect(mockedCreatePool).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(result.persisted).toBe(true);
    expect(result.persistence_status).toBe("server_persisted");
  });

  it("restores queue files after process restart and retries them idempotently", async () => {
    process.env.DATABASE_URL = "postgres://configured";
    const queuedEvidence: RawEvidence = {
      id: "evidence-restart",
      caregiver_id: "caregiver-1",
      person_id: null,
      input_type: "text",
      content: "Follow-up was scheduled.",
      content_hash: "hash",
      ocr_confidence: null,
      document_id: null,
      document_name: null,
      captured_at: "2026-10-22T12:00:00.000Z",
      urgency_risk_level: "low",
      urgency_signals: [],
      metadata: {},
    };
    const baseDir = join(process.cwd(), ".data", "raw-evidence-queue");
    fsMock.existsSync.mockImplementation((path: string) => path === baseDir);
    fsMock.readdirSync.mockImplementation((path: string) =>
      path === baseDir ? ["caregiver-1"] : ["evidence-restart.json"],
    );
    fsMock.readFileSync.mockReturnValue(JSON.stringify(queuedEvidence));
    const query = jest.fn().mockResolvedValue({ rowCount: 1 });
    mockedCreatePool.mockResolvedValue({ query } as never);

    const result = await new RawEvidenceStore({ pool: null }).syncToPostgres();
    expect(result).toEqual({ synced: 1, remaining: 0 });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain("ON CONFLICT (id) DO NOTHING");
    expect(fsMock.rmSync).toHaveBeenCalledTimes(1);
  });

  it("rejects a missing caregiver identity instead of writing to a shared default queue", async () => {
    await expect(
      new RawEvidenceStore({ pool: null }).save({ ...input, caregiver_id: "" }),
    ).rejects.toThrow("caregiver identity is required");
  });
});
