import { createStubPriority } from "./attach-priority";
import { getAttentionEvents, sortEventsByPriority } from "./query";
import type { CanonicalCareEvent } from "../situation-entry/types";

function event(id: string, score: number | null): CanonicalCareEvent {
  return {
    id,
    status: "provisional",
    priority: {
      urgency: null,
      uncertainty: null,
      dependency_count: null,
      recency_days: null,
      priority_score: score,
      tier: score == null ? null : score >= 80 ? "CRITICAL" : "CONTEXTUAL",
      attention_status: "provisional",
    },
  } as unknown as CanonicalCareEvent;
}

describe("unknown priority is not a synthetic score", () => {
  it("returns unavailable values for stub priority", () => {
    expect(createStubPriority("provisional")).toEqual({
      urgency: null,
      uncertainty: null,
      dependency_count: null,
      recency_days: null,
      priority_score: null,
      tier: null,
      attention_status: "provisional",
    });
  });

  it("places unscored events after scored events and never treats them as attention-worthy", () => {
    const scored = event("scored", 85);
    const unknown = event("unknown", null);
    expect(sortEventsByPriority([unknown, scored]).map((item) => item.id)).toEqual(["scored", "unknown"]);
    expect(getAttentionEvents([unknown, scored]).map((item) => item.id)).toEqual(["scored"]);
  });
});
