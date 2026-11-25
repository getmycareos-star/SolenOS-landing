import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const home = read("src/app/workspace/page.tsx");
const understanding = read("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx");
const appointments = read("src/components/app-shell/UpcomingAppointmentSummary.tsx");
const styles = read("src/app/globals.css");
const companion = read("src/components/workflows/AICompanion.tsx");

assert.match(home, /<h1>Home<\/h1>/, "the primary caregiver landing page must be Home");
assert.match(home, /View care information/, "Home must link to the Care information destination");
assert.match(home, /<LCRCurrentUnderstanding showNextStep viewMode="today" \/>/, "Home must render the authoritative care understanding in compact mode");
assert.match(understanding, /viewMode\?: "today" \| "complete"/, "the LCR component must distinguish Today from the complete record");
assert.match(understanding, /viewMode === "complete" && \(/, "detailed history and integrity panels must not render on Home");
const firstCompletePanel = understanding.indexOf('      {viewMode === "complete" && (');
const contextualNextStep = understanding.indexOf('      {showNextStep && !hasConfirmedEmptyRecord && (');
const secondCompletePanel = understanding.lastIndexOf('      {viewMode === "complete" && (');
assert.ok(firstCompletePanel >= 0 && contextualNextStep > firstCompletePanel && secondCompletePanel > contextualNextStep, "Home next steps must remain visible between complete-record-only panels");
assert.match(understanding, /viewMode === "today" \? \([\s\S]*?href="\/workspace\/care-continuity#lcr-clarification-workflow"/, "Home clarification actions must navigate to a visible complete-record destination");
assert.match(styles, /\.lcr-first-screen-summary > \.lcr-first-screen-card:nth-child\(2\) \{\s*order: 1;/, "care attention must appear before ordinary record details");

assert.match(understanding, /Your Care Record starts here/, "a confirmed empty record must explain the purpose of the record");
assert.match(understanding, /href="\/workspace\/daily-care" className="solenos-care-primary-action"/, "empty Home state must offer an initial care update");
assert.match(understanding, /href="\/workspace\/documents" className="solenos-care-secondary-action"/, "empty Home state must offer document upload");
assert.match(understanding, /watchMissingInformation.length > 0/, "relevant missing information must be surfaced");
assert.match(understanding, /Reports that do not match:/, "unresolved disagreements must be named explicitly on Today");
assert.match(understanding, /Sol enOS has not treated one report as the final answer|SolenOS has not treated one report as the final answer/, "Today must not silently select one conflicting report");
assert.match(understanding, /href="\/workspace\/care-continuity#lcr-conflict-review"/, "Today must provide a path to review the conflicting reports");
assert.match(understanding, /id="lcr-conflict-review"/, "the complete record must expose the conflict-review destination");
assert.match(understanding, /id=\{\`lcr-care-item-/, "complete-record care details must expose stable evidence anchors");
assert.match(understanding, /viewMode === "today" \? `\/workspace\/care-continuity#lcr-care-item-/, "Today evidence links must open the matching complete-record item");

assert.match(understanding, /hasConfirmedEmptyRecord/, "an empty record must only be declared when retrieval coverage is complete");
assert.match(understanding, /hasIncompleteProjection/, "incomplete retrieval must not be treated as an empty record");
assert.match(home, /<UpcomingAppointmentSummary \/>/, "Home must retain recorded appointment information");
assert.match(home, /searchParams\.get\("prompt"\)\?\.trim\(\)\.slice\(0, 4000\)/, "Companion deep-link prompts must be bounded");
assert.match(home, /<Companion key=\{prompt\} home initialPrompt=\{prompt\} \/>/, "a Companion prompt must be opened within the shared Home shell");
assert.doesNotMatch(home, /if\s*\(prompt\)\s*\{/, "a prompt query must not replace the Home shell");
assert.doesNotMatch(home, /When you’re ready, here are two ways to continue/, "the fixed two-action panel must not return");

assert.doesNotMatch(home, /FirstVisitWorkspaceRouter/, "Home must not depend on a second first-visit presentation router");
assert.doesNotMatch(home, /CognitiveWorkspace/, "first visits must not be forced through a separate capture-only route");
assert.match(understanding, /No care information recorded yet|first-empty/, "the shared LCR view must retain an explicit empty-record state");

assert.match(understanding, /showNextStep\?: boolean/, "contextual next steps must be opt-in for the Home surface");
assert.match(understanding, /immediateCareDecisions\.length > 0/, "saved immediate follow-ups must influence the next step");
assert.match(understanding, /clarificationCareDecisions\.length > 0 \|\| watchMissingInformation\.length > 0/, "uncertainty and relevant missing information must influence the next step");
assert.match(understanding, /importantCareDecisions\.length > 0 \|\| watchChanges\.length > 0/, "important changes must influence the next step");
assert.match(understanding, /Your Care Record starts here/, "a confirmed empty record must offer initial-record guidance");
assert.match(understanding, /refreshWholeRecord\(\)/, "failed or unavailable understanding must offer recovery rather than a fabricated action");
assert.match(understanding, /response\.person_id !== scopedPersonId/, "the LCR projection must be checked against the active care recipient");

assert.match(appointments, /appointment-workspaces\/preparation-brief\?window_days=90/, "appointments must use the existing persisted appointment contract");
assert.match(appointments, /Appointment information is unavailable/, "appointment retrieval failures must remain visible");
assert.match(appointments, /appointmentTime - Date\.now\(\) <= 24 \* 60 \* 60 \* 1000/, "appointments due within 24 hours must receive contextual prominence");
assert.match(companion, /initialPrompt\?\.trim\(\)\.slice\(0, 4000\)/, "all Companion entry points must bound prompt text");

console.log("PASS: Home, first-visit convergence, Companion prompt context, record-driven next steps and appointment failure states");
