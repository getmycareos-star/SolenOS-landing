/**
 * Live preview falsification — two-turn doctor → refuse eat/sleep.
 * Asserts the same caregiver surface as LivingCareRecordPanel
 * (buildLivingCareRecordResponse ← composeCaregiverResponse), not ACS turn raw fields.
 *
 * Finish criterion (all required before "enforced"):
 * 1. Returning ACS: no Initial Assessment filler
 * 2. No notes/raw paste theater (incl. full-capture echo of either turn)
 * 3. Care-reality change/continuity language present
 */
import { buildLivingCareRecordResponse } from "../src/lib/living-care-record-ux";
import {
  containsRawNoteEchoInCopy,
  isNearRawCaregiverFacet,
} from "../src/lib/output-quality";
import { RESPONSE_NOTES_DOCUMENTATION_PATTERNS } from "../src/lib/response-acceptance-gate";
import type { SituationResponse } from "../src/lib/situation-entry/types";

const BASE = process.env.SOLENOS_WALKTHROUGH_BASE ?? "http://localhost:3001";
const careKey = `cg_live_paste_${Date.now()}`;
const sessionId = `sess_live_paste_${Date.now()}`;

const TURN1 =
  "Mom is not feeling well and I took her to the doctor, she has not been eating or sleeping well lately.";
const TURN2 =
  "Mom wasnt feeling good and I took her to the doctor, she came back and refused to eat nor sleep.";

const INITIAL_ASSESSMENT_FILLER =
  /how they are feeling, a care visit or care moment, and daily patterns that look harder lately/i;

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
  /earlier:\s*[^\n]*took her to the doctor/i,
  /earlier:\s*[^\n]*eating or sleeping/i,
] as const;

function caregiverBlob(view: ReturnType<typeof buildLivingCareRecordResponse>): string {
  return [
    view.recognition_line ?? "",
    view.care_event_added.confirmation ?? "",
    view.what_seems_happening ?? "",
    view.what_changed_in_understanding ?? "",
    view.connection_note ?? "",
    view.evidence_line ?? "",
    view.what_matters_now ?? "",
    view.what_can_wait ?? "",
    view.care_story_update ?? "",
    ...(view.what_understood ?? []),
    ...(view.what_needs_context ?? []),
    ...(view.follow_up_items ?? []),
  ].join("\n");
}

async function postSituation(raw_input: string): Promise<SituationResponse> {
  const res = await fetch(`${BASE}/api/situation`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      caregiver_id: careKey,
      care_session_id: sessionId,
      raw_input,
    }),
  });
  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${raw.slice(0, 800)}`);
  }
  return JSON.parse(raw) as SituationResponse;
}

async function main() {
  console.log("=== Live falsify paste behavior (LCR surface) ===");
  console.log("base:", BASE);
  console.log("care_key:", careKey);

  const r1 = await postSituation(TURN1);
  const view1 = buildLivingCareRecordResponse({
    response: r1,
    rawInput: TURN1,
  });
  console.log("\n--- Turn 1 caregiver blob ---\n" + caregiverBlob(view1).slice(0, 1200));

  const r2 = await postSituation(TURN2);
  const view2 = buildLivingCareRecordResponse({
    response: r2,
    rawInput: TURN2,
  });
  const blob = caregiverBlob(view2);
  console.log("\n--- Turn 2 caregiver blob ---\n" + blob.slice(0, 1600));

  const failures: string[] = [];

  if (INITIAL_ASSESSMENT_FILLER.test(blob)) {
    failures.push("FAIL: Initial Assessment filler on returning ACS");
  }

  for (const p of PASTE_THEATER) {
    if (p.test(blob)) {
      failures.push(`FAIL: paste theater matched ${p}`);
    }
  }

  for (const p of RESPONSE_NOTES_DOCUMENTATION_PATTERNS) {
    if (p.test(blob)) {
      failures.push(`FAIL: notes-documentation pattern leaked ${p}`);
    }
  }

  if (containsRawNoteEchoInCopy({ blob, latestRawText: TURN2 })) {
    failures.push("FAIL: raw note echo of turn 2 in caregiver copy");
  }
  if (containsRawNoteEchoInCopy({ blob, latestRawText: TURN1 })) {
    failures.push("FAIL: raw note echo of turn 1 (prior) in caregiver copy");
  }

  // Near-whole paste of either capture (even without "Earlier:" prefix)
  const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase().replace(/\.$/, "");
  const blobNorm = norm(blob);
  for (const turn of [TURN1, TURN2]) {
    const t = norm(turn);
    if (t.length >= 40 && blobNorm.includes(t)) {
      failures.push(`FAIL: full-capture paste present: ${turn.slice(0, 60)}…`);
    }
  }

  // Fact lines must not be near-raw slices of either capture
  for (const line of view2.what_understood ?? []) {
    if (isNearRawCaregiverFacet(line, TURN2) || isNearRawCaregiverFacet(line, TURN1)) {
      failures.push(`FAIL: near-raw fact line in what_understood: ${line}`);
    }
  }

  const continuity =
    /held|connect|underway|observation|refus|eat|sleep|doctor|visit|care moment|related|same day|what followed/i.test(
      blob,
    );
  if (!continuity) {
    failures.push("FAIL: no care-reality change/continuity language on turn 2");
  }

  if (failures.length) {
    console.error("\n" + failures.join("\n"));
    console.error("\nNOT ENFORCED — live finish criterion failed.");
    process.exit(1);
  }

  console.log("\n✓ Live finish criterion PASSED — paste/restart enforced on LCR surface");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
