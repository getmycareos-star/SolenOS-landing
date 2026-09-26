/**
 * Verify all Postgres Living Care Record stores
 */
import "./_verify-env.mts";

async function main(): Promise<void> {
  console.log("=== Verify All Postgres LCR Stores ===\n");

  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL not set - skipping Postgres integration tests");
    console.log("Set DATABASE_URL to run full Postgres verification");
    return;
  }

  console.log("DATABASE_URL set - running full Postgres verification\n");

  // Test ACS
  console.log("--- Active Care Situation ---");
  const { createPostgresActiveCareSituationStore } = await import("../src/lib/active-care-situation/postgres-store");
  const acsStore = await createPostgresActiveCareSituationStore();
  const acsTestId = "verify-acs-" + Date.now();
  await acsStore.set(acsTestId, {
    id: "acs-verify-" + Date.now(),
    care_recipient_id: acsTestId,
    caregiver_id: "verify-caregiver",
    opened_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    root_event_id: null,
    subject_label: "Verify Subject",
    theme: "mixed",
    observations: [],
    open_questions: [],
    asked_questions: [],
    understanding_stage: "gathering",
    connection_note: null,
    synthesis: null,
    what_matters_now: null,
    lifecycle_status: "active",
    last_understanding_effect: null,
    last_understanding_delta: null,
    pattern_label: null,
    familiarity_baseline: [],
    compound_signal: null,
    trajectory_by_domain: {},
    cross_signal_correlations: [],
    continuity_hooks: [],
  });
  const acsRetrieved = await acsStore.get(acsTestId);
  if (!acsRetrieved) throw new Error("ACS verify failed");
  console.log("✓ ACS round-trip successful");
  await acsStore.delete(acsTestId);

  // Test CRS
  console.log("--- Care Reality State ---");
  const { createPostgresCareRealityStateStore } = await import("../src/lib/care-reality-state/postgres-store");
  const crsStore = await createPostgresCareRealityStateStore();
  const crsTestId = "verify-crs-" + Date.now();
  await crsStore.set(crsTestId, {
    id: "crs-verify-" + Date.now(),
    care_recipient_id: crsTestId,
    caregiver_id: "verify-caregiver",
    care_recipient_label: "Verify Subject",
    updated_at: new Date().toISOString(),
    situation_id: null,
    root_event_id: null,
    understanding_stage: "gathering",
    disclosure_stage: "early",
    current_understanding: [],
    supporting_evidence: [],
    situation_summary: null,
    pattern_label: null,
    what_matters_now: null,
    open_uncertainties: [],
    resolved_uncertainties: [],
    what_changed_in_understanding: null,
    understanding_effect: "opens_situation",
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
  });
  const crsRetrieved = await crsStore.get(crsTestId);
  if (!crsRetrieved) throw new Error("CRS verify failed");
  console.log("✓ CRS round-trip successful");
  await crsStore.delete(crsTestId);

  // Test Decision Memory
  console.log("--- Decision Memory ---");
  const { createPostgresDecisionMemoryStore } = await import("../src/lib/decision-memory/postgres-store");
  const dmStore = await createPostgresDecisionMemoryStore();
  const dmTestKey = "verify-dm-" + Date.now();
  await dmStore.add(dmTestKey, {
    id: "dm-verify-" + Date.now(),
    care_key: dmTestKey,
    what: "Verify decision",
    decision: "Verify decision",
    when: new Date().toISOString(),
    who: ["verify-caregiver"],
    context_situation_id: null,
    context_summary: null,
    evidence: [{ source: "note", text: "Verify evidence" }],
    alternatives: [],
    reason: "Verify reason",
    outcome: null,
    outcome_event_ids: [],
    status: "active",
    evidence_texts: ["Verify evidence"],
    recorded_at: new Date().toISOString(),
    content_tokens: ["verify", "decision"],
  });
  const dmEntries = await dmStore.list(dmTestKey);
  if (dmEntries.length !== 1) throw new Error("DM verify failed");
  console.log("✓ Decision Memory round-trip successful");
  await dmStore.clear(dmTestKey);

  // Test Care Recipient Identity
  console.log("--- Care Recipient Identity ---");
  const { createPostgresCareRecipientIdentityStore } = await import("../src/lib/care-recipient-identity/postgres-store");
  const criStore = await createPostgresCareRecipientIdentityStore();
  const criTestKey = "verify-cri-" + Date.now();
  await criStore.set(criTestKey, {
    care_key: criTestKey,
    display_name: "Mom",
    relationship: "mother",
    updated_at: new Date().toISOString(),
  });
  const criRetrieved = await criStore.get(criTestKey);
  if (!criRetrieved || criRetrieved.display_name !== "Mom") throw new Error("CRI verify failed");
  console.log("✓ Care Recipient Identity round-trip successful");
  await criStore.delete(criTestKey);

  // Test Care Events
  console.log("--- Care Events (Event-Sourced) ---");
  const { createPostgresCareEventStore } = await import("../src/lib/event-sourced-storage/postgres-store");
  const ceStore = await createPostgresCareEventStore();
  const ceTestId = "verify-ce-" + Date.now();
  await ceStore.append({
    id: "ce-verify-" + Date.now(),
    care_recipient_id: ceTestId,
    caregiver_id: "verify-caregiver",
    event_id: "event-verify-" + Date.now(),
    event_type: "observation",
    situation_id: "situation-verify",
    source: "note",
    payload: { text: "Verify observation" },
    metadata: {},
    correlation_id: "corr-verify",
    causation_id: null,
    created_at: new Date().toISOString(),
  });
  const ceEvents = await ceStore.getByCareRecipient(ceTestId);
  if (ceEvents.length !== 1) throw new Error("CE verify failed");
  console.log("✓ Care Events round-trip successful");
  await ceStore.clear(ceTestId);

  console.log("\n=== All Postgres LCR Stores Verified ===");
}

main().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});