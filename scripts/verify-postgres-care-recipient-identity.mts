/**
 * Verify Postgres Care Recipient Identity store
 */
import "./_verify-env.mts";
import { assertFutureCapabilityNotMvp } from "../src/lib/phase-scope-lock";

async function main(): Promise<void> {
  console.log("=== Verify Postgres Care Recipient Identity Store ===\n");

  const blocked = assertFutureCapabilityNotMvp("help me communicate this");
  if (!blocked.blocked) {
    throw new Error("Scope lock should block future capabilities");
  }
  console.log("✓ Scope lock active");

  if (process.env.DATABASE_URL) {
    console.log("DATABASE_URL set - testing Postgres store");
    const { createPostgresCareRecipientIdentityStore } = await import("../src/lib/care-recipient-identity/postgres-store");
    const store = await createPostgresCareRecipientIdentityStore();
    
    const testKey = "test-care-key-" + Date.now();
    const testIdentity = {
      care_key: testKey,
      display_name: "Mom",
      relationship: "mother",
      updated_at: new Date().toISOString(),
    };

    await store.set(testKey, testIdentity);
    console.log("✓ Care Recipient Identity write successful");

    const retrieved = await store.get(testKey);
    if (!retrieved || retrieved.display_name !== "Mom") {
      throw new Error("Care Recipient Identity read failed");
    }
    console.log("✓ Care Recipient Identity read successful");

    await store.delete(testKey);
    const deleted = await store.get(testKey);
    if (deleted) {
      throw new Error("Care Recipient Identity delete failed");
    }
    console.log("✓ Care Recipient Identity delete successful");

    await store.clear();
    console.log("✓ Care Recipient Identity clear successful");
  } else {
    console.log("DATABASE_URL not set - skipping Postgres tests");
  }

  console.log("\nverify:postgres-care-recipient-identity OK");
}

main().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});