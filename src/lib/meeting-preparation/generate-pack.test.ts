import { generatePreparationPack } from "./generate-pack";
import { createMeeting, resetMeetingStore } from "./meeting-store";
import { resetCareJourneyGraphStore } from "../care-journey-graph/graph-store";
import { runProactiveEngine, resetPatternIntelligenceStore } from "../pattern-intelligence/proactive-engine";

describe("explicit unavailable care context", () => {
  afterEach(() => {
    resetMeetingStore();
    resetCareJourneyGraphStore();
    resetPatternIntelligenceStore();
  });

  it("does not invent a 1970 baseline when no prior meeting exists", () => {
    const meeting = createMeeting({
      title: "Care review",
      type: "medical",
      datetime: "2026-11-01T10:00:00.000Z",
      caregiver_id: "cg_pack_test",
    });
    const pack = generatePreparationPack(meeting);
    expect(pack.last_similar_meeting_at).toBeNull();
    expect(pack.baseline_status).toBe("no_previous_similar_meeting");
    expect(pack.care_history_status).toBe("unavailable");
    expect(pack.timeline_since_last_meeting).toEqual([]);
    expect(JSON.stringify(pack)).not.toContain("1970-01-01");
  });

  it("marks care history and appointment signals unavailable instead of empty", () => {
    const result = runProactiveEngine("cg_no_loaded_data");
    expect(result.care_history_status).toBe("unavailable");
    expect(result.appointment_signals_status).toBe("unavailable");
    expect(result.events_analyzed).toBe(0);
    expect(result.proactive_signals).toEqual([]);
  });
});
