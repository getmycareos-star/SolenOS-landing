/**
 * Verify Postgres Care Events store (event-sourced)
 */
import "./_verify-env.mts";
import { assertFutureCapabilityNotMvp } from "../src/lib/phase-scope-lock";

async function main(): Promise<void> {
  console.log("=== Verify Postgres Care Events Store ===\n");

  const blocked = assertFutureCapabilityNotMvp("help me communicate this");
  if (!blocked.blocked) {
    throw new Error("Scope lock should block future capabilities");
  }
  console.log("✓ Scope lock active");

  if (process.env.DATABASE_URL) {
    console.log("DATABASE_URL set - testing Postgres store");
    const { createPostgresCareEventStore } = await import("../src/lib/event-sourced-storage/postgres-store");
    const store = await createPostgresCareEventStore();
    
    const testCareRecipientId = "test-care-recipient-" + Date.now();
    const testEvent = {
      id: "evt-test-" + Date.now(),
      care_recipient_id: testCareRecipientId,
      caregiver_id: "test-caregiver",
      event_id: "event-" + Date.now(),
      event_type: "observation",
      situation_id: "situation-1",
      source: "note" as const,
      payload: { text: "Test observation" },
      metadata: {},
      correlation_id: "corr-1",
      causation_id: null,
      created_at: new Date().toISOString(),
    };

    await store.append(testEvent);
    console.log("✓ Care Event append successful");

    const events = await store.getByCareRecipient(testCareRecipientId);
    if (events.length !== 1 || events[0].event_id !== testEvent.event_id) {
      throw new Error("Care Event read failed");
    }
    console.log("✓ Care Event read by care recipient successful");

    const bySituation = await store.getBySituation("situation-1");
    if (bySituation.length !== 1) {
      throw new Error("Care Event read by situation failed");
    }
    console.log("✓ Care Event read by situation successful");

    const byCorrelation = await store.getByCorrelation("corr-1");
    if (byCorrelation.length !== 1) {
      throw new Error("Care Event read by correlation failed");
    }
    console.log("✓ Care Event read by correlation successful");

    const byEventId = await store.getByEventId(testEvent.event_id);
    if (!byEventId || byEventId.event_id !== testEvent.event_id) {
      throw new Error("Care Event read by event ID failed");
    }
    console.log("✓ Care Event read by event ID successful");

    await store.clear(testCareRecipientId);
    const afterClear = await store.getByCareRecipient(testCareRecipientId);
    if (afterClear.length !== 0) {
      throw new Error("Care Event clear failed");
    }
    console.log("✓ Care Event clear successful");
  } else {
    console.log("DATABASE_URL not set - skipping Postgres tests");
  }

  console.log("\nverify:postgres-care-events OK");
}

main().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});