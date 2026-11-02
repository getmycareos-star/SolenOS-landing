import assert from "node:assert/strict";
import fs from "node:fs";

const panel = fs.readFileSync("src/components/mvp-workspace/PossibleRelationshipsPanel.tsx", "utf8");
const lcr = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const clarification = fs.readFileSync("src/components/ClarificationWorkflowPanel.tsx", "utf8");
const timeline = fs.readFileSync("src/app/workspace/timeline/page.tsx", "utf8");

for (const contract of [
  /Possible Relationships/,
  /\/change\/patterns\//,
  /detail\.pattern\.person_id !== personId/,
  /pattern\.is_active/,
  /superseded_by_pattern_id/,
  /pattern\.pattern_strength/,
  /alternative_interpretations/,
  /occurred_at/,
  /recorded_at/,
  /evidence_ids/,
  /contributor_label/,
  /evidence_reviews/,
  /contestedReviews/,
  /Open original observation in Longitudinal Care History/,
  /Not enough evidence to identify a meaningful relationship/,
  /\/care-continuity\/review-decisions/,
  /review_decision: decision/,
  /reviewed_by_caregiver_id/,
  /not_applicable/,
  /disputed/,
  /lcr-clarification-workflow/,
  /(?:does not establish|neither establishes) that one event caused another/,
]) {
  assert.match(panel, contract, `Possible Relationships contract missing: ${contract}`);
}

assert.match(lcr, /<PossibleRelationshipsPanel personId={personId} patterns={patterns} patternsError={patternsError} \/>/);
assert.match(lcr, /id="lcr-clarification-workflow"/);
assert.match(clarification, /id\?: string/);
assert.doesNotMatch(panel, /\/causal\//i, "The caregiver UI must not call the unsecured causal API.");
assert.doesNotMatch(panel, /mock|sample|demo pattern|fabricated/i, "The caregiver UI must not generate mock relationship records.");

console.log("Possible Relationships contract checks passed: persisted same-person patterns, source timestamps and references, uncertainty, supersession, caregiver review attribution, clarification handoff, and no causal endpoint exposure.");
