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
  splitCareThreadWithAttribution,
  recordThreadSourceEvidence,
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
const parsedSpeakers = splitCareThreadWithAttribution(thread);
assert.equal(parsedSpeakers.length, 4, "each explicit speaker block becomes its own fragment");
assert.deepEqual(
  parsedSpeakers.map((fragment) => fragment.speaker_label),
  ["Alex", "Sam", "Alex", "Sam"],
  "explicit speaker labels survive parsing in source order",
);
assert(
  parsedSpeakers.every((fragment) => fragment.speaker_attribution_status === "explicit"),
  "speaker attribution is marked explicit only for source-labelled blocks",
);
const unattributed = splitCareThreadWithAttribution(
  "She ate half her lunch today.\n\nShe seemed tired afterwards.",
);
assert(
  unattributed.every((fragment) => fragment.speaker_label === null && fragment.speaker_attribution_status === "unknown"),
  "unlabelled source statements remain unattributed rather than guessed",
);


{
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetCareEpistemicsStores();
  resetThreadSourceEvidenceStore();
  const careKey = "cg_live_thread";
  const result = ingestCareThread({
    caregiverId: careKey,
    rawThread: thread,
    contributorId: "cg_authenticated_reporter",
    nowIso: "2026-07-17T18:00:00.000Z",
  });
  assert(result.multiple_linked_events, "multi linked");
  const attributedAcs = getActiveCareSituation(careKey)!;
  assert(
    attributedAcs.observations.some((observation) =>
      observation.speaker_label === "Alex" &&
      observation.speaker_attribution_status === "explicit" &&
      observation.contributor_id === "cg_authenticated_reporter" &&
      observation.source_reference_id === result.thread_id
    ),
    "speaker, authenticated reporter and original thread source remain distinct on each observation",
  );
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

  for (let index = 0; index < 25; index += 1) {
    recordThreadSourceEvidence({
      careKey,
      sourceText: `Original source report ${index}`,
      fragmentCount: 1,
      capturedAt: new Date(Date.UTC(2026, 6, 18, 0, index)).toISOString(),
      threadId: `thread_integrity_${index}`,
    });
  }
  assert(
    listThreadSourceEvidence(careKey).length === 26,
    "original thread evidence must not be truncated after twenty reports",
  );
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
