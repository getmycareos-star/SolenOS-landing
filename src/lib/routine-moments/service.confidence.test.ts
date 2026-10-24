import { detectChanges } from "./service";
import type { RoutineBaseline, RoutineMomentRecord } from "./types";

function observation(id: string, observedAt: string): RoutineMomentRecord {
  return {
    id,
    version: 1,
    person_id: "person-test",
    routine_name: "morning routine",
    observation_text: "Caregiver-reported routine observation",
    observed_at: observedAt,
    status: "recorded",
    created_at: observedAt,
    updated_at: observedAt,
    created_by_caregiver_id: "caregiver-test",
  };
}

function baseline(frequencyPerWeek: number): RoutineBaseline {
  return {
    routine_name: "morning routine",
    person_id: "person-test",
    frequency_per_week: frequencyPerWeek,
    average_time_of_day: "08:00",
    assistance_level_distribution: {},
    participation_level_distribution: {},
    consistency_score: null,
    last_updated: "2026-10-22T00:00:00.000Z",
    sample_size: 4,
  };
}

describe("routine change confidence semantics", () => {
  it("does not treat the magnitude of a change as statistical confidence", () => {
    const changes = detectChanges(
      [
        observation("o1", "2026-10-20T08:00:00.000Z"),
        observation("o2", "2026-10-21T09:00:00.000Z"),
        observation("o3", "2026-10-22T10:00:00.000Z"),
      ],
      baseline(1),
    );

    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every((change) => change.confidence === null)).toBe(true);
  });

  it("does not divide by a zero baseline or report a relative percentage for it", () => {
    const changes = detectChanges(
      [
        observation("o1", "2026-10-20T08:00:00.000Z"),
        observation("o2", "2026-10-21T09:00:00.000Z"),
      ],
      baseline(0),
    );

    const frequencyChange = changes.find((change) => change.field === "frequency_per_week");
    expect(frequencyChange).toBeDefined();
    expect(frequencyChange?.previous_value).toBe(0);
    expect(frequencyChange?.current_value).toBeGreaterThan(0);
    expect(frequencyChange?.confidence).toBeNull();
    expect(Number.isFinite(frequencyChange?.current_value)).toBe(true);
  });
});
