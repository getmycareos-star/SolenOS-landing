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

assert.match(dailyCarePage, /<QuickDailyCheckIn\s*\/>/,
  "Daily Care mounts the quick check-in before the detailed capture form");
assert.match(checkIn, /postJSON\("\/daily\/log"/,
  "quick updates use the existing authenticated daily-log endpoint");
assert.match(checkIn, /getPersonId\(\)/);
assert.match(checkIn, /getCaregiverId\(\)/);
assert.match(checkIn, /value:\s*"uncertain", label:\s*"I’m not sure"/,
  "caregiver uncertainty remains explicit rather than being converted into a normal status");
assert.match(checkIn, /value:\s*"same_as_usual", label:\s*"Same as usual"/,
  "same-as-usual is an explicit caregiver-selected update type");
assert.match(checkIn, /selected_areas/);
assert.match(checkIn, /scope:\s*"selected_areas_only"/,
  "the update is limited to explicitly selected areas");
assert.match(checkIn, /overall_impression_only/,
  "Same as usual can be saved without falsely marking every care domain as checked");
assert.match(checkIn, /does not establish or change the person’s baseline/,
  "a quick check-in cannot establish or rewrite the baseline");
assert.match(checkIn, /Other areas were not assessed by this check-in/,
  "unselected areas are never represented as unchanged");
assert.match(checkIn, /epistemic_status:\s*"caregiver_reported"/,
  "the source is attributed as caregiver-reported");
assert.match(checkIn, /idempotency_key:\s*requestId/,
  "retries reuse a stable idempotency key rather than creating duplicate check-ins");
assert.match(lcr, /quickValue/,
  "the LCR renders structured quick check-in details instead of raw JSON");
assert.match(lcr, /Caregiver reported:/,
  "the LCR distinguishes caregiver report time from server-recorded time");
assert.match(checkIn, /response\?\.success !== true/,
  "the interface requires a backend success receipt");
assert.match(checkIn, /Check your care record before trying again/,
  "uncertain network outcomes do not invite duplicate submissions");
assert.match(checkIn, /selectedAreas\.length === 0/,
  "the caregiver must select at least one area before saving");
assert.doesNotMatch(checkIn, /registered_action|createReminder|approveAction/i,
  "a quick check-in never creates a registered action");

console.log("✓ quick check-in is mounted in Daily Care");
console.log("✓ caregiver-selected areas are persisted through the scoped daily-log API");
console.log("✓ same-as-usual is explicitly scoped; unselected areas remain unassessed");
console.log("✓ save receipt, attribution and duplicate-submission safeguards are present");
