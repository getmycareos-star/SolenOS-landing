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
assert.match(clarificationPanel, /\/uncertainty\/questions\/recommended\//, "The caregiver queue must consume the backend evidence-validated recommendation projection.");
assert.match(clarificationPanel, /eligibleQuestionOrder\.get\(a\.id\)/, "The caregiver queue must preserve the backend's priority ordering.");
assert.match(clarificationPanel, /eligible_question_ids: \[\],/, "If the backend recommendation service is unavailable, caregiver questions must fail closed without breaking access to saved care information.");
assert.match(clarificationPanel, /recommendation\.recommended_question_ids/, "The selected question must follow the backend priority order.");
assert.match(clarificationPanel, /eligibleQuestionIdSet\.has\(item\.id\) && isCaregiverNecessaryQuestion\(item\)/, "The selected question detail must enforce the same server eligibility gate as the visible queue.");
assert.match(clarificationPanel, /eligibleQuestionIdSet\.has\(item\.id\)/, "Only question IDs admitted by the backend projection may enter the caregiver queue.");
assert.match(clarificationPanel, /What did the person receiving care say or show\?/, "Questions intended for the person receiving care must preserve their own voice.");
assert.match(clarificationPanel, /What did you observe or report\?/, "Caregiver-report questions must distinguish personal observation from professional confirmation.");
assert.match(clarificationPanel, /leave this open\. Do not guess\./, "Unknown answerers must not be converted into forced caregiver tasks.");
assert.match(clarificationPanel, /What did the care professional confirm\?/, "Professional-directed questions must not be presented as questions the caregiver personally must answer.");
assert.match(clarificationPanel, /Waiting for care-team confirmation/, "Professional-directed questions must not appear to be awaiting the caregiver's own answer.");
assert.match(clarificationPanel, /Best person to ask:/, "The interface must identify the intended answerer for a necessary question.");
assert.match(
  clarificationPanel,
  /visibleCaregiverQuestions\.map\(/,
  "The initial caregiver view must use the attention-limited, necessity-filtered collection.",
);
assert.match(
  clarificationPanel,
  /item\.priority === "critical"/,
  "Critical questions must bypass the ordinary display limit.",
);
assert.match(
  clarificationPanel,
  /additionalCaregiverQuestions\.map\(/,
  "Additional necessary questions must remain available on demand.",
);
assert.match(
  clarificationPanel,
  /slice\(0, 2\)/,
  "The initial view must show no more than two ordinary questions.",
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
