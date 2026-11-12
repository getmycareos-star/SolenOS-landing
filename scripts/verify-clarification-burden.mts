import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const clarificationPanel = readFileSync(
  new URL("../src/components/ClarificationWorkflowPanel.tsx", import.meta.url),
  "utf8",
);
const companion = readFileSync(
  new URL("../src/components/workflows/AICompanion.tsx", import.meta.url),
  "utf8",
);

assert.match(
  clarificationPanel,
  /item\.necessity === "necessary" && Boolean\(item\.necessity_rationale\?\.trim\(\)\)/,
  "Only explicitly necessary questions with a rationale may enter the caregiver queue.",
);
assert.match(
  clarificationPanel,
  /caregiverOpenQuestions\.map\(/,
  "The caregiver-facing open-question list must use the necessity-filtered collection.",
);
assert.match(
  clarificationPanel,
  /SolenOS will ask when a care detail genuinely needs confirmation/,
  "The empty state must explain that SolenOS, not the caregiver, initiates necessary clarification.",
);
assert.doesNotMatch(
  clarificationPanel,
  /Ask another question/,
  "The primary caregiver interface must not create manual clarification tasks.",
);
assert.doesNotMatch(
  companion,
  /companion-add-menu|openDocumentIntake|Snap a photo|Scan document/,
  "AI Companion must remain conversational; document capture belongs in Documents.",
);

console.log("Clarification burden and Companion responsibility boundaries verified.");
