/**
 * Response Intelligence Upgrade — transformation layer acceptance gate.
 * SoT: docs/02-product/solenos-response-intelligence-upgrade.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  RESPONSE_ACCEPTANCE_PURPOSE,
  RESPONSE_ACCEPTANCE_SECTIONS,
  RESPONSE_SUMMARY_FAILURE_PATTERNS,
  assertResponseAcceptanceGate,
} from "../src/lib/response-acceptance-gate";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import {
  composeCaregiverResponse,
  assertComposedResponseProfessional,
} from "../src/lib/caregiver-response-composer";
import { classifyCareEventKind, buildLivingCareRecordResponse } from "../src/lib/living-care-record-ux";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";
import { classifyCareMemoryState } from "../src/lib/care-memory-maturity";
import { classifyCaregiverTurn } from "../src/lib/response-behavior";
import { composeCareStoryUpdate } from "../src/lib/output-quality";

const root = process.cwd();

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
}

console.log("=== Response Intelligence Upgrade ===\n");
console.log(RESPONSE_ACCEPTANCE_PURPOSE);

assert.equal(RESPONSE_ACCEPTANCE_SECTIONS.length, 6);
assert.ok(RESPONSE_ACCEPTANCE_SECTIONS.includes("recognition"));
assert.ok(RESPONSE_ACCEPTANCE_SECTIONS.includes("care_story_update"));
console.log("✓ six-section acceptance contract");

{
  const story = composeCareStoryUpdate({ isNewCareReality: true, subjectLabel: null });
  assert.ok(/First entries are saved in the care record|care story/i.test(story));
  const returning = composeCareStoryUpdate({
    isNewCareReality: false,
    subjectLabel: "Mom",
  });
  assert.ok(/Updated the Living Care Record|care record/i.test(returning));
  console.log("✓ care story update copy");
}

{
  resetAll();
  const text =
    "I don't even know where to start. She keeps asking the same questions.";
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_riu_new",
    rawText: text,
    kind: classifyCareEventKind(text),
    nowIso: "2026-07-19T20:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: text,
    kind: classifyCareEventKind(text),
  });
  assertComposedResponseProfessional(composed);
  assert.ok(composed.recognition_line?.trim(), "recognition_line required");
  assert.ok(composed.care_story_update?.trim(), "care_story_update required");
  assert.ok(!composed.connection_note?.trim(), "no fake connection on first capture");
  assert.equal(composed.show_connection, false, "new user: show_connection false");
  assert.ok(
    /ongoing care story|Living Care Record|First timeline entry|First care story entries|care record/i.test(
      composed.care_story_update!,
    ),
  );
  console.log("✓ new user — recognition + care story, no fake continuity");
}

{
  resetAll();
  const careKey = "cg_riu_ret";
  const t1 = "She repeated the same questions all morning.";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: t1,
    kind: classifyCareEventKind(t1),
    nowIso: "2026-07-19T10:00:00.000Z",
  });
  const t2 = "She asked the same questions again before lunch — my brother only sees her on weekends.";
  const turn2 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: t2,
    kind: classifyCareEventKind(t2),
    nowIso: "2026-07-19T11:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn: turn2,
    latestRawText: t2,
    kind: classifyCareEventKind(t2),
  });
  assertComposedResponseProfessional(composed);
  const hasConnection =
    Boolean(composed.connection_note?.trim()) ||
    Boolean(composed.what_changed?.trim()) ||
    composed.what_we_know.some((l) => /already held|connects|new:/i.test(l));
  assert.ok(hasConnection, "returning user must connect to prior story");
  assert.ok(composed.recognition_line?.trim());
  assert.ok(
    /already underway|care story|Decision preserved|First care story entries|First timeline entry/i.test(
      composed.care_story_update ?? "",
    ),
  );
  console.log("✓ returning user — connection + care story update");
}

{
  resetAll();
  const text = "She keeps asking the same questions.";
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_riu_reject",
    rawText: text,
    kind: classifyCareEventKind(text),
    nowIso: "2026-07-19T20:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: text,
    kind: classifyCareEventKind(text),
  });
  const bad = {
    ...composed,
    recognition_line: "Based on your message, here is what I understand.",
  };
  const careMemoryState = classifyCareMemoryState({
    observationCount: turn.situation.observations.length,
  });
  const turnClass = classifyCaregiverTurn({
    latestRawText: text,
    kind: classifyCareEventKind(text),
    turn,
  });
  let threw = false;
  try {
    assertResponseAcceptanceGate({
      composed: bad,
      careMemoryState,
      observationCount: turn.situation.observations.length,
      careWorthyCount: 1,
      latestIsCareWorthy: true,
      latestRawText: text,
      turnClass,
    });
  } catch {
    threw = true;
  }
  assert.ok(threw, "gate rejects summarization patterns");
  assert.ok(
    RESPONSE_SUMMARY_FAILURE_PATTERNS.some((p) =>
      p.test("Based on your message, here is what I understand."),
    ),
  );
  console.log("✓ gate rejects ChatGPT-style summarization");
}

{
  const sot = path.join(root, "docs/02-product/solenos-response-intelligence-upgrade.md");
  assert.ok(fs.existsSync(sot));
  const rule = path.join(root, ".cursor/rules/solenos-response-intelligence-upgrade.mdc");
  assert.ok(fs.existsSync(rule));
  const gate = fs.readFileSync(
    path.join(root, "src/lib/response-acceptance-gate/index.ts"),
    "utf8",
  );
  assert.ok(gate.includes("assertResponseAcceptanceGate"));
  const composer = fs.readFileSync(
    path.join(root, "src/lib/caregiver-response-composer/index.ts"),
    "utf8",
  );
  assert.ok(composer.includes("assertResponseAcceptanceGate"));
  assert.ok(composer.includes("recognition_line"));
  assert.ok(composer.includes("care_story_update"));
  const panel = fs.readFileSync(
    path.join(root, "src/components/mvp-workspace/LivingCareRecordPanel.tsx"),
    "utf8",
  );
  assert.ok(panel.includes("lcr-recognition"));
  assert.ok(panel.includes("lcr-care-story"));
  assert.ok(panel.includes("lcr-attention"));
  const attention = fs.readFileSync(
    path.join(root, "src/lib/response-intelligence/attention-label.ts"),
    "utf8",
  );
  assert.ok(attention.includes("humanAttentionLabelFor"));
  assert.ok(attention.includes("shouldDiscloseAttentionLevel"));
  assert.ok(!/\b\d{1,3}\s*%/.test(attention));
  console.log("✓ SoT + rule + gate wired + panel sections + attention (no scores)");
}

console.log("\n=== Response Intelligence Upgrade: all checks passed ===\n");
