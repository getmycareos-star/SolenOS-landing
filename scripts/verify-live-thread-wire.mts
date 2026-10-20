/**
 * Live-path wiring: thread ingestion is used from situation pipeline (G6 Locked B).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  looksLikeCareThread,
  ingestCareThread,
  caregiverFacingFragmentText,
  THREAD_SOURCE_EVIDENCE_PREFIX,
  listThreadSourceEvidence,
  resetThreadSourceEvidenceStore,
} from "../src/lib/thread-ingestion";
import {
  resetActiveCareSituationStore,
  getActiveCareSituation,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { buildLivingCareRecordResponse } from "../src/lib/living-care-record-ux";
import { processSituationInput, resetCareContextRootStore } from "../src/lib/situation-entry";
import { resetPolicyEngineStore, seedVerifyConsent } from "../src/lib/policy-engine";
import type { SituationResponse } from "../src/lib/situation-entry/types";

console.log("=== Live wire: thread ingestion + LCR display ===\n");

const thread = `Alex: Mom fell in the hallway this morning.
Sam: They went to urgent care after.
Alex: The doctor stopped one of her evening pills.
Sam: Now she says she is afraid to walk to the kitchen.`;

// Source gate: pipeline must call thread helpers on raw (newline) text
{
  const pipeline = fs.readFileSync(
    path.join(process.cwd(), "src/lib/situation-entry/pipeline.ts"),
    "utf8",
  );
  assert(pipeline.includes("looksLikeCareThread"), "pipeline detects threads");
  assert(pipeline.includes("ingestCareThread"), "pipeline ingests threads");
  assert(pipeline.includes("rawThreadCandidate"), "pipeline uses raw newline thread candidate");
  assert(!/baseKind:\s*acsKind/.test(pipeline), "pipeline must not force one kind for whole thread");
  console.log("✓ pipeline wires G6 thread ingestion (Locked B)");
}

assert.equal(looksLikeCareThread("Short note."), false, "short notes not threads");
assert.equal(looksLikeCareThread(thread), true, "speaker thread detected");

{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetCareEpistemicsStores();
  resetThreadSourceEvidenceStore();
  const careKey = "cg_live_thread";
  const result = ingestCareThread({
    caregiverId: careKey,
    rawThread: thread,
    nowIso: "2026-07-17T18:00:00.000Z",
  });
  assert(result.multiple_linked_events, "multi linked");
  const acs = getActiveCareSituation(careKey)!;
  assert(acs.observations.length >= 2, "ACS grew");
  assert(
    !acs.observations.some((o) => o.human_fact.includes(THREAD_SOURCE_EVIDENCE_PREFIX)),
    "human_fact never shows thread-source",
  );

  const lastTurn = result.turns[result.turns.length - 1]!;
  const fakeResponse = {
    events_created: [],
    document_events_count: 0,
    what_i_understood: [],
    active_care_situation: lastTurn.situation,
    active_care_situation_turn: lastTurn,
  } as unknown as SituationResponse;

  const view = buildLivingCareRecordResponse({
    response: fakeResponse,
    rawInput: thread,
  });
  assert(view.evidence_line !== undefined, "evidence_line field present");
  for (const line of view.expandable.evidence ?? []) {
    assert(!line.includes(THREAD_SOURCE_EVIDENCE_PREFIX), "no envelope in evidence lines");
  }
  assert(/held|Living Care Record|Connected|Updated|stays connected/i.test(
    view.care_event_added.confirmation,
  ), "confirmation composed");
  console.log("✓ LCR view uses thread-aware compose + strips source envelope");
}

assert.equal(
  caregiverFacingFragmentText(
    `${THREAD_SOURCE_EVIDENCE_PREFIX}\nfull thread\n---\nAfraid to walk.`,
  ),
  "Afraid to walk.",
  "strip envelope",
);
assert.equal(
  caregiverFacingFragmentText(`${THREAD_SOURCE_EVIDENCE_PREFIX}\nthr_abc\n---\nFragment only.`),
  "Fragment only.",
  "strip pointer form",
);

// Live processSituationInput path
{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetCareEpistemicsStores();
  resetThreadSourceEvidenceStore();
  resetCareContextRootStore();
  resetPolicyEngineStore();
  const careKey = "cg_live_pipeline_thread";
  seedVerifyConsent(careKey);
  const response = await processSituationInput({
    raw_input: thread,
    caregiver_id: careKey,
    timestamp: "2026-07-17T18:00:00.000Z",
  });
  const acs = getActiveCareSituation(careKey);
  assert(
    (acs?.observations.length ?? 0) >= 2,
    "live pipeline → multiple ACS observations",
  );
  assert(
    listThreadSourceEvidence(careKey).some((t) => t.source_text.includes("afraid")),
    "live pipeline durable full source",
  );
  const view = buildLivingCareRecordResponse({
    response,
    rawInput: thread,
  });
  for (const line of view.expandable.evidence ?? []) {
    assert(!line.includes(THREAD_SOURCE_EVIDENCE_PREFIX), "live LCR evidence clean");
  }
  assert(
    !/chat summary|tl;dr/i.test(view.care_event_added.confirmation),
    "not a chat-summary product",
  );
  console.log("✓ processSituationInput Locked B multi-obs + durable source");
}

console.log("\n=== Live wire checks passed ===\n");
