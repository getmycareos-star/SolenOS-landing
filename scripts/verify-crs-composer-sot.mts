/**
 * verify-crs-composer-sot.mts
 * Phase 5.1 — CRS → composer as SoT; latest message is delta only.
 * Golden: G10–G11 returning orientation; meta must not re-ingest on second turn.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveCrsComposeContext,
  crsSupportingFacts,
} from "../src/lib/caregiver-response-composer/crs-compose-sot";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import {
  getActiveCareSituation,
  ingestActiveCareObservation,
  pauseActiveCareSituationSession,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import {
  getCareRealityState,
  resetCareRealityStateStore,
} from "../src/lib/care-reality-state";
import { classifyCareEventKind } from "../src/lib/living-care-record-ux";
import { isProductSessionMetaText } from "../src/lib/care-epistemics";

const root = process.cwd();

function resetAll(): void {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
}

console.log("=== CRS → Composer SoT (Phase 5.1) ===\n");

// Source gate — composer wires CRS-first resolve
{
  const composerSrc = fs.readFileSync(
    path.join(root, "src/lib/caregiver-response-composer/index.ts"),
    "utf8",
  );
  assert.ok(
    composerSrc.includes("resolveCrsComposeContext"),
    "composer imports resolveCrsComposeContext",
  );
  assert.ok(
    composerSrc.includes("crsCtx.heldUnderstanding"),
    "composer reads CRS held understanding",
  );
  assert.ok(
    fs.existsSync(path.join(root, "src/lib/caregiver-response-composer/crs-compose-sot.ts")),
    "crs-compose-sot module exists",
  );
  console.log("✓ composer source uses CRS compose SoT");
}

// Unit — resolveCrsComposeContext prefers CRS when returning
{
  resetAll();
  const careKey = "cg_crs_unit";
  const turn1 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway this morning.",
    kind: classifyCareEventKind("Mom fell in the hallway this morning."),
    nowIso: "2026-07-01T10:00:00.000Z",
  });
  const crs = getCareRealityState(careKey)!;
  assert.ok(crs.current_understanding.length > 0, "CRS holds understanding after care note");

  const META = "thanks for helping me organize this";
  const turn2 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: META,
    kind: classifyCareEventKind(META),
    nowIso: "2026-07-01T10:05:00.000Z",
  });
  const ctx = resolveCrsComposeContext({
    crs: getCareRealityState(careKey),
    turn: turn2,
    latestRawText: META,
    latestIsCareWorthy: false,
    isNewCareReality: false,
    turnClass: "empty_or_thin",
  });
  assert.equal(ctx.usesCrsAsSource, true, "returning turn uses CRS SoT");
  assert.ok(
    ctx.heldUnderstanding.some((l) => /fell|hallway/i.test(l)),
    "CRS held understanding includes fall",
  );
  assert.ok(
    !ctx.heldUnderstanding.some((l) => /thanks for helping/i.test(l)),
    "meta filtered from held understanding",
  );
  const facts = crsSupportingFacts(ctx.supportingEvidence, 3);
  assert.ok(
    facts.some((f) => /fell|hallway/i.test(f)) || ctx.heldUnderstanding.length > 0,
    "supporting evidence or held lines anchor to care fact",
  );
  console.log("✓ resolveCrsComposeContext — CRS first, meta filtered");
  void turn1;
}

// Done when — second turn meta references CRS held facts, not meta re-ingest
{
  resetAll();
  const careKey = "cg_crs_meta_second";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway this morning.",
    kind: classifyCareEventKind("Mom fell in the hallway this morning."),
    nowIso: "2026-07-02T10:00:00.000Z",
  });
  const META = "thanks for helping me organize this";
  assert.equal(isProductSessionMetaText(META), false, "thin thanks is not product meta");
  const turn2 = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: META,
    kind: classifyCareEventKind(META),
    nowIso: "2026-07-02T10:05:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn: turn2,
    latestRawText: META,
    kind: classifyCareEventKind(META),
  });
  const blob = [
    composed.confirmation,
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    ...composed.what_we_know,
  ].join("\n");
  assert.ok(/fell|hallway/i.test(blob), "second turn orientation references CRS held fall");
  assert.ok(!/thanks for helping/i.test(blob), "thanks line not promoted as care memory");
  console.log("✓ second turn thin note — CRS held facts without meta re-ingest");
}

// G11-style — pause + return with product meta; CRS care fact persists in compose
{
  resetAll();
  const careKey = "cg_crs_g11";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Mom fell in the hallway this morning.",
    kind: classifyCareEventKind("Mom fell in the hallway this morning."),
    nowIso: "2026-04-01T10:00:00.000Z",
  });
  const crsBefore = getCareRealityState(careKey);
  assert.ok(crsBefore != null, "CRS before pause");
  pauseActiveCareSituationSession(careKey);

  const PRODUCT_META =
    "hi solenos, this is my first time here, i just got recommended that youd help me";
  const turnReturn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: PRODUCT_META,
    kind: classifyCareEventKind(PRODUCT_META),
    nowIso: "2026-04-01T12:00:00.000Z",
  });
  const crsAfter = getCareRealityState(careKey);
  assert.equal(crsAfter?.id, crsBefore?.id, "G11 CRS persists");
  const composed = composeCaregiverResponse({
    turn: turnReturn,
    latestRawText: PRODUCT_META,
    kind: classifyCareEventKind(PRODUCT_META),
  });
  const blob = [
    composed.confirmation,
    composed.situation_summary ?? "",
    ...composed.what_we_know,
    composed.connection_note ?? "",
  ].join("\n");
  assert.ok(/fell|hallway/i.test(blob), "G11 return compose references CRS held care fact");
  assert.ok(!/hi solenos|first time here/i.test(blob), "G11 return must not re-ingest product meta");
  console.log("✓ G11-style return — CRS held facts, meta not re-ingested");
}

// G10-style — care held across pause; compose on return references prior CRS
{
  resetAll();
  const careKey = "cg_crs_g10";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "She has been more confused since the hospital stay.",
    kind: classifyCareEventKind("She has been more confused since the hospital stay."),
    nowIso: "2026-05-01T09:00:00.000Z",
  });
  pauseActiveCareSituationSession(careKey);
  const turnReturn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "just checking back in",
    kind: classifyCareEventKind("just checking back in"),
    nowIso: "2026-05-01T14:00:00.000Z",
  });
  assert.ok(getActiveCareSituation(careKey) != null, "ACS restored");
  const composed = composeCaregiverResponse({
    turn: turnReturn,
    latestRawText: "just checking back in",
    kind: classifyCareEventKind("just checking back in"),
  });
  const blob = [...composed.what_we_know, composed.situation_summary ?? ""].join(" ");
  assert.ok(
    /confused|hospital/i.test(blob),
    "G10 return references CRS held confusion/hospital thread",
  );
  console.log("✓ G10-style return — orientation from CRS not thin check-in alone");
}

// Slice 5.4 — thin care thread continuation remains care-worthy; meta still filtered
{
  resetAll();
  const careKey = "cg_crs_thin_thread";
  ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "She repeated the same questions all morning.",
    kind: classifyCareEventKind("She repeated the same questions all morning."),
    nowIso: "2026-07-20T10:00:00.000Z",
  });
  const thinTurn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "Same questions again",
    kind: classifyCareEventKind("Same questions again"),
    nowIso: "2026-07-20T14:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn: thinTurn,
    latestRawText: "Same questions again",
    kind: classifyCareEventKind("Same questions again"),
  });
  const blob = [
    composed.confirmation,
    composed.what_changed ?? "",
    ...composed.what_we_know,
  ].join("\n");
  assert.ok(
    /question/i.test(blob),
    "thin follow-up compose stays on repeated-questions care thread",
  );
  assert.ok(
    !/nothing about.*care is held yet/i.test(composed.confirmation),
    "thin care continuation must not look like empty care reality",
  );

  const metaTurn = ingestActiveCareObservation({
    caregiverId: careKey,
    rawText: "hi solenos first time here help me",
    kind: classifyCareEventKind("hi solenos first time here help me"),
    nowIso: "2026-07-20T14:05:00.000Z",
  });
  const metaComposed = composeCaregiverResponse({
    turn: metaTurn,
    latestRawText: "hi solenos first time here help me",
    kind: classifyCareEventKind("hi solenos first time here help me"),
  });
  const metaBlob = [...metaComposed.what_we_know, metaComposed.confirmation].join("\n");
  assert.ok(/question/i.test(metaBlob), "meta after thin thread still orients from CRS");
  assert.ok(!/hi solenos|first time here/i.test(metaBlob), "meta not promoted as care fact");
  console.log("✓ Slice 5.4 thin-note + meta fixtures on CRS compose path");
}

console.log("\nverify:crs-composer-sot OK");
