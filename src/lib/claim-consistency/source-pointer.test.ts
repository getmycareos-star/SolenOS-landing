import { verifySourcePointer } from "./source-pointer";
import type { ExtractedClaim } from "./types";

function claim(start_offset: number, end_offset: number, text: string): ExtractedClaim {
  return {
    id: "claim-1",
    claim_text: text,
    entity_type: "event",
    event_type: "fall_reported",
    confidence_tag: "reported",
    source_span: { start_offset, end_offset, text },
    raw_input_id: "raw-1",
    evidence_id: "evidence-1",
    extraction_run_id: "run-1",
    created_at: "2026-11-26T00:00:00.000Z",
  };
}

describe("Unicode source pointer verification", () => {
  it("uses Unicode code-point offsets consistently with the Python backend", () => {
    const source = "💛 Mom fell yesterday";
    const quote = "Mom fell yesterday";
    expect(verifySourcePointer(claim(2, 20, quote), source)).toBe(true);
  });

  it("rejects an end offset beyond the source length", () => {
    const source = "Mom fell yesterday";
    expect(verifySourcePointer(claim(0, 100, source), source)).toBe(false);
  });

  it("rejects a span whose exact source text does not match", () => {
    const source = "💛 Mom fell yesterday";
    expect(verifySourcePointer(claim(2, 20, "Mom was injured yesterday"), source)).toBe(false);
  });
});
