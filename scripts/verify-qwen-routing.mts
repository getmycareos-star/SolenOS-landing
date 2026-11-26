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
const appointmentWorkspace = read("src/components/workflows/AppointmentWorkspace.tsx");
const workspaceNavigation = read("src/lib/workspace-navigation.ts");
assert(!appointmentWorkspace.includes("QwenAssistPanel"),
  "Appointment continuity must remain a persisted care workflow, not a separate embedded AI assistant panel.");
requireText("src/components/workflows/AppointmentWorkspace.tsx", [
  "getJSON('/appointment-workspaces/preparation-brief?window_days=90')",
  "getJSON('/appointment-workspaces')",
  "getJSON('/appointment-workspaces/' + encodeURIComponent(recordId) + '/outcome-draft')",
  "postJSON('/appointment-workspaces/' + encodeURIComponent(record.id) + '/outcome-proposals', {})",
  "patchJSON('/appointment-workspaces/' + encodeURIComponent(record.id)",
  "postJSON('/appointment-workspaces'",
  "patchJSON('/appointments/' + encodeURIComponent(appointmentId) + '/lifecycle'",
  "Your note is saved as a caregiver report.",
  "nothing here changes your Care Record without your approval.",
  "We couldn’t load all of your Care Record.",
  "Try again",
]);
requireText("src/components/qwen/QwenAssistPanel.tsx", [
  'postJSON("/assistant/jobs"',
  'getJSON("/assistant/jobs/"',
  "task_text: taskText.slice",
  "...(appointmentId ? { appointment_id: appointmentId } : {})",
  "Explain the document text and answer only from uploaded document evidence.",
  "context_text: boundedContext",
  "source_document_analysis_ids: string[]",
  "source_appointment_ids: string[]",
  "source_handoff_ids: string[]",
  "source_notification_ids: string[]",
  "source_freshness_assessment_ids: string[]",
  "claim_provenance?: QwenClaimProvenance | null",
  "What each statement is based on",
  "matched_validated_aggregate",
  "aggregate_count_mismatch",
  "aggregate_not_validated",
  "When it happened:",
  "When it was recorded:",
  'postJSON("/assistant/jobs/" + encodeURIComponent(reply.job_id) + "/proposal", {})',
  'postJSON("/companion/care-updates/qwen/" + encodeURIComponent(proposal.id) + "/review", { decision: "accept" })',
  'postJSON("/companion/care-updates/qwen/" + encodeURIComponent(proposal.id) + "/review", { decision: "reject" })',
  "Review this suggestion",
  "Approve and add to your Care Record",
  "Decline",
  "Nothing was added to your Care Record.",

  "Suggestions are not added to your Care Record unless you choose to save and approve them.",
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
  "audit_review", "care_transition", "incident_follow_through", "emergency_readiness",
  "care_coverage_gap", "care_instruction_change_tracker", "critical_information_completeness",
  "personal_preferences_distress_context", "caregiver_strain_support", "document_validity_renewal",
]) assert(assist.includes(JSON.stringify(workflow)), `Internal workflow contract must include ${workflow}.`);
assert(!assist.includes("Railway-hosted local model"), "Internal runtime details must not be shown.");
assert(!assist.includes("Check Qwen"), "Internal model status controls must not be shown.");
assert(!assist.includes("reply.model"), "Provider/model names must not be shown to caregivers.");

requireText("src/app/workspace/page.tsx", [
  'import Link from "next/link";',
  'href="/workspace/care-continuity"',
  "View care information",
  "See what is happening today, what has changed and what may need your attention. Your saved care information stays connected as things change.",
]);
assert(workspaceNavigation.includes('id: "ask-solenos"') && workspaceNavigation.includes('href: "/workspace/companion"') && workspaceNavigation.includes('label: "Ask SolenOS"'),
  "The existing Companion is directly reachable as Ask SolenOS from primary navigation.");
assert(!read("src/app/workspace/page.tsx").includes("QwenAssistPanel"),
  "The caregiver home must route questions through the conversational Companion, not a separate care-management assistant panel.");
requireText("src/components/mvp-workspace/CognitiveWorkspace.tsx", [
  "isLcrOrientationOnly(text)",
  "/api/lcr/orientation",
]);
assert(!read("src/components/mvp-workspace/CognitiveWorkspace.tsx").includes("QwenAssistPanel"),
  "The LCR capture screen must not include a separate AI assistance panel; contextual interpretation remains available after a saved record receipt.");
const capture = read("src/components/workflows/StructuredDailyCapture.tsx");
requireText("src/components/workflows/StructuredDailyCapture.tsx", [
  'endpoint: "/daily/log"',
  "await enqueueDurableWrite({",
  "await deliverDurableWrite<",
  'sendQueuedCareWrite("/daily/log", payload)',
  "if (await hasDurableWrite(queueId))",
  "capture_idempotency_key: captureIdempotencyKey",
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
requireText("src/components/workflows/StructuredDailyCapture.tsx", [
  "const QWEN_JOB_POLL_INTERVAL_MS = 2_000;",
  "const QWEN_JOB_MAX_WAIT_MS = 12 * 60 * 1000;",
  "const QWEN_JOB_MAX_POLLS = Math.ceil(QWEN_JOB_MAX_WAIT_MS / QWEN_JOB_POLL_INTERVAL_MS);",
  "attempts >= QWEN_JOB_MAX_POLLS",
  "setTimeout(() => { void poll(); }, QWEN_JOB_POLL_INTERVAL_MS)",
]);
requireText("src/components/workflows/NaturalLanguageDailyUpdate.tsx", [
  "const QWEN_JOB_POLL_INTERVAL_MS = 5_000;",
  "const QWEN_JOB_MAX_WAIT_MS = 12 * 60 * 1000;",
  "const QWEN_JOB_MAX_POLLS = Math.ceil(QWEN_JOB_MAX_WAIT_MS / QWEN_JOB_POLL_INTERVAL_MS);",
  "attempts < QWEN_JOB_MAX_POLLS",
  "setTimeout(poll, QWEN_JOB_POLL_INTERVAL_MS)",
  "processingStatus: \"unavailable\"",
  "extractionStatus: \"unavailable\"",

]);

requireText("src/components/workflows/Community.tsx", [
  "postJSON('/community/experience/summary'",
  "Find experiences like yours",
  "Community stories",
  "Posts shared here are never added to your care information automatically.",
]);
assert(!read("src/components/workflows/Community.tsx").includes("QwenAssistPanel"), "Community must not expose internal assistant workflow controls.");
assert(!read("src/components/workflows/Community.tsx").includes("Qwen support for Community"), "Community must not show internal model branding.");
requireText(".github/workflows/frontend-validation.yml", [
  'OLLAMA_TIMEOUT_SECONDS: "5"',
]);

requireText("src/api/client.ts", [
  'pathname.endsWith("/assistant/assist") && method === "POST") return 210_000',
  'pathname.endsWith("/handoff-drafts/prepare") && method === "POST") return 210_000',
  "export class ApiResponseError extends Error",
  "throw new ApiResponseError(res.status, message, detail)",
  "typeof detailMessage === 'string'",
]);
requireText("src/components/workflows/AICompanion.tsx", [
  "matched_validated_aggregate",
  "aggregate_count_mismatch",
  "aggregate_not_validated",
  "postJSON('/conversation/message'",
  "SolenOS could not respond.",
  "{loading ? 'Sending' : 'Send'}",
]);
const companion = read("src/components/workflows/AICompanion.tsx");
assert(!companion.includes("QwenAssistPanel"), "Companion must not render a second AI assistance input above its primary conversation composer.");
assert.equal((companion.match(/aria-label="Send a message to SolenOS"/g) ?? []).length, 1, "Companion must render exactly one message form.");
assert.equal((companion.match(/id="companion-message-input"/g) ?? []).length, 1, "Companion must render exactly one message textarea.");
requireText("src/components/workflows/AICompanion.tsx", [
  'postJSON(\'/conversation/message\'',
  'placeholder="Ask about saved care information, a recent change, or something that is unclear…"',
  "aria-label=\"Send a message to SolenOS\"",
  "status.runtime_available === true && status.model_installed === true",
  "setAvailability('unverified')",
  "response.ai_generated === true ? 'available' : 'unverified'",
  "error instanceof ApiResponseError && [502, 503, 504].includes(error.status)",
  "setAvailability(inferenceUnavailable ? 'unavailable' : 'unknown')",
  "your Care Record has not changed",
  "availability === 'available' || availability === 'unverified'",
  "availability !== \"available\" && availability !== \"unverified\"",
]);
assert(!companion.includes("The Qwen model service"), "Model runtime details must not be shown.");
assert(!companion.includes("connected backend"), "Technical service details must not be shown to caregivers.");
assert(companion.includes("Conversations are saved here.") && companion.includes("Nothing is added to your Care Record unless you choose to save a message as a care note and approve it."), "Companion must distinguish persisted conversation history from the Care Record and require explicit approval for care-record writes.");
assert(companion.includes('href="/workspace/daily-care"') && companion.includes('href="/workspace/documents"'), "caregivers must be directed to the supported Daily Care and Documents capture workflows.");

assert(!companion.includes("care_update_candidates"), "Companion must not treat model output as a care fact.");
assert(companion.includes("pendingCareUpdates"), "Companion must load only caregiver-created review proposals.");
assert(companion.includes("/companion/care-updates"), "Companion must use the caregiver-scoped review endpoints.");
assert(companion.includes("reviewCareUpdate"), "Companion care reports must require an explicit caregiver decision.");
assert(companion.includes("Nothing is added to your Care Record unless you choose to save a message as a care note and approve it."), "Companion must disclose the explicit approval boundary.");
assert(!companion.includes("AppointmentWorkspace") && !companion.includes("CareHandoffSharing"), "Appointment and handoff workflows must remain outside the conversational interface.");

const documentPage = read("src/app/workspace/documents/page.tsx");
assert(!documentPage.includes("QwenAssistPanel"), "The saved-document library must not mount a separate AI workflow panel.");
assert(documentPage.includes('capture="environment"'), "Snap a photo must launch the device camera from Documents.");
assert(documentPage.includes('type="file"'), "Documents must provide direct file selection.");
requireText("src/app/workspace/documents/page.tsx", [
  "Upload files",
  "Snap a photo",
  "Scan pages",
  "navigator.mediaDevices.getUserMedia",
  'capture_method: intakeMode === "scan" ? "scan" : intakeMode === "capture" ? "snap" : "upload",',
  "for (const [key, value] of Object.entries(fields)) form.append(key, value)",
]);
assert(documentPage.includes('getJSON("/evidence/"'), "Documents must load persisted evidence from the session-scoped backend.");
assert(documentPage.includes('getBlob("/upload/"'), "Documents must retrieve the original saved file.");
assert(documentPage.includes('postFormData("/upload"'), "Reviewed original uploads must persist through the backend.");
assert(documentPage.includes("Your original file is ready. SolenOS will read it and prepare details for you to check after upload."), "Original-first upload must preserve the source before extraction.");
assert(!documentPage.includes("/api/extract") && !documentPage.includes("extractText("), "Document intake must not duplicate server extraction in the browser.");
assert(!documentPage.includes('form.append("extracted_text"'), "Browser-extracted text must not be sent as source evidence.");
assert(!documentPage.includes("Extracted text — review and correct before saving"), "Caregivers must not be forced to review extracted text before saving the original.");
assert(documentPage.includes("Suggested details will not be added to your Care Record until you check and approve them."), "Extracted statements must remain evidence-gated before entering the Care Record.");
assert(documentPage.includes(".eml") && documentPage.includes(".msg"), "Supported email files must be selectable in Documents.");
assert(!documentPage.includes("runtime.situations"), "Document library must not be derived only from local situation state.");
requireText("src/components/mvp-workspace/SituationResponsePanel.tsx", [
  "Your update was saved to your Care Record",
  "Your update was saved, but SolenOS could not refresh your Care Record.",
  "We won’t ask you to submit the same information again.",
]);
assert(!read("src/components/mvp-workspace/SituationResponsePanel.tsx").includes("The backend confirmed"));
requireText("src/components/mvp-workspace/SituationResponsePanel.tsx", [
  'import { LcrQwenInterpretation } from "./LcrQwenInterpretation";',
  "persistedSourceEventId(response)",
  "<LcrQwenInterpretation rawInput={rawInput} sourceEventId={sourceEventId} />",
]);
requireText("src/components/mvp-workspace/LcrQwenInterpretation.tsx", [
  "claim_provenance",
  "matched_validated_aggregate",
  "aggregate_count_mismatch",
  "aggregate_not_validated",
  'postJSON("/assistant/assist"',
  'workflow: "living_care_record"',
  "result.ai_generated !== true",
  "result.review_required !== true",
  "result.written_to_lcr !== false",
  'result.persistence !== "read_only_assistance"',
  "Suggested explanation for you to review.",
  "Your Care Record has not changed. This suggestion has not been added to it.",
]);
const lcrInterpretation = read("src/components/mvp-workspace/LcrQwenInterpretation.tsx");
assert(!/reply\s*:\s*["'`]/.test(lcrInterpretation), "LCR interpretation must not include canned reply text.");
assert(!lcrInterpretation.includes("workflow: rawInput"), "Caregiver input must not select the internal workflow.");
requireText("src/app/workspace/settings/page.tsx", [
  "function AccountCard({ onSignedOut }",
  "createAccount(email, password)",
  'deleteJSON("/accounts/me"',
]);
requireText("src/api/client.ts", [
  "export async function createAccount(email: string, password: string)",
  'return await postJSON("/accounts", { email, password })',
]);
const accountSettings = read("src/app/workspace/settings/page.tsx");
const accountCard = accountSettings.slice(
  accountSettings.indexOf("function AccountCard({ onSignedOut }"),
  accountSettings.indexOf("/** Legal"),
);
assert(accountCard.includes("Sign in to an existing account"), "Optional account sign-in must remain available.");
assert(accountCard.includes("signInToAccount(email, password)"), "Account sign-in must use the authenticated backend client.");
assert(accountCard.includes("await revokeAnonymousSession()"), "Caregiver sign-out must revoke the active server session before clearing browser credentials.");
assert(accountCard.includes('setSignedOut(true)'), "After sign-out, account settings must require sign-in to restore the previous care record.");
assert(accountCard.includes('!signedOut && <Button'), "A signed-out caregiver must not be offered account creation as a substitute for restoring the existing record.");
assert(accountCard.includes('Sign out'), "Account settings must expose a caregiver-facing sign-out control.");
assert(accountCard.includes("We couldn’t confirm whether account creation completed."), "Ambiguous registration failures must direct caregivers to sign in rather than blindly retrying signup.");
const identityDeviceRecovery = read("src/components/mvp-workspace/IdentityDeviceRecoveryPanel.tsx");
assert(identityDeviceRecovery.includes("You can use your Care Record without creating an account."), "Caregivers must be able to use their Care Record without creating an account.");
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
const companionFallback = read("src/components/workflows/AICompanion.tsx");
assert(companionFallback.includes("msg.ai_generated === false"), "Non-model safety and source-quoted replies must be visibly distinguished from Qwen-generated answers.");
assert(companionFallback.includes("This is a brief support message, not an answer based on your Care Record."), "Companion must clearly distinguish non-Qwen support replies from Care Record answers.");
console.log("PASS: Companion has a Send button and uses user-facing retry language without provider/runtime details.");
console.log("PASS: documents and Community use product language rather than internal model labels.");
console.log("PASS: Community uses searchable stories, simple filters, and no separate model/workflow panel.");
console.log("PASS: LCR context interpretation only runs after a persisted event receipt and rejects responses without the read-only contract.");

const documentReview = read("src/components/DocumentIntelligenceReview.tsx");
assert(documentReview.includes("candidate.candidate_index"), "Document review must preserve stable candidate indices across batches.");
assert(documentReview.includes("has_more_candidates"), "Document review must expose remaining statements instead of silently dropping overflow.");
assert(documentReview.includes("Show the next "), "Document review must allow the next bounded group after the current group is decided.");
assert(documentReview.includes("retryable_page_numbers"), "Only transient page failures may offer automatic retry.");
assert(documentReview.includes("extraction_unprocessed_page_numbers"), "OCR extraction state must remain separate from Qwen page-window progress.");
assert(documentReview.includes("blocked_page_numbers"), "Pages blocked by resource limits must not be offered for automatic retry.");
console.log("PASS: document candidate batches and retryable page states are preserved.");

console.log("PASS: account creation, sign-in, and deletion controls call backend account endpoints and disclose unavailable protections.");


assert.doesNotMatch(lcrInterpretation, /setTimeout\(\(\) => controller\.abort\(\), 20_000\)/,
  "the optional care explanation must not override the shared 210-second model-request deadline");
assert.match(lcrInterpretation, /const controller = new AbortController\(\)/,
  "the optional care explanation must retain cancellation on component unmount");
assert.match(lcrInterpretation, /postJSON\("\/assistant\/assist",[\s\S]*?signal: controller\.signal/,
  "the optional care explanation must pass its unmount cancellation signal to the API client");
assert.match(lcrInterpretation, /caregiverSafeGeneratedText\(source\.label\)/,
  "generated source labels must use caregiver language");
assert.match(lcrInterpretation, /caregiverFieldLabel\(observation\.attribute\)/,
  "internal care field names must be translated before display");
assert.match(lcrInterpretation, /We couldn’t prepare an explanation from the saved care information right now/,
  "a failed or timed-out explanation must tell the caregiver what happened");
const apiClient = read("src/api/client.ts");
assert.match(apiClient, /requestOptions: \{ signal\?: AbortSignal \} = \{\}/,
  "POST requests must accept an optional cancellation signal");
assert.match(apiClient, /signal: requestOptions\.signal/,
  "POST requests must forward cancellation to fetch");
assert.match(apiClient, /const callerSignal = init\.signal \?\? undefined/,
  "the API client must retain the caller cancellation signal separately from its deadline controller");
assert.match(apiClient, /callerSignal\?\.addEventListener\("abort", abortFromCaller, \{ once: true \}\)/,
  "caller cancellation must propagate to the composed request signal");
assert.match(apiClient, /fetch\(input, \{ \.\.\.init, signal: controller\.signal \}\)/,
  "the API deadline controller must remain active when a caller supplies cancellation");
assert.match(apiClient, /pathname\.endsWith\("\/assistant\/assist"\) && method === "POST"\) return 210_000/,
  "read-only Companion interpretation must keep its bounded 210-second deadline");

requireText("src/components/mvp-workspace/LcrQwenInterpretation.tsx", [
  "source_event_id: sourceEventId",
]);

requireText("src/components/mvp-workspace/LcrQwenInterpretation.tsx", [
  "result.source_event_ids.includes(sourceEventId)",
]);

requireText("src/components/mvp-workspace/LcrQwenInterpretation.tsx", [
  "lcr_context_coverage",
  "coverage.retrieval_scan_complete !== true",
  "coverage.retrieval_projection_complete !== true",
  "We couldn’t check every saved care note and document. This explanation may miss important details",
]);
