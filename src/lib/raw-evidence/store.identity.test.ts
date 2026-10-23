import { createHash } from "node:crypto";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { RawEvidenceStore } from "./store";

function queueDirFor(caregiverId: string): string {
  const readable = caregiverId.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32) || "caregiver";
  const hash = createHash("sha256").update(caregiverId).digest("hex").slice(0, 24);
  return join(process.cwd(), ".data", "raw-evidence-queue", `${readable}_${hash}`);
}

describe("raw evidence identity and persistence status", () => {
  const caregiverA = "phase4-care/a";
  const caregiverB = "phase4-care_a";
  const evidenceA = "phase4-evidence-a";
  const evidenceB = "phase4-evidence-b";

  afterAll(() => {
    rmSync(queueDirFor(caregiverA), { recursive: true, force: true });
    rmSync(queueDirFor(caregiverB), { recursive: true, force: true });
  });

  it("reports the actual storage backend and prevents cross-caregiver reads", async () => {
    const store = new RawEvidenceStore({ pool: null });
    const resultA = await store.save({
      id: evidenceA,
      caregiver_id: caregiverA,
      input_type: "text",
      content: "Caregiver A test evidence",
    });
    const resultB = await store.save({
      id: evidenceB,
      caregiver_id: caregiverB,
      input_type: "text",
      content: "Caregiver B test evidence",
    });

    expect(resultA.persisted).toBe(true);
    expect(resultA.persistence_status).toBe("local_queued");
    expect(resultB.persisted).toBe(true);
    expect(resultB.persistence_status).toBe("local_queued");

    expect(store.getById(caregiverA, evidenceA)?.content).toBe("Caregiver A test evidence");
    expect(store.getById(caregiverA, evidenceB)).toBeUndefined();
    expect(store.getById(caregiverB, evidenceA)).toBeUndefined();
    expect(store.listForCaregiver(caregiverA).map((item) => item.id)).toEqual([evidenceA]);
    expect(store.listForCaregiver(caregiverB).map((item) => item.id)).toEqual([evidenceB]);
  });

  it("rejects missing and shared fallback identities", async () => {
    const store = new RawEvidenceStore({ pool: null });
    await expect(store.save({
      caregiver_id: "default_caregiver",
      input_type: "text",
      content: "must not be stored",
    })).rejects.toThrow(/explicit caregiver identity/i);
    expect(() => store.listForCaregiver("")).toThrow(/explicit caregiver identity/i);
    expect(() => store.getById("default_caregiver", evidenceA)).toThrow(/explicit caregiver identity/i);
  });
});
