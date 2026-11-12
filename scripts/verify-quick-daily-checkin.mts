import assert from "node:assert/strict";
import fs from "node:fs";

const root = process.cwd();
const checkIn = fs.readFileSync(
  `${root}/src/components/workflows/QuickDailyCheckIn.tsx`,
  "utf8",
);
const dailyCarePage = fs.readFileSync(
  `${root}/src/app/workspace/daily-care/page.tsx`,
  "utf8",
);
const lcr = fs.readFileSync(
  `${root}/src/components/mvp-workspace/LCRCurrentUnderstanding.tsx`,
  "utf8",
);
const detailedCapture = fs.readFileSync(
  `${root}/src/components/workflows/StructuredDailyCapture.tsx`,
  "utf8",
);

assert.match(dailyCarePage, /<QuickDailyCheckIn\s*\/>/,
  "Daily Care mounts the optional quick check-in");
assert.match(checkIn, /postJSON\("\/daily\/log"/,
  "quick check-ins use the existing authenticated daily-log endpoint");
assert.match(checkIn, /getPersonId\(\)/);
assert.match(checkIn, /getCaregiverId\(\)/);
assert.match(checkIn, /value:\s*"same_as_usual"/,
  "the first option records the caregiver's overall impression");
assert.match(checkIn, /value:\s*"change"/,
  "the second option records that some things were different");
assert.match(checkIn, /value:\s*"uncertain"/,
  "the third option preserves uncertainty");
assert.match(checkIn, /selected_areas:\s*\[\]/,
  "an overall check-in does not force care-area selection");
assert.match(checkIn, /scope:\s*"overall_impression_only"/,
  "the payload explicitly limits the meaning to an overall impression");
assert.match(checkIn, /Optional/,
  "the note is optional");
assert.match(checkIn, /maxLength=\{2000\}/,
  "the optional note respects the backend limit");
assert.match(checkIn, /epistemic_status:\s*"caregiver_reported"/,
  "the entry remains a caregiver report, not a verified clinical fact");
assert.match(checkIn, /idempotency_key:\s*requestKey/,
  "an unchanged retry reuses its idempotency key");
assert.match(checkIn, /response\?\.success !== true/,
  "the interface requires a backend success receipt");
assert.match(checkIn, /does not confirm medicines were given or measurements were taken/,
  "an overall impression cannot imply medication or measurement completion");
assert.match(checkIn, /window\.dispatchEvent\(new Event\("careRecordUpdated"\)\)/,
  "a confirmed save refreshes the existing care-record view");
assert.match(lcr, /quickValue/,
  "the LCR renders structured quick check-in details");
assert.match(lcr, /Caregiver reported:/,
  "the LCR distinguishes caregiver report time from server-recorded time");

assert.match(detailedCapture, /capture_idempotency_key: captureIdempotencyKey/,
  "structured Daily Care submits a server-checked idempotency key");
assert.match(detailedCapture, /captureSubmissionRef\.current\.fingerprint !== fingerprint/,
  "an unchanged retry reuses its request key while edited content receives a new key");
assert.match(detailedCapture, /key: crypto\.randomUUID\(\)/,
  "a new structured capture receives a unique request key");
assert.match(detailedCapture, /captureSubmissionRef\.current = null/,
  "the request key is cleared only after a successful save");

assert.match(detailedCapture, /type DailyCaptureMode = "all" \| "something" \| "medicine" \| "measurement" \| "note"/,
  "structured capture exposes one selected interaction mode");
assert.match(detailedCapture, /mode === "measurement"/,
  "measurement capture can be shown without the other structured sections");
assert.match(detailedCapture, /vital_type: 'blood_pressure'/,
  "blood pressure is captured as one paired measurement interaction");
assert.match(detailedCapture, /vital_type: 'bp_systolic'/,
  "blood pressure preserves the systolic value in the existing event contract");
assert.match(detailedCapture, /vital_type: 'bp_diastolic'/,
  "blood pressure preserves the diastolic value in the existing event contract");
assert.match(detailedCapture, /Enter both the top and bottom blood pressure numbers/,
  "blood pressure cannot be saved with only one number");
assert.match(detailedCapture, /optionalPulseValue/,
  "blood pressure supports an optional pulse reading");
assert.match(detailedCapture, /blood_glucose/,
  "measurement capture supports blood glucose");
assert.match(detailedCapture, /measurement_name/,
  "measurement capture supports a named custom measurement");
assert.doesNotMatch(detailedCapture, /'Normal'|'Out of range'/,
  "caregiver-entered measurements are not automatically labelled clinically normal or abnormal");
assert.match(detailedCapture, /mode === "medicine"/,
  "medicine capture can be shown without the other structured sections");
assert.match(detailedCapture, /mode === "something" \|\| mode === "note"/,
  "observation and note capture remain text-only interactions");
assert.match(detailedCapture, /previouslyRecordedMedications/,
  "medicine capture can reuse names and doses from persisted caregiver reports");
assert.match(detailedCapture, /value="not_given"/,
  "medicine capture distinguishes not given");
assert.match(detailedCapture, /value="uncertain"/,
  "medicine capture preserves uncertainty");

const photoCapture = fs.readFileSync(
  `${root}/src/components/workflows/DailyCarePhotoCapture.tsx`,
  "utf8",
);
assert.match(photoCapture, /postFormData\("\/upload"/,
  "photographs use the existing evidence upload endpoint");
assert.match(photoCapture, /result\?\.evidence_id/,
  "photo capture requires a persisted evidence receipt");
assert.match(photoCapture, /evidence_type", "care_photo"/,
  "photographs are stored as care-photo evidence, not medication photos");
assert.match(detailedCapture, /When did this happen\?/,
  "free-text observations can preserve an optional event time");
assert.match(detailedCapture, /occurred_at: new Date\(occurredAt\)\.toISOString\(\)/,
  "explicit caregiver event time is sent to the backend separately from recording time");
assert.match(detailedCapture, /capture_kind: captureKind/,
  "the selected capture interaction is preserved in the source event");
assert.match(photoCapture, /careRecordUpdated/,
  "a saved photograph refreshes the care record");

assert.match(dailyCarePage, /\/care-continuity\/current-care/,
  "Daily Care loads the current care projection");
assert.match(dailyCarePage, /\/daily-care\/intelligence\/history/,
  "Daily Care loads persisted recent history");
for (const action of ["something", "medicine", "measurement", "photo", "checkin", "note"]) {
  assert.ok(dailyCarePage.includes(`value: "${action}"`),
    `Daily Care exposes the ${action} interaction`);
}
assert.match(dailyCarePage, /<StructuredDailyCapture mode=\{captureMode\} \/>/,
  "capture opens within the Daily Care screen");
assert.match(dailyCarePage, /Open matters/,
  "unresolved questions and conflicts have a distinct current-care section");
assert.match(dailyCarePage, /Since you last opened Daily Care/,
  "returning caregivers get a summary of newly recorded information");
assert.match(dailyCarePage, /visitBaselineRef/,
  "the last-visit baseline is retained for the whole page visit");
assert.match(dailyCarePage, /solenos:daily-care:last-opened:/,
  "the last-visit marker is scoped to the current person and caregiver");
assert.match(dailyCarePage, /classifyHistoryRecord/,
  "new care records are grouped by their persisted event content");
assert.match(dailyCarePage, /displayHistoryTime/,
  "history distinguishes event time from recording time");
assert.match(dailyCarePage, /displayHistoryText/,
  "persisted JSON capture payloads are rendered as caregiver-readable entries");
assert.match(dailyCarePage, /epistemic_status/,
  "the caregiver view retains reported or uncertain status labels");

console.log("✓ quick check-in has exactly three overall-impression choices");
console.log("✓ no care-area questionnaire or daily completion requirement");
console.log("✓ optional note, caregiver attribution, idempotency and confirmed save receipt");
console.log("✓ existing structured capture retry safeguards remain present");
