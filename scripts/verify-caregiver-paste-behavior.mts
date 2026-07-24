/**
 * Caregiver paste / restart behavior — real compose path, not phrase-ban theater alone.
 * SoT: solenos-product-integrity · initial-care-reality-assessment · care-reality-language · output-quality
 *
 * Fails today's paste when:
 * 1. Returning ACS uses Initial Assessment filler
 * 2. Notes-app delta / Related: full-sentence raw paste
 * 3. Two-turn doctor → refuse eat/sleep lacks care-reality change language
 *
 * Wired into verify:product-path — green means caregiver behavior.
 */
import "./_verify-env.mts";
import assert from "node:assert/strict";
import {
  ingestActiveCareObservation,
  resetActiveCareSituationStore,
} from "../src/lib/active-care-situation";
import { resetCareRealityStateStore } from "../src/lib/care-reality-state";
import { resetMultiCaregiverContextStore } from "../src/lib/multi-caregiver-context-model";
import { resetFamiliarityBaselineStore } from "../src/lib/care-epistemics";
import { resetDecisionMemoryStore } from "../src/lib/decision-memory";
import {
  setCareRecipientDisplayName,
  resetCareRecipientIdentityStore,
} from "../src/lib/care-recipient-identity";
import { resolveCareRealityStoreKey } from "../src/lib/multi-caregiver-context-model";
import { composeCaregiverResponse } from "../src/lib/caregiver-response-composer";
import {
  compareAgainstBaseline,
  containsHallucinatedChangeLanguage,
} from "../src/lib/care-reality-intelligence";
import { RESPONSE_NOTES_DOCUMENTATION_PATTERNS } from "../src/lib/response-acceptance-gate";
import { containsRawNoteEchoInCopy } from "../src/lib/output-quality";

console.log("=== Caregiver paste behavior (product-path) ===\n");

function resetAll() {
  resetActiveCareSituationStore();
  resetCareRealityStateStore();
  resetMultiCaregiverContextStore();
  resetFamiliarityBaselineStore();
  resetDecisionMemoryStore();
  resetCareRecipientIdentityStore();
}

function composedBlob(composed: ReturnType<typeof composeCaregiverResponse>): string {
  return [
    composed.recognition_line ?? "",
    composed.confirmation,
    composed.situation_summary ?? "",
    composed.what_changed ?? "",
    composed.connection_note ?? "",
    composed.evidence_line ?? "",
    composed.what_matters_now ?? "",
    composed.care_story_update ?? "",
    ...(composed.what_we_know ?? []),
    ...(composed.still_unclear ?? []),
    ...(composed.follow_up_items ?? []),
  ].join("\n");
}

/** Initial Assessment filler that restarts the story on returning turns. */
const INITIAL_ASSESSMENT_FILLER =
  /how they are feeling, a care visit or care moment, and daily patterns that look harder lately/i;

/** Notes-app / raw-paste theater that must never reach caregivers. */
const PASTE_THEATER = [
  /related note was added/i,
  /a related note\b/i,
  /held with today'?s notes/i,
  /today'?s notes\b/i,
  /this connects to what was already held\s*\(/i,
  /notice whether\s*[“"'][^“"']{20,}[”"']/i,
  /related:\s*[^\n]*took her to the doctor/i,
  /related:\s*[^\n]*wasnt feeling good/i,
  /related:\s*[^\n]*refused to eat/i,
] as const;

function assertNoPasteTheater(blob: string, label: string) {
  for (const p of PASTE_THEATER) {
    assert.ok(!p.test(blob), `${label}: paste theater matched ${p} — got: ${blob.slice(0, 400)}`);
  }
  assert.ok(
    !RESPONSE_NOTES_DOCUMENTATION_PATTERNS.some((p) => p.test(blob)),
    `${label}: notes-documentation pattern leaked — got: ${blob.slice(0, 400)}`,
  );
}

{
  // 1 — Returning ACS must not use Initial Assessment filler
  resetAll();
  const contributorId = "paste_returning_acs";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  const first =
    "Mom is not feeling well and I took her to the doctor, she has not been eating or sleeping well lately.";
  ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: first,
    kind: "general",
    nowIso: "2026-07-22T10:00:00.000Z",
  });

  const second =
    "Mom wasnt feeling good and I took her to the doctor, she came back and refused to eat nor sleep.";
  const turn2 = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: second,
    kind: "general",
    nowIso: "2026-07-22T18:00:00.000Z",
  });
  assert.ok(turn2.situation.observations.length >= 2);

  const comparison = compareAgainstBaseline({
    situation: turn2.situation,
    latestRawText: second,
    careKey,
    person: "Mom",
    seedFromCapture: true,
  });
  assert.equal(
    comparison.mode,
    "change_detection",
    "returning ACS must graduate out of initial_assessment",
  );
  assert.ok(comparison.has_comparable_prior);

  const composed = composeCaregiverResponse({
    turn: turn2,
    latestRawText: second,
    kind: "general",
  });
  const blob = composedBlob(composed);

  assert.ok(
    !INITIAL_ASSESSMENT_FILLER.test(blob),
    `returning ACS must not use Initial Assessment filler — got: ${blob.slice(0, 450)}`,
  );
  assert.ok(
    !containsHallucinatedChangeLanguage(blob),
    `must not invent decline without usual pattern — got: ${blob.slice(0, 450)}`,
  );
  assertNoPasteTheater(blob, "returning ACS");
  assert.ok(
    !containsRawNoteEchoInCopy({ blob, latestRawText: second }),
    `returning ACS must not echo latest raw capture — got: ${blob.slice(0, 450)}`,
  );
  console.log("✓ Returning ACS — no Initial Assessment filler, no raw paste");
}

{
  // 2 — Must not contain related-note delta / Related: full-sentence doctor paste
  resetAll();
  const contributorId = "paste_related_note_ban";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: "Mom seemed unsettled after dinner and asked the same question twice.",
    kind: "general",
    nowIso: "2026-07-22T12:00:00.000Z",
  });

  const latest =
    "Mom wasnt feeling good and I took her to the doctor, she came back and refused to eat nor sleep.";
  const turn = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: latest,
    kind: "general",
    nowIso: "2026-07-22T19:00:00.000Z",
  });
  const composed = composeCaregiverResponse({
    turn,
    latestRawText: latest,
    kind: "general",
  });
  const blob = composedBlob(composed);

  assert.ok(
    !/related note was added/i.test(blob),
    `must not speak notes-app delta — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(
    !/related:\s*[^\n]*took her to the doctor/i.test(blob),
    `must not Related: full-sentence doctor paste — got: ${blob.slice(0, 400)}`,
  );
  assert.ok(
    !/related:\s*[^\n]{80,}/i.test(blob),
    `Related: must not dump long near-raw sentences — got: ${blob.slice(0, 400)}`,
  );
  assertNoPasteTheater(blob, "related-note ban");
  console.log("✓ No related-note delta / Related: doctor full-sentence paste");
}

{
  // 3 — Two-turn doctor → refuse eat/sleep must show care-reality change language
  resetAll();
  const contributorId = "paste_doctor_refuse_change";
  const careKey = resolveCareRealityStoreKey(contributorId);
  setCareRecipientDisplayName({ careKey, displayName: "Mom" });

  const turn1Text =
    "Mom is not feeling well and I took her to the doctor, she has not been eating or sleeping well lately.";
  ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: turn1Text,
    kind: "general",
    nowIso: "2026-07-22T09:00:00.000Z",
  });

  const turn2Text =
    "Mom wasnt feeling good and I took her to the doctor, she came back and refused to eat nor sleep.";
  const turn2 = ingestActiveCareObservation({
    caregiverId: contributorId,
    rawText: turn2Text,
    kind: "general",
    nowIso: "2026-07-22T17:30:00.000Z",
  });

  const composed = composeCaregiverResponse({
    turn: turn2,
    latestRawText: turn2Text,
    kind: "general",
  });
  const blob = composedBlob(composed);

  assert.ok(
    !INITIAL_ASSESSMENT_FILLER.test(blob),
    `doctor→refuse must not restart Initial Assessment — got: ${blob.slice(0, 450)}`,
  );
  assertNoPasteTheater(blob, "doctor→refuse");

  // Care-reality change / continuity language — understanding, not notes storage.
  const hasChangeLanguage =
    Boolean(composed.what_changed?.trim()) ||
    Boolean(composed.connection_note?.trim()) ||
    /already held|already underway|related update|connect|new observation|related care moment|care situation underway|refused|eat|sleep|doctor/i.test(
      blob,
    );
  assert.ok(
    hasChangeLanguage,
    `two-turn doctor→refuse must show care-reality change/continuity — got: ${blob.slice(0, 450)}`,
  );
  assert.ok(
    /refus|eat|sleep|doctor|held|connect|underway|observation|care moment/i.test(blob),
    `must orient on care reality (visit / refuse / eat / sleep) — got: ${blob.slice(0, 450)}`,
  );
  assert.ok(
    !containsHallucinatedChangeLanguage(blob),
    `must not invent decline theater — got: ${blob.slice(0, 450)}`,
  );
  // Hollow recognition-only is not enough — some understanding field must hold substance.
  assert.ok(
    Boolean(composed.situation_summary?.trim()) ||
      Boolean(composed.what_changed?.trim()) ||
      (composed.what_we_know?.length ?? 0) > 0,
    `must surface understanding fields, not empty orientation — got: ${blob.slice(0, 450)}`,
  );

  // Dementia entry profile must influence asks/matters — never diagnosis / disease FAQ.
  const profileShaped =
    (composed.still_unclear ?? []).some((q) =>
      /eating|overnight rest|usual|changed with care/i.test(q),
    ) || /eating|overnight rest/i.test(composed.what_matters_now ?? "");
  assert.ok(
    profileShaped,
    `dementia profile must shape still_unclear or what_matters (eat/sleep) — got matters=${composed.what_matters_now} asks=${(composed.still_unclear ?? []).join(" | ")}`,
  );
  assert.ok(
    !/\b(?:dementia|alzheimer|diagnosis|diagnosed|progression|this is common in)\b/i.test(blob),
    `must never diagnose or speak dementia FAQ — got: ${blob.slice(0, 450)}`,
  );
  console.log("✓ Two-turn doctor → refuse eat/sleep — care-reality + dementia profile (no diagnosis)");
}

console.log("\nverify:caregiver-paste-behavior OK");
