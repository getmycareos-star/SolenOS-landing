import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, jest } from "@jest/globals";
import type { SituationResponse } from "@/lib/situation-entry";
import { SituationResponsePanel } from "./SituationResponsePanel";

jest.mock("@/lib/living-care-record-ux", () => ({
  buildLivingCareRecordResponse: jest.fn(() => ({})),
}));
jest.mock("./LivingCareRecordPanel", () => ({
  LivingCareRecordPanel: () => <div>Living Care Record panel</div>,
}));

afterEach(cleanup);

describe("reconstructed care-situation disclosure", () => {
  it("discloses that the active situation is a projection of saved evidence and events", () => {
    const response = {
      active_care_situation: {
        id: "projection-1",
        persistence_source: "relational_evidence_and_events_projection",
        reasoning_state_persisted: false,
      },
      active_care_situation_turn: undefined,
    } as unknown as SituationResponse;

    render(
      <SituationResponsePanel
        response={response}
        rawInput="Breakfast was mostly uneaten."
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "reconstructed from saved evidence and events",
    );
    expect(screen.getByRole("status").textContent).toContain(
      "has not been persisted",
    );
  });

  it("shows a persisted-entry receipt when the event was saved but no situation projection was returned", () => {
    const response = {
      ok: true,
      care_event_id: "event-saved-123",
      evidence_id: "evidence-saved-456",
      message: "Care input recorded successfully.",
      events: [{
        id: "event-saved-123",
        title: "Breakfast was mostly uneaten.",
        description: "Breakfast was mostly uneaten.",
        occurred_at: "2026-10-24T10:00:00Z",
      }],
      active_care_situation: undefined,
      active_care_situation_turn: undefined,
    } as unknown as SituationResponse;

    render(
      <SituationResponsePanel
        response={response}
        rawInput="Breakfast was mostly uneaten."
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Entry saved to the Living Care Record",
    );
    expect(screen.getByRole("status").textContent).toContain(
      "event-saved-123",
    );
    expect(screen.queryByText("Care record view unavailable")).toBeNull();
  });

  it("does not show the projection warning when a separate reasoning state is persisted", () => {
    const response = {
      active_care_situation: {
        id: "situation-1",
        persistence_source: "relational_evidence_and_events_projection",
        reasoning_state_persisted: true,
      },
      active_care_situation_turn: undefined,
    } as unknown as SituationResponse;

    render(
      <SituationResponsePanel
        response={response}
        rawInput="Breakfast was mostly uneaten."
      />,
    );

    expect(screen.queryByRole("status")).toBeNull();
  });
});
