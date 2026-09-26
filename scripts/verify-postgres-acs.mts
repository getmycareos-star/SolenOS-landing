/**
 * Verify Postgres Active Care Situation store
 */
import "./_verify-env.mts";
import { assertFutureCapabilityNotMvp } from "../src/lib/phase-scope-lock";

async function main(): Promise<void> {
  console.log("=== Verify Postgres ACS Store ===\n");

  // Test that scope lock still works
  const blocked = assertFutureCapabilityNotMvp("help me communicate this");
  if (!blocked.blocked) {
    throw new Error("Scope lock should block future capabilities");
  }
  console.log("✓ Scope lock active");

  // If DATABASE_URL is set, test Postgres store
  if (process.env.DATABASE_URL) {
    console.log("DATABASE_URL set - testing Postgres store");
    const { createPostgresActiveCareSituationStore } = await import("../src/lib/active-care-situation/postgres-store");
    const store = await createPostgresActiveCareSituationStore();
    
    const testId = "test-care-recipient-" + Date.now();
    const testSituation = {
      id: "acs-test-" + Date.now(),
      care_recipient_id: testId,
      caregiver_id: "test-caregiver",
      opened_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      root_event_id: null,
      subject_label: "Test Subject",
      theme: "mixed" as const,
      observations: [],
      open_questions: [],
      asked_questions: [],
      understanding_stage: "gathering" as const,
      connection_note: null,
      synthesis: null,
      what_matters_now: null,
      lifecycle_status: "active" as const,
      last_understanding_effect: null,
      last_understanding_delta: null,
      pattern_label: null,
      familiarity_baseline: [],
      compound_signal: null,
      trajectory_by_domain: {},
      cross_signal_correlations: [],
      continuity_hooks: [],
    };

    await store.set(testId, testSituation);
    console.log("✓ ACS write successful");

    const retrieved = await store.get(testId);
    if (!retrieved || retrieved.id !== testSituation.id) {
      throw new Error("ACS read failed");
    }
    console.log("✓ ACS read successful");

    await store.delete(testId);
    const deleted = await store.get(testId);
    if (deleted) {
      throw new Error("ACS delete failed");
    }
    console.log("✓ ACS delete successful");

    await store.clear();
    console.log("✓ ACS clear successful");
  } else {
    console.log("DATABASE_URL not set - skipping Postgres tests");
  }

  console.log("\nverify:postgres-acs OK");
}

main().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});