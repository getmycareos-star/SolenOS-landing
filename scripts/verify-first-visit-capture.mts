import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const understanding = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const companion = fs.readFileSync("src/components/workflows/AICompanion.tsx", "utf8");

assert.match(page, /<h1>Today<\/h1>/, "first-time and returning caregivers must enter through Today");
assert.match(page, /<LCRCurrentUnderstanding showNextStep viewMode="today" \/>/, "the shared entry page must use the concise Living Care Record projection");
assert.match(page, /<Link href="\/workspace\/care-continuity">View care information<\/Link>/, "Care information must remain directly discoverable from Today");
assert.doesNotMatch(page, /FirstVisitWorkspaceRouter/, "Today must not branch into a separate first-visit presentation");
assert.doesNotMatch(page, /CognitiveWorkspace/, "new caregivers must not be forced through a capture-only route");
assert.match(understanding, /first-empty/, "an empty record must have a clear empty state");
assert.match(understanding, /Your Care Record starts here/, "the empty state must explain what the Care Record is for");
assert.match(understanding, /href="\/workspace\/daily-care"/, "the empty state must offer a first care update");
assert.match(understanding, /href="\/workspace\/documents"/, "the empty state must offer document upload");
assert.match(understanding, /hasConfirmedEmptyRecord/, "the empty state must not appear when record retrieval is incomplete");
assert.match(understanding, /response\.person_id !== scopedPersonId/, "the visible record must be checked against the active care recipient");
assert.match(understanding, /We couldn’t load your care information/, "failed retrieval must remain distinct from an empty record");
assert.match(companion, /const prompt = initialPrompt\?\.trim\(\)\.slice\(0, 4000\)/, "Companion must bound deep-link prompt text at the component boundary");
assert.match(companion, /params\.delete\('prompt'\)/, "Companion must clear the consumed prompt from the URL");
assert.match(companion, /history\.replaceState\(window\.history\.state, '', nextUrl\)/, "Companion prompt cleanup must preserve browser navigation state");

console.log("PASS: first-time and returning caregivers share Today, with an honest empty state and a bounded Companion entry path.");
