/**
 * Verify Postgres Care Reality State store
 */
import "./_verify-env.mts";
import { assertFutureCapabilityNotMvp } from "../src/lib/phase-scope-lock";

async function main(): Promise<void> {
  console.log("=== Verify Postgres CRS Store ===\n");

  const blocked = assertFutureCapabilityNotMvp("help me communicate this");
  if (!blocked.blocked) {
    throw new Error("Scope lock should block future capabilities");
  }
  console.log("✓ Scope lock active");

  if (process.env.DATABASE_URL) {
    console.log("DATABASE_URL set - testing Postgres store");
    const { createPostgresCareRealityStateStore } = await import("../src/lib/care-reality-state/postgres-store");
    const store = await createPostgresCareRealityStateStore();
    
    const testId = "test-care-recipient-" + Date.now();
    const testState = {
      id: "crs-test-" + Date.now(),
      care_recipient_id: testId,
      caregiver_id: "test-caregiver",
      care_recipient_label: "Test Subject",
      updated_at: new Date().toISOString(),
      situation_id: null,
      root_event_id: null,
      understanding_stage: "gathering" as const,
      disclosure_stage: "early" as const,
      current_understanding: [],
      supporting_evidence: [],
      situation_summary: null,
      pattern_label: null,
      what_matters_now: null,
      open_uncertainties: [],
      resolved_uncertainties: [],
      what_changed_in_understanding: null,
      understanding_effect: "opens_situation" as const,
      response_evolution: {
        updates_active_situation: false,
        answers_previous_uncertainty: false,
        strengthens_existing_hypothesis: false,
        introduces_new_pattern: false,
        changes_what_matters_now: false,
        invalidates_previous_understanding: false,
      },
      primary_screen_question: "What happened?",
      observation_count: 0,
      revision: 1,
      continuity_hooks: [],
      understanding_revisions: [],
      care_domain_trajectories: {},
      compound_signals: [],
      change_classifications: [],
    };

    await store.set(testId, testState);
    console.log("✓ CRS write successful");

    const retrieved = await store.get(testId);
    if (!retrieved || retrieved.id !== testState.id) {
      throw new Error("CRS read failed");
    }
    console.log("✓ CRS read successful");

    await store.delete(testId);
    const deleted = await store.get(testId);
    if (deleted) {
      throw new Error("CRS delete failed");
    }
    console.log("✓ CRS delete successful");

    await store.clear();
    console.log("✓ CRS clear successful");
  } else {
    console.log("DATABASE_URL not set - skipping Postgres tests");
  }

  console.log("\nverify:postgres-crs OK");
}

main().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});