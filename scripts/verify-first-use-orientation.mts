import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const workspace = read("src/app/workspace/page.tsx");
const orientation = read("src/components/onboarding/FirstUseOrientation.tsx");
const context = read("src/lib/workspace-context.tsx");
const shell = read("src/components/app-shell/WorkspaceShellContent.tsx");
const consentForm = read("src/components/public/EarlyAccessConsentForm.tsx");
const feedback = read("src/components/mvp-workspace/HelpImproveSolenos.tsx");
const settings = read("src/app/workspace/settings/page.tsx");
const styles = read("src/app/mobile-app.css");
const productDirective = read("docs/02-product/solenos-first-time-caregiver.md");

const includes = (source: string, value: string, message: string) =>
  assert.ok(source.includes(value), message);

includes(workspace, "<FirstUseOrientation />", "Today must own the shared first-use experience");
includes(orientation, "Early access · We&apos;re testing SolenOS", "First use must disclose early testing");
includes(orientation, "Who is this care record for?", "First use must explain recipient identity");
includes(orientation, 'Their name <span>(optional)</span>', "Recipient name must remain optional");
includes(orientation, 'Your relationship <span>(optional)</span>', "Caregiver relationship must remain optional");
includes(orientation, "Add a care update", "First use must expose Daily Care");
includes(orientation, "Upload a document", "First use must expose Documents");
includes(orientation, "Ask SolenOS a question", "First use must expose Companion");
includes(orientation, "AI suggestions are not confirmed medical facts", "AI limits must be explained");
includes(orientation, "Continue to Today", "Caregiver must be able to continue without contributing");
for (const route of ["/workspace/daily-care", "/workspace/documents", "/workspace/companion"]) {
  includes(orientation, route, `First-use action must use the real route ${route}`);
}
includes(orientation, "first_use_orientation_completed_at", "Completion must use server-persisted caregiver state");
includes(orientation, "completion.completed !== true", "Do not claim completion before server confirmation");
includes(orientation, "completion.completed_at", "Persisted completion timestamp must be checked");
assert.ok(!orientation.includes("localStorage"), "First-use state must not be inferred from browser storage");
assert.ok(!orientation.includes("hasSavedCareContext"), "Do not infer recipient existence from a UI-only flag");
includes(orientation, "if (hasCareHistory && !saved.first_use_orientation_completed_at)", "Existing history must be reconciled with persisted completion");
includes(orientation, "Reconnect to check your saved care history", "Care-history read failure must not look like an empty record");
includes(orientation, "Welcome back", "Returning caregivers must see returning content");
includes(context, "hasCareHistory", "Workspace must expose server-derived care history");
includes(context, "Boolean(existingToken)", "A valid server-issued session must restore workspace entry without a local UI flag");
assert.ok(!context.includes("hasCompletedOnboarding") && !context.includes("onboardingPending"), "Do not retain parallel local onboarding state");

assert.ok(!shell.includes("WorkspaceEntryGate"), "Do not introduce a blanket workspace-entry consent gate");
assert.ok(!shell.includes("EarlyAccessConsentForm"), "The legacy acknowledgement form must not block direct Care Record entry");
includes(consentForm, "medical or emergency advice", "The legacy acknowledgement copy must explain the medical boundary");
includes(consentForm, "care information is not sold or used for advertising", "The legacy acknowledgement copy must explain the privacy promise");
includes(consentForm, "people I trust", "The legacy acknowledgement copy must explain multi-caregiver access");
includes(feedback, "data_improvement_consent", "Feedback must verify optional improvement permission");
includes(feedback, "Turn on optional improvement feedback in Privacy settings before sending feedback.", "Feedback must explain the required optional opt-in");
includes(feedback, "feedback_category: option", "Feedback must persist the selected category");
includes(settings, "<HelpImproveSolenos compact />", "Feedback must remain available in Settings");
includes(styles, ".first-use-orientation", "First-use screen must have responsive styles");
includes(styles, ".early-access-compact", "Returning notice must have compact styles");
includes(productDirective, "same route, page structure, navigation", "Product directive must preserve one shared experience");
includes(productDirective, "consent", "Product directive must document consent enforcement");
includes(productDirective, "do not introduce a blanket privacy checkbox", "Product directive must preserve direct Care Record entry");
includes(productDirective, "A direct API request cannot bypass those checks", "Protected feedback writes must remain server-enforced");

console.log("✓ shared first-use orientation, persisted caregiver completion, action-specific consent, early-access feedback and returning state contracts are present");
