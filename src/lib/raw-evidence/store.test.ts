import { join } from "path";
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

const fsMock = jest.requireMock("fs") as {
  existsSync: jest.Mock;
  mkdirSync: jest.Mock;
  readFileSync: jest.Mock;
  readdirSync: jest.Mock;
  rmSync: jest.Mock;
  writeFileSync: jest.Mock;
};

const input = {
  id: "evidence-1",
  caregiver_id: "caregiver-1",
  person_id: "person-1",
  input_type: "text" as const,
  content: "Breakfast was mostly uneaten.",
  captured_at: "2026-10-22T12:00:00.000Z",
};

describe("legacy raw evidence queue never claims canonical persistence", () => {
  beforeEach(() => {
    delete process.env.DATABASE_URL;
    jest.clearAllMocks();
    fsMock.existsSync.mockReturnValue(false);
    fsMock.readdirSync.mockReturnValue([]);
    fsMock.writeFileSync.mockImplementation(() => undefined);
    fsMock.mkdirSync.mockImplementation(() => undefined);
    fsMock.rmSync.mockImplementation(() => undefined);
  });

  it("reports local_queued but persisted=false when only the local recovery queue accepts the input", async () => {
    const result = await new RawEvidenceStore().save(input);
    expect(result.persistence_status).toBe("local_queued");
    expect(result.persisted).toBe(false);
    expect(fsMock.writeFileSync).toHaveBeenCalledTimes(1);
  });

  it("does not write to a separate frontend PostgreSQL database even when DATABASE_URL is configured", async () => {
    process.env.DATABASE_URL = "postgres://a-separate-frontend-database";
    const result = await new RawEvidenceStore().save(input);
    expect(result.persistence_status).toBe("local_queued");
    expect(result.persisted).toBe(false);
  });

  it("reports memory_only when the local recovery queue is unavailable", async () => {
    fsMock.writeFileSync.mockImplementation(() => {
      throw new Error("filesystem unavailable");
    });
    const result = await new RawEvidenceStore().save(input);
    expect(result.persistence_status).toBe("memory_only");
    expect(result.persisted).toBe(false);
  });

  it("acknowledges an identical immutable local replay without changing its identity", async () => {
    const store = new RawEvidenceStore();
    const first = await store.save(input);
    const second = await store.save(input);
    expect(first.evidence.id).toBe(second.evidence.id);
    expect(first.evidence.content_hash).toBe(second.evidence.content_hash);
    expect(second.persisted).toBe(false);
    expect(second.persistence_status).toBe("local_queued");
  });

  it("rejects reuse of an evidence ID with different owner or content", async () => {
    const store = new RawEvidenceStore();
    await store.save(input);
    await expect(store.save({ ...input, content: "Different observation" }))
      .rejects.toThrow("different content or ownership");
  });

  it("restores queue files and synchronizes only through an explicit canonical backend writer", async () => {
    const queuedEvidence: RawEvidence = {
      id: "evidence-restart",
      caregiver_id: "caregiver-1",
      person_id: "person-1",
      input_type: "text",
      content: "Follow-up was scheduled.",
      content_hash: "stable-hash",
      ocr_confidence: null,
      document_id: null,
      document_name: null,
      captured_at: "2026-10-22T12:00:00.000Z",
      urgency_risk_level: "low",
      urgency_signals: [],
      metadata: {},
    };
    const baseDir = join(process.cwd(), ".data", "raw-evidence-queue");
    let queuePresent = true;
    fsMock.existsSync.mockImplementation((path: string) => path === baseDir);
    fsMock.readdirSync.mockImplementation((path: string) =>
      path === baseDir ? (queuePresent ? ["caregiver-1"] : []) :
        queuePresent ? ["evidence-restart.json"] : [],
    );
    fsMock.readFileSync.mockReturnValue(JSON.stringify(queuedEvidence));
    fsMock.rmSync.mockImplementation(() => {
      queuePresent = false;
    });
    const writer = jest.fn(async (evidence: RawEvidence) => ({
      evidence_id: evidence.id,
      persisted: true as const,
    }));
    const store = new RawEvidenceStore({ persistCanonical: writer });

    const result = await store.syncToCanonicalBackend();
    expect(result).toEqual({ synced: 1, remaining: 0 });
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer.mock.calls[0]?.[0].id).toBe("evidence-restart");
    expect(fsMock.rmSync).toHaveBeenCalledTimes(1);
  });

  it("does not synchronize a local queue without an explicit canonical writer", async () => {
    const queuedEvidence: RawEvidence = {
      id: "evidence-restart",
      caregiver_id: "caregiver-1",
      person_id: "person-1",
      input_type: "text",
      content: "Follow-up was scheduled.",
      content_hash: "stable-hash",
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

    const result = await new RawEvidenceStore().syncToCanonicalBackend();
    expect(result).toEqual({ synced: 0, remaining: 1 });
    expect(fsMock.rmSync).not.toHaveBeenCalled();
  });

  it("rejects a missing caregiver identity instead of writing to a shared queue", async () => {
    await expect(new RawEvidenceStore().save({ ...input, caregiver_id: "" }))
      .rejects.toThrow("caregiver identity is required");
  });
});
