import {
  getOrCreateCaregiverSelfProfile,
  resetCaregiverSelfProfileStore,
} from "./caregiver-profile/store";
import {
  tryLoadCaregiverSelfProfile,
  trySaveCaregiverSelfProfile,
} from "./caregiver-profile/postgres-store";
import { resolveCareItem, setCaregiverCapacity } from "./process-session";

jest.mock("./caregiver-profile/postgres-store", () => ({
  tryLoadCaregiverSelfProfile: jest.fn(),
  trySaveCaregiverSelfProfile: jest.fn(),
}));

const loadProfile = jest.mocked(tryLoadCaregiverSelfProfile);
const saveProfile = jest.mocked(trySaveCaregiverSelfProfile);

describe("capacity-self persistence is authoritative", () => {
  beforeEach(() => {
    resetCaregiverSelfProfileStore();
    jest.resetAllMocks();
    loadProfile.mockResolvedValue(null);
  });

  it("does not change cached capacity when the database save fails", async () => {
    saveProfile.mockRejectedValue(new Error("database unavailable"));

    await expect(setCaregiverCapacity("caregiver-a", "high")).rejects.toThrow("database unavailable");

    expect(getOrCreateCaregiverSelfProfile("caregiver-a").session_capacity).toBeNull();
  });

  it("does not append a resolved item to the cache when persistence fails", async () => {
    saveProfile.mockRejectedValue(new Error("database unavailable"));

    await expect(resolveCareItem({
      caregiver_id: "caregiver-a",
      description: "A caregiver-entered item",
      subject: "caregiver",
      context_type: "other",
    })).rejects.toThrow("database unavailable");

    expect(getOrCreateCaregiverSelfProfile("caregiver-a").resolved_items).toEqual([]);
  });

  it("updates the cache only after the database confirms the save", async () => {
    saveProfile.mockResolvedValue(undefined);

    await setCaregiverCapacity("caregiver-a", "medium");

    expect(saveProfile).toHaveBeenCalledTimes(1);
    expect(getOrCreateCaregiverSelfProfile("caregiver-a").session_capacity).toBe("medium");
  });
});
