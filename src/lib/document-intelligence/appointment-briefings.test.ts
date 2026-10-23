import { buildAppointmentBriefings } from "./appointment-briefings";

describe("buildAppointmentBriefings", () => {
  it("creates an evidence-linked briefing using only explicit details", () => {
    const result = buildAppointmentBriefings([{
      id: "evidence-1",
      type: "document",
      uploaded_at: "2026-10-22T10:00:00Z",
      source_text: "Neurology appointment scheduled for Thursday at 10:30 AM with Dr. Okafor. Bring the medication list and recent records.",
    }]);

    expect(result).toHaveLength(1);
    expect(result[0].sourceEvidenceId).toBe("evidence-1");
    expect(result[0].when).toMatch(/Thursday|10:30 AM/i);
    expect(result[0].who).toBe("Dr. Okafor");
    expect(result[0].preparation).toContain("Bring the medication list and recent records.");
    expect(result[0].detailsToConfirm).toContain(
      "Verify that this is a current plan, not a past or superseded appointment.",
    );
  });

  it("does not invent missing date, clinician, or preparation details", () => {
    const result = buildAppointmentBriefings([{
      id: "evidence-2",
      type: "note",
      source_text: "Please arrange a follow-up.",
    }]);

    expect(result).toHaveLength(1);
    expect(result[0].when).toBeNull();
    expect(result[0].who).toBeNull();
    expect(result[0].preparation).toEqual([]);
    expect(result[0].detailsToConfirm).toContain("Confirm the appointment date and time.");
    expect(result[0].detailsToConfirm).toContain("Confirm the clinician, clinic, or service.");
  });

  it("deduplicates repeated appointment sentences from the same source", () => {
    const result = buildAppointmentBriefings([{
      id: "evidence-3",
      type: "document",
      source_text: "Follow-up scheduled in 2 weeks. Follow-up scheduled in 2 weeks.",
    }]);
    expect(result).toHaveLength(1);
  });
});
