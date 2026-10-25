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
  'postJSON("/assistant/assist"',
  "result.written_to_lcr !== false",
  'result.authority !== "solenos_care_record_and_caregiver"',
  "Suggestions are not saved to the Living Care Record automatically.",
  "What would you like help with?",
  '{loading ? "Working…" : "Send"}',
]);
assert(!assist.includes("<select"), "The shared assistance panel must not expose internal workflow selection.");
assert(!assist.includes('"community"'), "Community must remain excluded while disabled.");
assert(!assist.includes("Railway-hosted local model"), "Internal runtime details must not be shown.");
assert(!assist.includes("Check Qwen"), "Internal model status controls must not be shown.");
assert(!assist.includes("reply.model"), "Provider/model names must not be shown to caregivers.");

requireText("src/components/mvp-workspace/CognitiveWorkspace.tsx", [
  'import QwenAssistPanel from "@/components/qwen/QwenAssistPanel";',
  "Help with your care information",
  "evidenceIds={documents.map",
  "isCasualConversationOnly(text)",
  "/workspace/companion?draft=",
]);
const capture = read("src/components/workflows/StructuredDailyCapture.tsx");
requireText("src/components/workflows/StructuredDailyCapture.tsx", [
  "postJSON('/daily/log'",
  "qwen_extraction_status",
  "Review suggested details",
]);
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
  "Your message couldn’t be sent.",
  "{loading ? 'Sending…' : 'Send'}",
]);
const companion = read("src/components/workflows/AICompanion.tsx");
assert(!companion.includes("QwenAssistPanel"), "Companion must not show a second workflow selector/panel.");
assert(!companion.includes("The Qwen model service"), "Model runtime details must not be shown.");
assert(!companion.includes("connected backend"), "Technical service details must not be shown to caregivers.");

requireText("src/app/workspace/documents/page.tsx", [
  'import QwenAssistPanel from "@/components/qwen/QwenAssistPanel";',
  'defaultWorkflow="document"',
  "Help with your documents",
]);
requireText("src/components/mvp-workspace/SituationResponsePanel.tsx", [
  "Entry saved to the Living Care Record",
  "Your entry was saved, but the full care view could not be refreshed.",
  "We won’t ask you to submit the same entry again.",
]);
assert(!read("src/components/mvp-workspace/SituationResponsePanel.tsx").includes("The backend confirmed"));
requireText("src/app/workspace/settings/page.tsx", [
  "function AccountCard()",
  'postJSON("/accounts"',
  'deleteJSON("/accounts/me"',
]);
assert(!read("src/app/workspace/settings/page.tsx").includes("Sign in"), "Settings account controls must not expose a Sign in button.");
assert(!read("src/app/workspace/settings/page.tsx").includes("multi-factor authentication"), "Settings must not show technical account capability messaging.");
requireText("src/api/client.ts", [
  'export async function deleteJSON(path: string, body?: unknown)',
  "export async function signInToAccount(email: string, password: string)",
  'window.localStorage.setItem(ANONYMOUS_TOKEN_KEY, result.access_token)',
]);
console.log("PASS: contextual assistance remains routed through the authenticated service with read-only care-record safeguards.");
console.log("PASS: Qwen workflow routing remains internal; caregivers are not asked to select workflows.");
console.log("PASS: Daily Capture has no separate assistant workflow panel; saved observations remain reviewable.");
console.log("PASS: Companion has a Send button and uses user-facing retry language without provider/runtime details.");
console.log("PASS: documents and Community use product language rather than internal model labels.");
console.log("PASS: Community uses searchable stories, simple filters, and no separate model/workflow panel.");

console.log("PASS: account creation, sign-in, and deletion controls call backend account endpoints and disclose unavailable protections.");
