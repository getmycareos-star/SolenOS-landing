/**
 * Verify Postgres Decision Memory store
 */
import "./_verify-env.mts";
import { assertFutureCapabilityNotMvp } from "../src/lib/phase-scope-lock";

async function main(): Promise<void> {
  console.log("=== Verify Postgres Decision Memory Store ===\n");

  const blocked = assertFutureCapabilityNotMvp("help me communicate this");
  if (!blocked.blocked) {
    throw new Error("Scope lock should block future capabilities");
  }
  console.log("✓ Scope lock active");

  if (process.env.DATABASE_URL) {
    console.log("DATABASE_URL set - testing Postgres store");
    const { createPostgresDecisionMemoryStore } = await import("../src/lib/decision-memory/postgres-store");
    const store = await createPostgresDecisionMemoryStore();
    
    const testKey = "test-care-key-" + Date.now();
    const testEntry = {
      id: "dm-test-" + Date.now(),
      care_key: testKey,
      what: "Test decision",
      decision: "Test decision",
      when: new Date().toISOString(),
      who: ["test-caregiver"],
      context_situation_id: null,
      context_summary: null,
      evidence: [{ source: "note", text: "Test evidence" }],
      alternatives: [],
      reason: "Test reason",
      outcome: null,
      outcome_event_ids: [],
      status: "active" as const,
      evidence_texts: ["Test evidence"],
      recorded_at: new Date().toISOString(),
      content_tokens: ["test", "decision"],
    };

    await store.add(testKey, testEntry);
    console.log("✓ Decision Memory write successful");

    const entries = await store.list(testKey);
    if (entries.length !== 1 || entries[0].id !== testEntry.id) {
      throw new Error("Decision Memory read failed");
    }
    console.log("✓ Decision Memory read successful");

    await store.update(testKey, { ...testEntry, outcome: "Test outcome" });
    const updated = await store.list(testKey);
    if (updated[0].outcome !== "Test outcome") {
      throw new Error("Decision Memory update failed");
    }
    console.log("✓ Decision Memory update successful");

    await store.delete(testKey, testEntry.id);
    const afterDelete = await store.list(testKey);
    if (afterDelete.length !== 0) {
      throw new Error("Decision Memory delete failed");
    }
    console.log("✓ Decision Memory delete successful");

    await store.clear(testKey);
    console.log("✓ Decision Memory clear successful");
  } else {
    console.log("DATABASE_URL not set - skipping Postgres tests");
  }

  console.log("\nverify:postgres-decision-memory OK");
}

main().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});