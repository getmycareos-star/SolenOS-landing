import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const home = read("src/app/workspace/page.tsx");
const understanding = read("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx");
const appointments = read("src/components/app-shell/UpcomingAppointmentSummary.tsx");

assert.match(home, /<h1>Today<\/h1>/, "the primary caregiver landing page must be Today");
assert.match(home, /View the complete Care Record/, "Today must explicitly link to the complete record");
assert.match(home, /<LCRCurrentUnderstanding showNextStep \/>/, "Today must render the authoritative LCR understanding and contextual next step");
assert.match(home, /<UpcomingAppointmentSummary \/>/, "Today must retain recorded appointment information");
assert.match(home, /searchParams\.get\("prompt"\)\?\.trim\(\)\.slice\(0, 4000\)/, "Companion deep-link prompts must be bounded");
assert.match(home, /<Companion key=\{prompt\} home initialPrompt=\{prompt\} \/>/, "a Companion prompt must be opened within the shared Today shell");
assert.doesNotMatch(home, /if\s*\(prompt\)\s*\{/, "a prompt query must not replace the Today shell");
assert.doesNotMatch(home, /When you’re ready, here are two ways to continue/, "the fixed two-action panel must not return");

assert.doesNotMatch(home, /FirstVisitWorkspaceRouter/, "Today must not depend on a second first-visit presentation router");
assert.doesNotMatch(home, /CognitiveWorkspace/, "first visits must not be forced through a separate capture-only route");
assert.match(understanding, /No care information recorded yet|first-empty/, "the shared LCR view must retain an explicit empty-record state");

assert.match(understanding, /showNextStep\?: boolean/, "contextual next steps must be opt-in for the Today surface");
assert.match(understanding, /immediateCareDecisions\.length > 0/, "saved immediate follow-ups must influence the next step");
assert.match(understanding, /clarificationCareDecisions\.length > 0 \|\| watchMissingInformation\.length > 0/, "uncertainty and relevant missing information must influence the next step");
assert.match(understanding, /importantCareDecisions\.length > 0 \|\| watchChanges\.length > 0/, "important changes must influence the next step");
assert.match(understanding, /assessment\.coverage\.records_examined === 0/, "an empty record must receive an initial-record action");
assert.match(understanding, /refreshWholeRecord\(\)/, "failed or unavailable understanding must offer recovery rather than a fabricated action");
assert.match(understanding, /response\.person_id !== scopedPersonId/, "the LCR projection must be checked against the active care recipient");

assert.match(appointments, /appointment-workspaces\/preparation-brief\?window_days=90/, "appointments must use the existing persisted appointment contract");
assert.match(appointments, /Appointment information is unavailable/, "appointment retrieval failures must remain visible");

console.log("PASS: Today, first-visit convergence, Companion prompt context, record-driven next steps and appointment failure states");
