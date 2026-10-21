/** @jest-environment node */
import { jest } from "@jest/globals";

jest.unstable_mockModule("@/lib/situation-entry", () => ({
  processSituationInput: jest.fn(),
  getCareContextRoot: jest.fn(),
}));
jest.unstable_mockModule("@/lib/active-care-situation", () => ({
  getActiveCareSituation: jest.fn(),
}));
jest.unstable_mockModule("@/lib/care-reality-state", () => ({
  getCareRealityState: jest.fn(),
}));
jest.unstable_mockModule("@/lib/return-continuity", () => ({
  buildReturnContinuityProjection: jest.fn(),
}));
jest.unstable_mockModule("@/lib/resolution-engine/care-context-sync", () => ({
  upsertTrackedSituationFromCareInput: jest.fn(),
}));

const { GET, POST } = await import("./route");

describe("Next.js situation API identity requirements", () => {
  it("rejects reads when no care identity is provided", async () => {
    const response = await GET(new Request("http://localhost/api/situation"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      error: "caregiver_identity_required",
    }));
  });

  it("rejects blank care identities instead of using a shared default", async () => {
    const response = await GET(new Request("http://localhost/api/situation?caregiver_id=%20%20"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      error: "caregiver_identity_required",
    }));
  });

  it("rejects writes when no care identity is provided", async () => {
    const response = await POST(new Request("http://localhost/api/situation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raw_input: "Care note without an identity" }),
    }));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      error: "caregiver_identity_required",
    }));
  });
});
