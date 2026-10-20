/**
 * Care Reality Situation Model — before language; baseline→change orientation.
 * SoT: docs/02-product/solenos-care-reality-situation-model.md
 *
 * Illustration fixtures only — never product if-branches.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CARE_REALITY_SITUATION_MODEL_PURPOSE,
  buildCareRealitySituationModel,
  orientationFromSituationModel,
} from "../src/lib/care-reality-intelligence";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetFamiliarityBaselineStore } from "../src/lib/care-epistemics";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import {
  RESPONSE_ORIENTATION_ANTIPATTERN,
} from "../src/lib/response-acceptance-gate";
import { containsKeywordClassifierTheater } from "../src/lib/care-reality-intelligence";

console.log("=== Care Reality Situation Model ===\n");
console.log(CARE_REALITY_SITUATION_MODEL_PURPOSE);

const sot = readFileSync(
  join(process.cwd(), "docs/02-product/solenos-care-reality-situation-model.md"),
  "utf8",
);
assert.ok(/Build Care Reality Model before generating language/i.test(sot));
assert.ok(/Ingestion → Extraction → Prioritization → Situation modeling/i.test(sot));
assert.ok(/Do not patch examples/i.test(sot));
console.log("✓ SoT + pipeline discipline present");

assert.ok(RESPONSE_ORIENTATION_ANTIPATTERN.some((p) => p.test("Here are your tasks")));
assert.ok(RESPONSE_ORIENTATION_ANTIPATTERN.some((p) => p.test("You should contact the clinic")));
assert.ok(RESPONSE_ORIENTATION_ANTIPATTERN.some((p) => p.test("Your care summary")));
console.log("✓ orientation anti-patterns registered");

{
  // Illustration: baseline→change without clinical keywords
  const raw =
    "I don't know what's wrong with dad. He used to sit outside every morning but now he just stays in bed and doesn't want to talk.";
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();

  const turn = ingestActiveCareObservation({
    caregiverId: "crm_baseline_dad",
    rawText: raw,
    kind: "general",
    nowIso: "2026-07-20T18:00:00.000Z",
  });

  const model = buildCareRealitySituationModel({
    situation: turn.situation,
    latestRawText: raw,
    careKey: "crm_baseline_dad",
  });
  assert.ok(model.can_orient, "model can orient from baseline change");
  assert.ok(model.baseline || model.observed_changes.length > 0, "baseline or change held");
  assert.ok(
    !/detected keywords|confusion|medication change/i.test(
      JSON.stringify(model.observed_changes),
    ),
  );
  const orient = orientationFromSituationModel(model);
  assert.ok(orient.current_understanding || orient.what_changed, "orientation from model");
  assert.ok(
    !/user mentioned sitting outside/i.test(
      `${orient.current_understanding ?? ""} ${orient.what_changed ?? ""}`,
    ),
    "must not reduce to word mention theater",
  );
  assert.ok(
    /usual|different|now|before|bed|talk|outside|activity|pattern/i.test(
      `${orient.current_understanding ?? ""} ${orient.what_changed ?? ""}`,
    ),
    "must speak change-from-baseline",
  );

  const composed = composeCaregiverResponse({
    turn,
    latestRawText: raw,
    kind: "general",
  });
  const blob = [
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    composed.confirmation,
    ...(composed.what_we_know ?? []),
  ].join(" ");
  assert.ok(!containsKeywordClassifierTheater(blob));
  assert.ok(!RESPONSE_ORIENTATION_ANTIPATTERN.some((p) => p.test(blob)));
  assert.ok(
    !/here are your (?:tasks|notes)|care summary|most important sentence/i.test(blob),
  );
  // Family/load not in this fixture — brother not present
  assert.ok(
    /bed|talk|outside|usual|different|changed|morning|activity|pattern|stays/i.test(blob),
    `composer should orient to care reality change — got: ${blob.slice(0, 400)}`,
  );
  console.log("✓ baseline→change messy input → orientation (not keyword/summary theater)");
}

{
  const raw =
    "My brother thinks I'm overreacting. She stopped eating after they changed her medication.";
  const model = buildCareRealitySituationModel({
    situation: {
      id: "s1",
      care_recipient_id: "cr_x",
      caregiver_id: "cg_x",
      opened_at: "2026-07-20T18:00:00.000Z",
      updated_at: "2026-07-20T18:00:00.000Z",
      root_event_id: null,
      subject_label: "Mom",
      theme: null,
      observations: [],
      open_questions: [],
      asked_questions: [],
      understanding_stage: "gathering",
      connection_note: null,
      synthesis: null,
      what_matters_now: null,
      last_understanding_effect: null,
      last_understanding_delta: null,
      pattern_label: null,
      familiarity_baseline: [],
    },
    latestRawText: raw,
    careKey: "cr_x",
  });
  assert.ok(
    model.context_only.some((c) => /brother|overreact/i.test(c)) ||
      model.extraction?.non_care_facts.some((n) => n.layer === "disagreement_perspective"),
    "family perspective is context, not ignored",
  );
  assert.ok(
    model.observed_changes.length > 0 || model.decisions.length > 0,
    "observed change / decision ranked above family dispute",
  );
  console.log("✓ family perspective = context; observed change = primary");
}

console.log("\nverify:care-reality-situation-model OK");
