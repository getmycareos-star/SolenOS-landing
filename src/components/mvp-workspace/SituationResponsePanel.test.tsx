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
