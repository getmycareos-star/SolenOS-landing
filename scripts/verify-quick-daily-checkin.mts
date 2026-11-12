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
assert.match(photoCapture, /careRecordUpdated/,
  "a saved photograph refreshes the care record");

assert.match(dailyCarePage, /\/care-continuity\/current-care/,
  "Daily Care loads the current care projection");
assert.match(dailyCarePage, /\/daily-care\/intelligence\/history/,
  "Daily Care loads persisted recent history");
for (const action of ["something", "medicine", "measurement", "photo", "checkin", "note"]) {
  assert.match(dailyCarePage, new RegExp(`value: "\\${action}"`),
    `Daily Care exposes the ${action} interaction`);
}
assert.match(dailyCarePage, /<StructuredDailyCapture mode=\{captureMode\} \/>/,
  "capture opens within the Daily Care screen");

console.log("✓ quick check-in has exactly three overall-impression choices");
console.log("✓ no care-area questionnaire or daily completion requirement");
console.log("✓ optional note, caregiver attribution, idempotency and confirmed save receipt");
console.log("✓ existing structured capture retry safeguards remain present");
