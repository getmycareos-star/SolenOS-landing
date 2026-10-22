import {
  addResolvedItem,
  getOrCreateCaregiverSelfProfile,
  resetCaregiverSelfProfileStore,
  updateCaregiverSelfProfile,
} from "./store";

describe("caregiver profile identity isolation", () => {
  beforeEach(() => resetCaregiverSelfProfileStore());
  afterEach(() => resetCaregiverSelfProfileStore());

  it("does not share default arrays or nested records between caregivers", () => {
    updateCaregiverSelfProfile("caregiver-a", (profile) => {
      profile.known_conditions.push("caregiver A only");
      profile.key_dates.push({ label: "A date", date: "2026-10-22" });
      profile.care_team.push({ name: "A contact", role: "nurse", contact: "a@example.invalid" });
      return profile;
    });

    const b = getOrCreateCaregiverSelfProfile("caregiver-b");
    expect(b.profile.known_conditions).toEqual([]);
    expect(b.profile.key_dates).toEqual([]);
    expect(b.profile.care_team).toEqual([]);

    const a = getOrCreateCaregiverSelfProfile("caregiver-a");
    a.profile.known_conditions.push("mutation to detached read");
    expect(getOrCreateCaregiverSelfProfile("caregiver-a").profile.known_conditions).toEqual([
      "caregiver A only",
    ]);
  });

  it("does not retain caller-owned resolved-item objects by reference", () => {
    const item = {
      id: "resolved-a",
      description: "Caregiver A item",
      subject: "caregiver" as const,
      context_type: "other" as const,
      resolved_at: "2026-10-22T00:00:00.000Z",
      raw_entry_id: null,
    };
    addResolvedItem("caregiver-a", item);
    item.description = "mutated after write";

    expect(getOrCreateCaregiverSelfProfile("caregiver-a").resolved_items[0].description)
      .toBe("Caregiver A item");
    expect(getOrCreateCaregiverSelfProfile("caregiver-b").resolved_items).toEqual([]);
  });

  it("rejects missing and legacy shared caregiver identities", () => {
    expect(() => getOrCreateCaregiverSelfProfile("")).toThrow(/caregiver identity/i);
    expect(() => getOrCreateCaregiverSelfProfile("default_caregiver")).toThrow(/caregiver identity/i);
  });
});
