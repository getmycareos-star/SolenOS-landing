import { getCaregiverSelfProfileStorageMode } from "./postgres-store";

describe("caregiver profile persistence status", () => {
  it("marks storage local-only when no database URL exists", () => {
    expect(getCaregiverSelfProfilePersistenceStatus("")).toBe("local_only");
    expect(getCaregiverSelfProfilePersistenceStatus(undefined)).toBe("local_only");
  });

  it("marks configured database storage separately from local memory", () => {
    expect(getCaregiverSelfProfilePersistenceStatus("postgres://configured")).toBe("database_configured");
  });
});
