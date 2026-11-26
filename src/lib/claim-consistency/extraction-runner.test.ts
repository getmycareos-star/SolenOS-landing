import { postJSON } from "@/api/client";
import { runParallelExtractions } from "./extraction-runner";

jest.mock("@/api/client", () => ({ postJSON: jest.fn() }));

const mockedPostJSON = jest.mocked(postJSON);

function candidateMetadata(candidateId: string, description: string, fragment: string) {
  return {
    candidate_id: candidateId,
    candidate_type: "claim" as const,
    candidate_description: description,
    source_id: "evidence-1",
    source_fragment: fragment,
    recorded_at: null,
    recorded_time_status: "unavailable" as const,
    person: { id: null, resolution_status: "unresolved" as const },
    care_recipient_id: "person-1",
    event_time: null,
    event_time_resolution: "missing" as const,
    epistemic_status: "reported" as const,
    confidence: "unavailable" as const,
    review_state: "pending" as const,
  };
}

const input = {
  evidence_id: "evidence-1",
  raw_text: "Mom fell yesterday. She seemed tired.",
  raw_input_id: "raw-input-1",
  caregiver_id: "caregiver-1",
  timestamp: new Date("2026-01-01T00:00:00.000Z").toISOString(),
};

describe("Qwen claim extraction adapter", () => {
  beforeEach(() => jest.clearAllMocks());

  it("requests two distinct model runs through the authenticated backend and preserves review-only semantics", async () => {
    mockedPostJSON.mockResolvedValue({
      evidence_id: "evidence-1",
      provider: "private_ollama_qwen",
      written_to_lcr: false,
      review_required: true,
      run_a: { claims: [{
        ...candidateMetadata("candidate-1", "Mom fell yesterday", "Mom fell yesterday"),
        claim_text: "Mom fell yesterday",
        entity_type: "event",
        event_type: "fall_reported",
        confidence_tag: "reported",
        source_span: { start_offset: 0, end_offset: 18, text: "Mom fell yesterday" },
      }] },
      run_b: { claims: [{
        ...candidateMetadata("candidate-2", "She seemed tired", "She seemed tired"),
        claim_text: "She seemed tired",
        entity_type: "symptom",
        event_type: "fatigue_reported",
        confidence_tag: "reported",
        source_span: { start_offset: 20, end_offset: 36, text: "She seemed tired" },
      }] },
    } as never);

    const result = await runParallelExtractions(input);

    expect(mockedPostJSON).toHaveBeenCalledTimes(1);
    expect(mockedPostJSON).toHaveBeenCalledWith("/assistant/claim-extraction", {
      evidence_id: input.evidence_id,
      raw_text: input.raw_text,
    });
    expect(result.runA.success).toBe(true);
    expect(result.runB.success).toBe(true);
    expect(result.runA.run_id).not.toBe(result.runB.run_id);
    expect(result.runA.claims[0]?.source_span?.text).toBe("Mom fell yesterday");
    expect(result.runB.claims[0]?.source_span?.text).toBe("She seemed tired");
  });

  it("fails both runs closed when backend returns a provider or review-boundary mismatch", async () => {
    mockedPostJSON.mockResolvedValue({
      evidence_id: "evidence-1",
      provider: "another-provider",
      written_to_lcr: true,
      review_required: false,
      run_a: { claims: [] },
      run_b: { claims: [] },
    } as never);

    const result = await runParallelExtractions(input);

    expect(result.runA.success).toBe(false);
    expect(result.runB.success).toBe(false);
    expect(result.runA.claims).toHaveLength(0);
    expect(result.runB.claims).toHaveLength(0);
  });

  it("fails both runs closed when the backend is unavailable", async () => {
    mockedPostJSON.mockRejectedValue(new Error("backend unavailable"));

    const result = await runParallelExtractions(input);

    expect(result.runA.success).toBe(false);
    expect(result.runB.success).toBe(false);
    expect(result.runA.error).toContain("backend unavailable");
  });
});
