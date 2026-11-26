import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");
const home = read("src/app/workspace/page.tsx");
const understanding = read("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx");
const appointments = read("src/components/app-shell/UpcomingAppointmentSummary.tsx");
const styles = read("src/app/globals.css");
const companion = read("src/components/workflows/AICompanion.tsx");

assert.match(home, /<h1>Home<\/h1>/, "the primary caregiver landing page must be Home");
assert.match(home, /View the complete Care Record/, "Home must link to the complete Care Record");
assert.match(home, /<LCRCurrentUnderstanding showNextStep viewMode="today" \/>/, "Home must render the authoritative care understanding in compact mode");
assert.match(understanding, /viewMode\?: "today" \| "complete"/, "the LCR component must distinguish the compact Home view from the complete record");
const assignableFetch = understanding.indexOf('getJSON("/caregiver-access/assignable-members")');
const registeredActionsFetch = understanding.indexOf('getJSON(`/registered-actions/');
const patternsFetch = understanding.indexOf('getJSON(`/change/patterns/');
const detailFetchGate = understanding.indexOf('viewMode === "complete" ? [', understanding.indexOf("const backgroundTasks = ["));
assert.ok(detailFetchGate >= 0 && assignableFetch > detailFetchGate && registeredActionsFetch > detailFetchGate && patternsFetch > detailFetchGate, "Today must not wait for complete-record-only caregiver, action and pattern queries");
assert.match(understanding, /\}, \[viewMode\]\);/, "the data-loading effect must rerun when the view mode changes");
assert.match(understanding, /if \(isCurrentRequest\(\)\) setChangesLoading\(false\)/, "the recent-change loading state must settle for the active request");
assert.match(understanding, /if \(isCurrentRequest\(\)\) setAssessmentLoading\(false\)/, "the assessment loading state must settle for the active request");

assert.match(understanding, /viewMode === "complete" && \(/, "detailed history and integrity panels must not render on Home");
const firstCompletePanel = understanding.indexOf('      {viewMode === "complete" && (');
const contextualNextStep = understanding.indexOf('      {showNextStep && !hasConfirmedEmptyRecord && (');
const secondCompletePanel = understanding.lastIndexOf('      {viewMode === "complete" && (');
assert.ok(firstCompletePanel >= 0 && contextualNextStep > firstCompletePanel && secondCompletePanel > contextualNextStep, "Home next steps must remain visible between complete-record-only panels");
assert.match(understanding, /viewMode === "today" \? \([\s\S]*?href="\/workspace\/care-continuity#lcr-clarification-workflow"/, "Home clarification actions must navigate to a visible complete-record destination");
assert.match(styles, /\.lcr-first-screen-summary > \.lcr-first-screen-card:nth-child\(2\) \{\s*order: 1;/, "care attention must appear before ordinary record details");

assert.match(understanding, /Your Care Record starts here/, "a confirmed empty record must explain the purpose of the record");
assert.match(understanding, /No care information to review yet/, "an empty record must not be presented as evidence that nothing needs attention");
assert.match(understanding, /href="\/workspace\/daily-care" className="solenos-care-primary-action"/, "empty Home state must offer an initial care update");
assert.match(understanding, /href="\/workspace\/documents" className="solenos-care-secondary-action"/, "empty Home state must offer document upload");
assert.match(understanding, /watchMissingInformation.length > 0/, "relevant missing information must be surfaced");
assert.match(understanding, /gap_reason\?: string \| null/, "the care summary must retain structured information-gap reasons");
assert.match(understanding, /case "not_provided": return "Not provided"/, "not-provided information must remain distinct from unrecorded information");
assert.match(understanding, /case "not_documented": return "Not recorded"/, "not-recorded information must have its own caregiver label");
assert.match(understanding, /case "outdated": return "May be out of date"/, "outdated information must not be collapsed into a generic missing state");
assert.match(understanding, /case "conflicting": return "Reports do not match"/, "conflicting information must retain its conflict classification");
assert.match(understanding, /case "inaccessible": return "Source unavailable"/, "inaccessible sources must not be represented as absent information");
assert.match(understanding, /case "unverified": return "Not verified"/, "unverified information must remain distinct from information that was not provided");
assert.match(understanding, /Information still to check:/, "the caregiver-facing missing-information summary must explain the kind of gap");
assert.match(understanding, /watchMissingInformation\.slice\(0, 2\)/, "Home must show more than one distinct information gap when several remain open");
assert.match(understanding, /uncertainties_and_conflicts: Array/, "unresolved uncertainty records must be included in the care assessment");
assert.match(understanding, /gap_reason\?: string \| null/, "unresolved uncertainty records must retain their persisted gap reason");
assert.match(understanding, /missingInformationReasonLabel\(otherUncertainties\[0\]\.gap_reason, otherUncertainties\[0\]\.epistemic_status\)/, "unresolved uncertainty must be described using its recorded epistemic state");
assert.match(understanding, /Reports that do not match:/, "unresolved disagreements must be named explicitly on Home");

assert.match(understanding, /const watchUncertainties = \(assessment\?\.uncertainties_and_conflicts \?\? \[\]\)\.filter\(isUnresolvedCareInformation\)/, "resolved disagreements must not remain in the current uncertainty summary");
assert.match(understanding, /const watchMissingInformation = \(assessment\?\.missing_information \?\? \[\]\)\.filter\(isUnresolvedCareInformation\)/, "resolved or otherwise closed details must not remain in the missing-information summary");assert.match(understanding, /Sol enOS has not treated one report as the final answer|SolenOS has not treated one report as the final answer/, "Home must not silently select one conflicting report");
assert.match(understanding, /href="\/workspace\/care-continuity#lcr-conflict-review"/, "Home must provide a path to review the conflicting reports");
assert.match(understanding, /id="lcr-conflict-review"/, "the complete record must expose the conflict-review destination");
assert.match(understanding, /id=\{`lcr-care-item-/, "complete-record care details must expose stable evidence anchors");
assert.match(understanding, /viewMode === "today" \? `\/workspace\/care-continuity#lcr-care-item-/, "Home evidence links must open the matching complete-record item");
assert.match(understanding, /aria-label=\{\`View \$\{displayCurrentCareTitle\(item\)\} in the complete Care Record\`\}/, "repeated evidence links must remain distinguishable to screen-reader users");

assert.match(understanding, /hasConfirmedEmptyRecord/, "an empty record must only be declared when retrieval coverage is complete");
assert.match(understanding, /hasCompleteSourceCoverage/, "an empty record must require successful or empty results from every requested source");
assert.match(understanding, /hasIncompleteProjection/, "incomplete retrieval must not be treated as an empty record");
assert.match(understanding, /sourceFreshness\?\.reassessment_recommended/, "stale understanding warnings must remain visible on Home");
assert.match(understanding, /assessment\.coverage\.is_complete/, "Home must disclose incomplete assessment coverage");
assert.match(understanding, /setChangesLoading\(true\)/, "Today must track the recent-change query while it is running");
assert.match(understanding, /setAssessmentLoading\(true\)/, "Today must track the care-priority query while it is running");
assert.match(understanding, /changesLoading \? \(/, "an in-flight change query must not be shown as no recent changes");
assert.match(understanding, /assessmentLoading \? \(/, "an in-flight assessment must not be shown as no care priorities");
assert.match(understanding, /saved\.status === "not_assessed" && !saved\.assessment/, "a genuinely unassessed record must remain distinct from a failed retrieval");
assert.match(understanding, /Care priorities have not been reviewed yet\. Review the saved information/, "an unassessed record must offer a truthful explanation rather than a false empty state");
assert.match(understanding, /<Link href="\/workspace\/care-continuity" className="solenos-care-primary-action">Review care information<\/Link>/, "an unassessed record must provide a useful review destination");


assert.match(understanding, /Happened: \$\{formatWhen\(item\.occurred_at\)\}/, "Home must distinguish when care happened from when it was saved");
assert.match(understanding, /item\.time_provenance === "entry_time_defaulted" \|\| !item\.occurred_at \? "Event time not provided/, "missing event time must be explicit even when no provenance marker was supplied");
assert.match(understanding, /Change review saved \{formatWhen\(change\.created_at\)\}/, "change detection time must not be confused with the event comparison window");

assert.match(home, /<UpcomingAppointmentSummary \/>/, "Home must retain recorded appointment information");
assert.match(home, /searchParams\.getAll\("prompt"\)/, "Companion deep links must inspect repeated prompt parameters");
assert.match(home, /promptValues\.length === 1/, "ambiguous repeated prompt parameters must not select one value silently");
assert.match(home, /params\.delete\("prompt"\)/, "malformed or repeated Companion prompt parameters must be removed from the URL");
assert.match(home, /history\.replaceState\(window\.history\.state/, "cleaning a malformed prompt must preserve the framework navigation state");
assert.match(home, /const prompt = rawPrompt\?\.trim\(\)\.slice\(0, 4000\)/, "a single Companion prompt must remain bounded before entering the input");
assert.match(home, /<Companion key=\{prompt\} home initialPrompt=\{prompt\} \/>/, "a Companion prompt must be opened within the shared Home shell");
assert.ok(home.indexOf('<LCRCurrentUnderstanding showNextStep viewMode="today" />') < home.indexOf('<section className="today-companion-entry"'), "a Companion deep link must not push the current care picture below the question workspace");
assert.ok(home.indexOf("<UpcomingAppointmentSummary />") < home.indexOf('<section className="today-companion-entry"'), "an optional Companion prompt must not displace upcoming appointments");
assert.doesNotMatch(home, /if\s*\(prompt\)\s*\{/, "a prompt query must not replace the Home shell");
assert.doesNotMatch(home, /When you’re ready, here are two ways to continue/, "the fixed two-action panel must not return");

assert.doesNotMatch(home, /FirstVisitWorkspaceRouter/, "Home must not depend on a second first-visit presentation router");
assert.doesNotMatch(home, /CognitiveWorkspace/, "first visits must not be forced through a separate capture-only route");
assert.match(understanding, /No care information recorded yet|first-empty/, "the shared LCR view must retain an explicit empty-record state");

assert.match(understanding, /showNextStep\?: boolean/, "contextual next steps must be opt-in for the Home surface");
assert.match(understanding, /immediateCareDecisions\.length > 0/, "saved immediate follow-ups must influence the next step");
assert.match(understanding, /clarificationCareDecisions\.length > 0 \|\| watchMissingInformation\.length > 0/, "uncertainty and relevant missing information must influence the next step");
assert.match(understanding, /importantCareDecisions\.length > 0 \|\| watchChanges\.length > 0/, "important changes must influence the next step");
assert.match(understanding, /importantCareDecisions\.slice\(0, 2\)/, "Home must show the actual important care changes, not only a count");
assert.match(understanding, /Nothing in the information reviewed is marked for immediate attention/, "important review items must not be mislabeled as urgent");

assert.match(understanding, /Your Care Record starts here/, "a confirmed empty record must offer initial-record guidance");
assert.match(understanding, /refreshWholeRecord\(\)/, "failed or unavailable understanding must offer recovery rather than a fabricated action");
assert.match(understanding, /response\.person_id !== scopedPersonId/, "the LCR projection must be checked against the active care recipient");

assert.match(appointments, /appointment-workspaces\/preparation-brief\?window_days=90/, "appointments must use the existing persisted appointment contract");
assert.match(appointments, /Appointment information is unavailable/, "appointment retrieval failures must remain visible");
assert.match(appointments, /appointmentTime - Date\.now\(\) <= 24 \* 60 \* 60 \* 1000/, "appointments due within 24 hours must receive contextual prominence");
assert.match(companion, /initialPrompt\?\.trim\(\)\.slice\(0, 4000\)/, "all Companion entry points must bound prompt text");
assert.match(companion, /history\.replaceState\(window\.history\.state, '', nextUrl\)/, "consuming a Companion prompt must preserve Next.js navigation state");

console.log("PASS: Home, first-visit convergence, Companion prompt context, record-driven next steps and appointment failure states");
