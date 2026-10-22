import { getCaregiverSelfProfileStorageMode } from "./postgres-store";

describe("caregiver profile persistence status", () => {
  it("marks storage local-only when no database URL exists", () => {
    expect(getCaregiverSelfProfileStorageMode("")).toBe("local_only");
    expect(getCaregiverSelfProfileStorageMode(undefined)).toBe("local_only");
  });

  it("marks configured database storage separately from local memory", () => {
    expect(getCaregiverSelfProfileStorageMode("postgres://configured")).toBe("database_configured");
  });
});
