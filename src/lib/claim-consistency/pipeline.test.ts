import { getRawEvidenceStore } from "../raw-evidence";
import { runParallelExtractions } from "./extraction-runner";
import { runConsistencyGate } from "./pipeline";

jest.mock("../raw-evidence", () => ({ getRawEvidenceStore: jest.fn() }));
jest.mock("./extraction-runner", () => ({ runParallelExtractions: jest.fn() }));
jest.mock("./logging", () => ({
  getConsistencyLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logExtractionRun: jest.fn(),
    logDisagreement: jest.fn(),
    logAOnly: jest.fn(),
    logBOnly: jest.fn(),
  }),
}));

const mockedGetStore = jest.mocked(getRawEvidenceStore);
const mockedRunExtractions = jest.mocked(runParallelExtractions);

describe("consistency gate persistence boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not start extraction when raw evidence exists only in process memory", async () => {
    mockedGetStore.mockReturnValue({
      save: jest.fn().mockResolvedValue({
        evidence: { id: "evidence-1" },
        persisted: false,
        persistence_status: "memory_only",
      }),
    } as never);

    const result = await runConsistencyGate({
      evidence_id: "evidence-1",
      raw_text: "Breakfast was mostly uneaten.",
      raw_input_id: "raw-input-1",
      caregiver_id: "caregiver-1",
    });

    expect(result.success).toBe(false);
    expect(result.persistence_status).toBe("memory_only");
    expect(result.error).toContain("extraction was not started");
    expect(result.run_a.run_id).toBe("not-started");
    expect(result.run_b.run_id).toBe("not-started");
    expect(mockedRunExtractions).not.toHaveBeenCalled();
  });

  it("does not start extraction while evidence is only in the local recovery queue", async () => {
    mockedGetStore.mockReturnValue({
      save: jest.fn().mockResolvedValue({
        evidence: { id: "evidence-queued" },
        persisted: true,
        persistence_status: "local_queued",
      }),
    } as never);

    const result = await runConsistencyGate({
      evidence_id: "evidence-queued",
      raw_text: "A caregiver observation awaiting synchronization.",
      raw_input_id: "raw-input-queued",
      caregiver_id: "caregiver-1",
    });

    expect(result.success).toBe(false);
    expect(result.persistence_status).toBe("local_queued");
    expect(result.error).toContain("not yet confirmed in PostgreSQL");
    expect(result.run_a.run_id).toBe("not-started");
    expect(result.run_b.run_id).toBe("not-started");
    expect(mockedRunExtractions).not.toHaveBeenCalled();
  });

});