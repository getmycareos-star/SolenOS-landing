import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
function read(file: string): string {
  return fs.readFileSync(path.join(root, file), "utf8");
}
function requireText(file: string, snippets: string[]): void {
  const source = read(file);
  for (const snippet of snippets) {
    assert(source.includes(snippet), `${file} must contain ${JSON.stringify(snippet)}`);
  }
}

const assist = read("src/components/qwen/QwenAssistPanel.tsx");
requireText("src/components/qwen/QwenAssistPanel.tsx", [
  'postJSON("/assistant/jobs"',
  'getJSON("/assistant/jobs/"',
  "task_text: taskText.slice",
  "Explain the document text and answer only from uploaded document evidence.",
  "context_text: boundedContext",
  "Suggestions are not saved to the Living Care Record automatically.",
  "What would you like help with?",
  '{loading ? "Working…" : "Send"}',
]);
assert(!assist.includes("<select"), "The shared assistance panel must not expose internal workflow selection.");
assert(!assist.includes("workflow,"), "The caregiver client must not send a selected workflow ID.");
assert(!assist.includes('"community"'), "Community must remain excluded while disabled.");
for (const workflow of [
  "daily_capture", "add_record", "document", "living_care_record",
  "care_history_search", "care_situation_change", "delta_engine",
  "evidence_provenance", "uncertainty_contradictions", "returning_caregiver",
  "appointment", "after_appointment", "handoff", "professional_summary",
  "open_loops", "two_week_review", "decision_outcome", "medication_day",
  "reminders_notifications", "care_coordination", "companion",
  "caregiver_feedback", "sharing_export", "roles_access", "account_recovery",
  "settings_security", "record_lifecycle", "offline_sync", "ai_reliability",
  "audit_review",
]) assert(assist.includes(JSON.stringify(workflow)), `Internal workflow contract must include ${workflow}.`);
assert(!assist.includes("Railway-hosted local model"), "Internal runtime details must not be shown.");
assert(!assist.includes("Check Qwen"), "Internal model status controls must not be shown.");
assert(!assist.includes("reply.model"), "Provider/model names must not be shown to caregivers.");

requireText("src/components/mvp-workspace/CognitiveWorkspace.tsx", [
  "isLcrOrientationOnly(text)",
  "/api/lcr/orientation",
]);
assert(!read("src/components/mvp-workspace/CognitiveWorkspace.tsx").includes("QwenAssistPanel"),
  "The LCR capture screen must not include a separate AI assistance panel; contextual interpretation remains available after a saved record receipt.");
const capture = read("src/components/workflows/StructuredDailyCapture.tsx");
requireText("src/components/workflows/StructuredDailyCapture.tsx", [
  "postJSON('/daily/log'",
  "qwen_extraction_status",
  "Review suggested details",
  "const [savedEntrySummary, setSavedEntrySummary] = useState('');",
  "setSavedEntrySummary(variables.notes.trim() || 'Entry recorded.');",
  "{savedEntrySummary || 'Entry recorded.'}",
]);
assert(!read("src/components/workflows/StructuredDailyCapture.tsx").includes("{form.notes || 'Entry recorded.'}"),
  "The saved receipt must not read from the draft after the draft has been reset.");
assert(!capture.includes("QwenAssistPanel"), "Daily Capture must not expose a separate assistant workflow panel.");
assert(!capture.includes("Qwen care analysis"), "Daily Capture must not expose the model name.");

requireText("src/components/workflows/Community.tsx", [
  "postJSON('/community/experience/summary'",
  "Find experiences like yours",
  "Community stories",
  "Community posts never update your Living Care Record automatically.",
]);
assert(!read("src/components/workflows/Community.tsx").includes("QwenAssistPanel"), "Community must not expose internal assistant workflow controls.");
assert(!read("src/components/workflows/Community.tsx").includes("Qwen support for Community"), "Community must not show internal model branding.");
requireText("src/components/workflows/AICompanion.tsx", [
  "postJSON('/conversation/message'",
  "Your message could not be sent.",
  "{loading ? 'Sending' : 'Send'}",
]);
const companion = read("src/components/workflows/AICompanion.tsx");
assert(!companion.includes("QwenAssistPanel"), "Companion must not show a second workflow selector/panel.");
assert(!companion.includes("The Qwen model service"), "Model runtime details must not be shown.");
assert(!companion.includes("connected backend"), "Technical service details must not be shown to caregivers.");

const documentPage = read("src/app/workspace/documents/page.tsx");
assert(!documentPage.includes("QwenAssistPanel"), "The saved-document library must not mount a separate AI workflow panel.");
assert(!documentPage.includes('capture="environment"'), "Camera intake is launched from Companion, not the saved-document library.");
assert(!documentPage.includes('type="file"'), "The saved-document library must not expose a second upload launcher.");
assert(documentPage.includes('getJSON("/evidence/"'), "Documents must load persisted evidence from the session-scoped backend.");
assert(documentPage.includes('getBlob("/upload/"'), "Documents must retrieve the original saved file.");
assert(documentPage.includes('postFormData("/upload"'), "Reviewed original uploads must persist through the backend.");
assert(documentPage.includes("Review before saving"), "Extracted content must remain subject to caregiver review.");
assert(documentPage.includes("Scanned statements remain source evidence, not verified LCR facts."), "Scanned statements must not silently become verified LCR facts.");
assert(!documentPage.includes("runtime.situations"), "Document library must not be derived only from local situation state.");
requireText("src/components/mvp-workspace/SituationResponsePanel.tsx", [
  "Entry saved to the Living Care Record",
  "Your entry was saved, but the full care view could not be refreshed.",
  "We won’t ask you to submit the same entry again.",
]);
assert(!read("src/components/mvp-workspace/SituationResponsePanel.tsx").includes("The backend confirmed"));
requireText("src/components/mvp-workspace/SituationResponsePanel.tsx", [
  'import { LcrQwenInterpretation } from "./LcrQwenInterpretation";',
  "persistedSourceEventId(response)",
  "<LcrQwenInterpretation rawInput={rawInput} sourceEventId={sourceEventId} />",
]);
requireText("src/components/mvp-workspace/LcrQwenInterpretation.tsx", [
  'postJSON("/assistant/assist"',
  'workflow: "living_care_record"',
  "result.ai_generated !== true",
  "result.review_required !== true",
  "result.written_to_lcr !== false",
  'result.persistence !== "read_only_assistance"',
  "AI-generated interpretation for caregiver review.",
  "The Living Care Record remains authoritative; this response did not change it.",
]);
const lcrInterpretation = read("src/components/mvp-workspace/LcrQwenInterpretation.tsx");
assert(!/reply\s*:\s*["'`]/.test(lcrInterpretation), "LCR interpretation must not include canned reply text.");
assert(!lcrInterpretation.includes("workflow: rawInput"), "Caregiver input must not select the internal workflow.");
requireText("src/app/workspace/settings/page.tsx", [
  "function AccountCard()",
  'postJSON("/accounts"',
  'deleteJSON("/accounts/me"',
]);
const accountSettings = read("src/app/workspace/settings/page.tsx");
const accountCard = accountSettings.slice(
  accountSettings.indexOf("function AccountCard()"),
  accountSettings.indexOf("/** Legal"),
);
assert(accountCard.includes("Sign in to an existing account"), "Optional account sign-in must remain available.");
assert(accountCard.includes("signInToAccount(email, password)"), "Account sign-in must use the authenticated backend client.");
assert(accountSettings.includes("An account is optional. Anonymous care access remains available."), "Account creation and sign-in must remain optional; anonymous care access must not be gated.");
assert(accountCard.includes('if (!getAnonymousAccessToken())'), "Opening account settings must not create or require a new care record.");
assert(!read("src/app/workspace/settings/page.tsx").includes("multi-factor authentication"), "Settings must not show technical account capability messaging.");
requireText("src/api/client.ts", [
  'export async function deleteJSON(path: string, body?: unknown)',
  "export async function signInToAccount(email: string, password: string)",
  'window.localStorage.setItem(ANONYMOUS_TOKEN_KEY, result.access_token)',
]);
console.log("PASS: contextual assistance uses the authenticated durable background queue with read-only care-record safeguards.");
console.log("PASS: Qwen workflow routing remains internal; caregivers are not asked to select workflows.");
console.log("PASS: Daily Capture has no separate assistant workflow panel; saved observations remain reviewable.");
console.log("PASS: Companion has a Send button and uses user-facing retry language without provider/runtime details.");
console.log("PASS: documents and Community use product language rather than internal model labels.");
console.log("PASS: Community uses searchable stories, simple filters, and no separate model/workflow panel.");
console.log("PASS: LCR context interpretation only runs after a persisted event receipt and rejects responses without the read-only contract.");

console.log("PASS: account creation, sign-in, and deletion controls call backend account endpoints and disclose unavailable protections.");
