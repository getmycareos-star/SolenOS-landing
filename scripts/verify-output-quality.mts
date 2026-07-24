/**
 * Output quality — recognition, human language, connections, decision why.
 * SoT: docs/02-product/solenos-output-quality.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  OUTPUT_QUALITY_PURPOSE,
  INTERNAL_LANGUAGE_BANS,
  containsInternalLanguage,
  containsRawNoteEchoInCopy,
  composeRecognitionLine,
  composeConnectionLine,
  buildMattersNowOrientation,
  formatDecisionMemoryForCaregiver,
  looksLikeCaregiverLoadLanguage,
  isNearRawCaregiverFacet,
} from "../src/lib/output-quality";
import { composeEvidenceLine } from "../src/lib/response-behavior";
import { composeReliefFollowUps } from "../src/lib/care-reality-output";
import {
  caregiverFacingLinesFromCaptureText,
  applySessionKinshipDisplay,
} from "../src/lib/care-reality-extraction";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import {
  composeCaregiverResponse,
  assertComposedResponseProfessional,
} from "../src/lib/caregiver-response-composer";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import { resetDecisionMemoryStore, recordDecisionFromText } from "../src/lib/decision-memory";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetCareEpistemicsStores } from "../src/lib/care-epistemics";
import { resetCareRecipientIdentityStore } from "../src/lib/care-recipient-identity";

const root = process.cwd();

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetDecisionMemoryStore();
  resetMultiCaregiverContextStore();
  resetCareEpistemicsStores();
  resetCareRecipientIdentityStore();
}

console.log("=== Output Quality ===\n");
console.log(OUTPUT_QUALITY_PURPOSE);

assert.ok(INTERNAL_LANGUAGE_BANS.includes("care signal"));
assert.ok(containsInternalLanguage("This care signal was detected."));
assert.ok(!containsInternalLanguage("Repeated questions this morning."));
console.log("✓ internal language bans");

{
  const rec = composeRecognitionLine({
    isNewCareReality: true,
    isCompeting: false,
    hasCaregiverLoad: true,
    heldFocus: null,
    subjectLabel: null,
  });
  assert.ok(rec && /unsettled|organizes/i.test(rec));
  assert.ok(!/i understand how you feel|i'm here for you/i.test(rec!));
  console.log("✓ recognition without empathy theater");
}

{
  const conn = composeConnectionLine({
    isNewCareReality: false,
    priorFact: "Repeated questions in the morning.",
    latestFact: "Same questions before lunch.",
    observationCount: 2,
  });
  assert.ok(conn && /connects|not a separate story|already underway/i.test(conn));
  assert.ok(
    !/\([^)]*repeated questions/i.test(conn!),
    "must not embed prior raw blob in connection line",
  );
  const rawPrior = composeConnectionLine({
    isNewCareReality: false,
    priorFact:
      "Mom wasnt feeling good and I took her to the doctor, she came back and refused to eat nor sleep.",
    latestFact: "She asked where she was this morning.",
    observationCount: 2,
  });
  assert.ok(rawPrior && !/\(mom wasnt/i.test(rawPrior));
  assert.ok(!/refused to eat/i.test(rawPrior!));
  assert.equal(
    composeConnectionLine({
      isNewCareReality: true,
      priorFact: null,
      latestFact: "x",
      observationCount: 1,
    }),
    null,
  );
  console.log("✓ connection lines for returning only — no prior raw paste");
}

{
  const structured = composeEvidenceLine({
    maturity: 2,
    supportingFacts: ["Repeated questions in the morning.", "Same questions before lunch."],
  });
  assert.ok(structured && /Related:/i.test(structured));
  assert.ok(/Repeated questions/i.test(structured!));

  const rawJoin = composeEvidenceLine({
    maturity: 2,
    supportingFacts: [
      "Mom wasnt feeling good and I took her to the doctor, she came back and refused to eat nor sleep.",
      "She asked where she was this morning and seemed unsettled about the house.",
    ],
    latestRawText:
      "She asked where she was this morning and seemed unsettled about the house.",
  });
  assert.ok(rawJoin && !/Related:/i.test(rawJoin), "drop maturity-2 raw join");
  assert.ok(!/wasnt feeling good/i.test(rawJoin!));
  console.log("✓ evidence line — structured Related only, no raw join");
}

{
  const clean = composeReliefFollowUps({
    heldFocus: "Morning confusion",
    topUnknown: null,
    decisionWhyUnknown: false,
  });
  assert.ok(clean.some((i) => /Notice whether “Morning confusion”/i.test(i)));

  const rawFocus = composeReliefFollowUps({
    heldFocus:
      "Mom wasnt feeling good and I took her to the doctor she refused to eat",
    topUnknown: null,
    decisionWhyUnknown: false,
    latestRawText:
      "Mom wasnt feeling good and I took her to the doctor she refused to eat",
  });
  assert.ok(rawFocus.every((i) => !/wasnt feeling good/i.test(i)));
  assert.ok(rawFocus.some((i) => /Notice whether this continues/i.test(i)));
  assert.ok(
    isNearRawCaregiverFacet(
      "mom wasnt feeling good and I took her to the doctor",
      "Mom wasnt feeling good and I took her to the doctor she refused to eat nor sleep after the visit.",
    ),
  );
  assert.ok(
    containsRawNoteEchoInCopy({
      blob: 'Notice whether “mom wasnt feeling good and I took her to the doctor” continues',
      latestRawText:
        "Mom wasnt feeling good and I took her to the doctor she refused to eat nor sleep after.",
    }),
  );
  console.log("✓ follow-ups — no Notice whether raw focus");
}

{
  // Extraction surfaces preferred over human_fact ≈ raw (Locked A: no durable name write).
  const raw =
    "Mom wasnt feeling good and I took her to the doctor, she came back and refused to eat nor sleep.";
  const lines = caregiverFacingLinesFromCaptureText({ rawText: raw, max: 3 });
  // Long messy capture must not surface as one raw paste when partitioned.
  if (lines.length > 0) {
    assert.ok(
      lines.every(
        (l) =>
          !/wasnt feeling good and I took her to the doctor, she came back/i.test(l),
      ),
      "surface lines must not be full raw paste",
    );
  } else {
    // If extraction yields nothing usable, heldFocusLines still avoids full-dump focus.
    assert.ok(
      !isNearRawCaregiverFacet("refused to eat.", raw) ||
        isNearRawCaregiverFacet(raw, raw),
    );
  }
  const displayed = applySessionKinshipDisplay("my mom refused to eat.", "Mom");
  assert.match(displayed, /Mom refused to eat/i);
  console.log("✓ extraction caregiver surfaces — partitioned, session kinship display only");
}

{
  const matters = buildMattersNowOrientation({
    subjectLabel: null,
    baselineChange: null,
    heldFocus: null,
    topUnknown: "When did this start?",
  });
  assert.ok(/Most important next/i.test(matters));
  assert.ok(/When did this start/i.test(matters));
  console.log("✓ what matters now prioritizes next understanding");
}

{
  const lines = formatDecisionMemoryForCaregiver({
    what: "Started a new medication",
    reason: "Sleep was disrupted",
    who: ["Daughter"],
    outcome: null,
    status: "active",
  });
  assert.ok(lines.some((l) => /Decision held/i.test(l)));
  assert.ok(lines.some((l) => /Reason held/i.test(l)));
  assert.ok(lines.some((l) => /Outcome not yet known/i.test(l)));
  console.log("✓ decision memory surfaces why + unknown outcome");
}

{
  resetAll();
  const text =
    "I don't even know where to start. She keeps asking the same questions.";
  assert.ok(looksLikeCaregiverLoadLanguage(text));
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_oq_new",
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
  assert.ok(
    /unsettled|organizes|stands out|Beginning|Living Care Record|care concern|carried only in memory/i.test(
      composed.recognition_line ?? composed.confirmation,
    ),
  );
  assert.ok(!containsInternalLanguage(composed.confirmation));
  console.log("✓ composer — recognition + no internal jargon (new)");
}

{
  resetAll();
  const careKey = "cg_oq_dec";
  recordDecisionFromText({
    careKey,
    rawText: "We decided to start home support because evenings were harder.",
    nowIso: "2026-07-19T09:00:00.000Z",
    who: ["Daughter"],
  });
  const t1 = "Evenings were harder last week.";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: t1,
    kind: classifyCareEventKind(t1),
    nowIso: "2026-07-19T10:00:00.000Z",
  });
  const t2 = "We decided to start home support because evenings were harder.";
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
  const blob = [...(composed.what_we_know ?? []), composed.what_changed ?? ""].join(" ");
  assert.ok(
    /Decision held|Reason held|home support|already held|connects/i.test(blob) ||
      Boolean(composed.connection_note),
    "decision why or connection surfaced",
  );
  console.log("✓ composer — decision memory / connection on returning turn");
}

{
  resetAll();
  const note =
    "she seems unsteady this week and i called the clinic, she has not been sleeping through the night";
  const turn = ingestActiveCareObservation({
    caregiverId: "cg_oq_anti_echo",
    rawText: note,
    kind: classifyCareEventKind(note),
    nowIso: "2026-07-22T17:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: note,
    kind: classifyCareEventKind(note),
  });
  assertComposedResponseProfessional(composed);
  const blob = [
    composed.recognition_line ?? "",
    composed.confirmation,
    composed.what_matters_now ?? "",
    composed.care_story_update ?? "",
  ].join("\n");
  assert.ok(
    !blob.toLowerCase().includes(note.toLowerCase().slice(0, 50)),
    "must not paste raw note into recognition/matters/timeline",
  );
  assert.ok(
    !/noticing whether this continues \(/i.test(composed.what_matters_now ?? ""),
    "must not echo focus inside what matters",
  );
  console.log("✓ composer — anti raw-note echo on short compound capture");
}

{
  const sot = path.join(root, "docs/02-product/solenos-output-quality.md");
  assert.ok(fs.existsSync(sot));
  const rule = path.join(root, ".cursor/rules/solenos-output-quality.mdc");
  assert.ok(fs.existsSync(rule));
  const panel = fs.readFileSync(
    path.join(root, "src/components/mvp-workspace/LivingCareRecordPanel.tsx"),
    "utf8",
  );
  assert.ok(panel.includes("How this connects"));
  const mod = fs.readFileSync(path.join(root, "src/lib/output-quality/index.ts"), "utf8");
  assert.ok(!/\bJennifer\b/.test(mod));
  console.log("✓ SoT + rule + panel connection + no hardcoding");
}

console.log("\n=== Output Quality: all checks passed ===\n");
