import assert from "node:assert/strict";
import { projectPersistedDeltaUnderstanding } from "../src/lib/progressive-understanding/persisted-delta-projection";

const supportedRun = {
  id: "delta-run-supported",
  source_freshness: { status: "current" },
  delta: {
    caregiver_summary: "One care change is supported by saved records.",
    history_coverage: { complete: true },
    computed_changes: [
      {
        domain: "symptom",
        name: "Night waking",
        change_type: "increase",
        classification: "worsened",
        previous: "1 time",
        current: "3 times",
        certainty: "supported",
        evidence_supported: true,
        claim_supported: true,
        attention_candidate: true,
        source_record_refs: [
          { record_type: "care_event", record_id: "event-1", label: "Caregiver report" },
        ],
      },
    ],
  },
};

const supported = projectPersistedDeltaUnderstanding(supportedRun);
assert.equal(supported.freshness, "current");
assert.equal(supported.supported_change_count, 1);
assert.equal(supported.uncertain_change_count, 0);
assert.equal(supported.evidence_reference_count, 1);
assert.match(supported.what_changed_in_understanding || "", /Night waking/);
assert.match(supported.what_changed_in_understanding || "", /Reported more often/);
assert.equal(supported.trajectory_by_domain.symptom, "worsening");
assert.match(supported.what_matters_now || "", /Night waking/);
assert.equal(supported.effect, "changes_what_matters");

const uncertain = projectPersistedDeltaUnderstanding({
  id: "delta-run-uncertain",
  source_freshness: { status: "current" },
  delta: {
    history_coverage: { complete: false },
    computed_changes: [
      {
        domain: "appetite",
        name: "Eating",
        change_type: "increase",
        classification: "uncertain",
        certainty: "uncertain",
        evidence_supported: false,
        claim_supported: false,
        source_record_refs: [],
      },
    ],
    follow_ups: [{ question: "Was lunch eaten today?" }],
  },
});
assert.equal(uncertain.supported_change_count, 0);
assert.equal(uncertain.uncertain_change_count, 1);
assert.match(uncertain.what_changed_in_understanding || "", /does not yet support a clear comparison/);
assert.ok(uncertain.known_unknowns.some((item) => item.includes("Eating")));
assert.ok(uncertain.open_questions.includes("Was lunch eaten today?"));
assert.deepEqual(uncertain.trajectory_by_domain, {});

const conflict = projectPersistedDeltaUnderstanding({
  id: "delta-run-conflict",
  source_freshness: { status: "current" },
  delta: {
    computed_changes: [
      {
        domain: "appetite",
        name: "Lunch",
        change_type: "conflicting",
        classification: "conflicting",
        certainty: "supported",
        evidence_supported: true,
        claim_supported: true,
        source_record_refs: [
          { record_type: "care_event", record_id: "event-2" },
          { record_type: "evidence", record_id: "evidence-2" },
        ],
      },
    ],
    contradictions: [{ topic: "Appetite", reports: ["Ate lunch", "Did not eat lunch"] }],
  },
});
assert.ok(conflict.known_unknowns.some((item) => item.includes("Reports differ about Appetite")));
assert.equal(conflict.supported_change_count, 1);

const stale = projectPersistedDeltaUnderstanding({
  ...supportedRun,
  id: "delta-run-stale",
  source_freshness: { status: "stale" },
});
assert.equal(stale.freshness, "stale");
assert.equal(stale.supported_change_count, 0);
assert.equal(stale.what_changed_in_understanding, null);
assert.match(stale.synthesis || "", /changed since this comparison/);
assert.deepEqual(stale.trajectory_by_domain, {});

const unknownFreshness = projectPersistedDeltaUnderstanding({
  ...supportedRun,
  id: "delta-run-unverified",
  source_freshness: { status: "not_checked" },
});
assert.equal(unknownFreshness.freshness, "unknown");
assert.equal(unknownFreshness.supported_change_count, 0);
assert.equal(unknownFreshness.what_changed_in_understanding, null);

const noChange = projectPersistedDeltaUnderstanding({
  id: "delta-run-no-change",
  source_freshness: { status: "current" },
  delta: { history_coverage: { complete: true }, computed_changes: [] },
});
assert.equal(
  noChange.what_changed_in_understanding,
  "The saved records do not establish a change for this update.",
);

const incompleteHistory = projectPersistedDeltaUnderstanding({
  id: "delta-run-incomplete",
  source_freshness: { status: "current" },
  delta: { history_coverage: { complete: false }, computed_changes: [] },
});
assert.match(incompleteHistory.what_changed_in_understanding || "", /not enough earlier saved information/);
assert.ok(incompleteHistory.known_unknowns.some((item) => item.includes("earlier information is missing")));

console.log("PASS: persisted Progressive Understanding projection is evidence-grounded, freshness-aware, and non-causal.");
