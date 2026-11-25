import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const understanding = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const companion = fs.readFileSync("src/components/workflows/AICompanion.tsx", "utf8");

assert.match(page, /<h1>Today<\/h1>/, "first-time and returning caregivers must enter through Today");
assert.match(page, /<LCRCurrentUnderstanding showNextStep \/>/, "the shared entry page must use the Living Care Record projection");
assert.match(page, /View the complete Care Record/, "the complete record must remain directly discoverable");
assert.doesNotMatch(page, /FirstVisitWorkspaceRouter/, "Today must not branch into a separate first-visit presentation");
assert.doesNotMatch(page, /CognitiveWorkspace/, "new caregivers must not be forced through a capture-only route");
assert.match(understanding, /first-empty/, "an empty record must have a clear empty state");
assert.match(understanding, /Your Care Record does not have any care information yet\./, "the empty state must explain how to begin");
assert.match(understanding, /Add what you know in Daily Care or upload a care document\./, "the empty state must provide useful starting actions");
assert.match(understanding, /response\.person_id !== scopedPersonId/, "the visible record must be checked against the active care recipient");
assert.match(understanding, /We couldn’t load your care information/, "failed retrieval must remain distinct from an empty record");
assert.match(companion, /const prompt = initialPrompt\?\.trim\(\)/, "Companion must treat a deep-link prompt as user-provided text");
assert.match(companion, /params\.delete\('prompt'\)/, "Companion must clear the consumed prompt from the URL");

console.log("PASS: first-time and returning caregivers share Today, with an honest empty state and a bounded Companion entry path.");
