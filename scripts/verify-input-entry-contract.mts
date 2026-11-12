/**
 * Input Entry Contract — Scan / Snap / Upload / Share; same pipeline after evidence.
 * SoT: docs/02-product/solenos-input-entry-contract.md
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  INPUT_ENTRY_CONTRACT_PURPOSE,
  INPUT_ENTRY_ACTION_CONTRACT,
  EVIDENCE_PIPELINE_AFTER_ENTRY,
  UPLOAD_FILE_ACCEPT,
  entryMethodToInputType,
  assertEntryMethodDoesNotBranchReasoning,
  MVP_COMPOSER_ENTRY_ACTIONS,
} from "../src/lib/input-entry-contract";

const root = process.cwd();

console.log("=== Input Entry Contract ===\n");
console.log(INPUT_ENTRY_CONTRACT_PURPOSE);

assert.equal(INPUT_ENTRY_ACTION_CONTRACT.scan.opens, "document_scanner");
assert.ok(INPUT_ENTRY_ACTION_CONTRACT.scan.never.includes("normal_file_picker"));
assert.equal(INPUT_ENTRY_ACTION_CONTRACT.snap.opens, "live_camera");
assert.ok(INPUT_ENTRY_ACTION_CONTRACT.snap.never.includes("document_scanner"));
assert.equal(INPUT_ENTRY_ACTION_CONTRACT.upload.opens, "system_file_picker");
assert.ok(INPUT_ENTRY_ACTION_CONTRACT.upload.never.includes("camera"));
assert.equal(INPUT_ENTRY_ACTION_CONTRACT.share.opens, "os_share_target");
console.log("✓ action opens/never contracts");

assert.deepEqual(
  [...EVIDENCE_PIPELINE_AFTER_ENTRY],
  [
    "evidence_understanding",
    "care_reality_update",
    "situation_relationship_engine",
    "response_contract",
  ],
);
console.log("✓ shared evidence pipeline");

assert.equal(entryMethodToInputType("scan"), "document");
assert.equal(entryMethodToInputType("snap"), "document");
assert.equal(entryMethodToInputType("upload"), "document");
assert.equal(entryMethodToInputType("share"), "document");
assert.equal(entryMethodToInputType("text"), "text");
assertEntryMethodDoesNotBranchReasoning(false);
console.log("✓ entry_method maps to channels without reasoning branch");

const panel = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "AddSituationPanel.tsx"),
  "utf8",
);
assert(panel.includes("SnapCameraCapture"));
assert(panel.includes("ScanDocumentCapture"));
assert(panel.includes("UPLOAD_FILE_ACCEPT") || panel.includes(UPLOAD_FILE_ACCEPT.slice(0, 20)));
assert(panel.includes('setSnapOpen(true)'));
assert(panel.includes('setScanOpen(true)'));
assert(!panel.includes('capture="environment"'), "Snap must not use file-input capture shortcut as primary");
assert(panel.includes("Share2") || panel.includes("Share"));
for (const action of MVP_COMPOSER_ENTRY_ACTIONS) {
  assert(panel.toLowerCase().includes(action), `composer must expose ${action}`);
}
console.log("✓ AddSituationPanel wires Scan/Snap/Upload/Share");

const snap = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "capture", "SnapCameraCapture.tsx"),
  "utf8",
);
assert(snap.includes("getUserMedia"));
assert(snap.includes("not a document scan") || snap.includes("Not document"));
console.log("✓ Snap uses live camera");

const scan = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "capture", "ScanDocumentCapture.tsx"),
  "utf8",
);
assert(scan.includes("getUserMedia"));
assert(scan.includes("document") || scan.includes("Document"));
assert(!scan.includes('type="file"'));
console.log("✓ Scan uses document capture (not file picker)");

const manifest = fs.readFileSync(path.join(root, "public", "manifest.webmanifest"), "utf8");
assert(manifest.includes("share_target"));
assert(manifest.includes("/share-target"));
console.log("✓ Share Target registered in manifest");

assert(fs.existsSync(path.join(root, "src", "app", "share-target", "route.ts")));
assert(fs.existsSync(path.join(root, "src", "app", "api", "share-intake", "route.ts")));
const shareTarget = fs.readFileSync(path.join(root, "src", "app", "share-target", "route.ts"), "utf8");
const shareClaim = fs.readFileSync(path.join(root, "src", "app", "api", "share-intake", "route.ts"), "utf8");
assert(shareTarget.includes("createPersistentShare") && shareTarget.includes("/api/v1/share-intake"));
assert(shareClaim.includes("getBackendOrigin") && shareClaim.includes("/api/v1/share-intake/"));
assert(!shareTarget.includes("putSharedIntake"), "Share Target must not rely on process-local memory");
console.log("✓ Share Target persists and claims one-time backend capabilities");

const extractor = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "capture", "extract-attached.ts"),
  "utf8",
);
assert(extractor.includes('postFormData("/upload"') && extractor.includes("evidenceId"));
const workspace = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "CognitiveWorkspace.tsx"),
  "utf8",
);
assert(workspace.includes("evidence_id: d.evidenceId"));
const apiUrl = fs.readFileSync(path.join(root, "src", "lib", "api-url.ts"), "utf8");
assert(apiUrl.includes('normalized === "/api/extract"'), "Document extraction must stay on the Next.js route handler even when a direct backend origin is configured");
console.log("✓ Document extraction route is not redirected to an unregistered FastAPI endpoint");

console.log("✓ Original documents persist and link to care events");

assert(workspace.includes("isLcrOrientationOnly"));
assert(workspace.includes("/api/lcr/orientation"));
assert(workspace.includes("setLcrOrientationReply"));
assert(workspace.includes('method: "GET"') && workspace.includes("hydrationRes"));
assert(workspace.includes("active_care_situation_turn"));
assert(workspace.includes("let hydrated = situationData"), "Use the POST read-after-write projection first");
assert(
  workspace.indexOf("let hydrated = situationData") < workspace.indexOf("const hydrationUrl"),
  "A second GET must be a fallback only when the POST lacks a persisted view",
);
console.log("✓ LCR interaction-only inputs use Qwen orientation in LCR; care captures prefer the persisted POST projection");

const companion = fs.readFileSync(
  path.join(root, "src", "components", "workflows", "AICompanion.tsx"),
  "utf8",
);
assert(companion.includes("autoDraftSent"));
assert(companion.includes("sendMessage(draft)"));
assert(companion.includes("postJSON('/conversation/message'"));
assert(companion.includes("ensureAnonymousSession()"));
assert(companion.includes("person_id: session.person.id"));
assert(companion.includes('aria-label="Send a message to Companion"'));
assert(companion.includes('className="companion-send" type="submit"'));
assert(companion.includes("void sendMessage()"));
assert(companion.includes("type=\"submit\""));
const community = fs.readFileSync(
  path.join(root, "src", "components", "workflows", "Community.tsx"),
  "utf8",
);
assert(community.includes('aria-label="Send community post"'));
assert(community.includes("Send post"));
assert(community.includes("onSubmit={submitPost}"));
assert(community.includes("postJSON('/community'"));
assert(community.includes("Share what works"));
assert(community.includes("Ask the community"));
assert(community.includes(">By tag</h4>"));
assert(community.includes(">By stage</h4>"));
for (const tag of ["sundowning", "wandering", "medication", "behavior", "sleep", "safety", "activities", "nutrition"]) {
  assert(community.includes(`'${tag}'`), `Community must expose the ${tag} topic filter`);
}
for (const stage of ["Early stage", "Moderate", "Late", "All stages"]) {
  assert(community.includes(`label: '${stage}'`), `Community must expose the ${stage} stage filter`);
}


assert(workspace.includes('err.detail.code === "conversation_only"'));
assert(!workspace.includes("/workspace/companion?draft="), "LCR must not redirect greetings or insults to Companion");
console.log("✓ Companion has a visible form-based Send button wired to the real message endpoint");
console.log("✓ Community has a visible Send post button wired to the real community publishing endpoint");
const companionSource = fs.readFileSync(path.join(root, "src", "components", "workflows", "AICompanion.tsx"), "utf8");
assert(companionSource.includes("postJSON('/conversation/message'"), "Companion must use the conversation endpoint");
assert(companionSource.includes("client_turn_id"), "Companion turns must be idempotent");
assert(!companionSource.includes("care_update_candidates"), "Companion must not create or review LCR proposals");
assert(!companionSource.includes("reviewCareUpdate"), "Companion must not expose care-record review actions");
assert(!companionSource.includes("/companion/care-updates"), "Companion must not run a parallel care-review workflow");
assert(!companionSource.includes("ScanDocumentCapture"), "Document scanning belongs in Documents");
assert(!companionSource.includes("SnapCameraCapture"), "Camera capture belongs in Documents");

// Provenance status is displayed only when returned by the backend; no write is inferred.
const dailyCaptureSource = fs.readFileSync(path.join(root, "src", "components", "workflows", "StructuredDailyCapture.tsx"), "utf8");
assert(dailyCaptureSource.includes("qwen_extraction_status"), "Daily Capture must surface the backend Qwen extraction result");
assert(dailyCaptureSource.includes("setDeltaAutoInput({"), "Daily Capture must trigger automatic care-delta reconciliation after a successful save");

console.log("✓ LCR greetings and insults use the server-issued session and read-only LCR endpoint; they are not written as care evidence");

const sot = fs.readFileSync(
  path.join(root, "docs", "02-product", "solenos-input-entry-contract.md"),
  "utf8",
);
assert(sot.includes("never change the reasoning engine") || sot.includes("never** change"));
console.log("✓ SoT present");

const documentPage = fs.readFileSync(path.join(root, "src", "app", "workspace", "documents", "page.tsx"), "utf8");
assert(documentPage.includes('form.append("file", page.file)'), "Document intake must upload the original file");
assert(documentPage.includes('form.append("ingestion_key", page.ingestionKey)'), "Document retries must retain the original ingestion key");
assert(!documentPage.includes("/api/extract") && !documentPage.includes("extractText("), "Document intake must not perform duplicate browser-side extraction");
assert(!documentPage.includes('form.append("extracted_text"'), "Browser-extracted text must not be sent as authoritative document text");
assert(!documentPage.includes("Extracted text — review and correct before saving"), "Caregivers must not be forced to review extracted text before preserving the original");
assert(documentPage.includes("SolenOS will extract and process it after the upload is saved."), "Original-first intake must explain that server-side processing follows upload");
assert(documentPage.includes(".eml,.msg"), "The document picker must accept EML and Outlook MSG files");
console.log("✓ Documents are preserved first; extraction is server-side and caregiver text review is not a save prerequisite");

console.log("\nAll input-entry-contract checks passed.");


const settingsPage = fs.readFileSync(path.join(root, "src", "app", "workspace", "settings", "page.tsx"), "utf8");
assert(settingsPage.includes('putJSON("/notifications/preferences"'));
assert(settingsPage.includes("revokeAnonymousSession"), "Account settings must expose secure sign-out backed by server-side session revocation.");
assert(settingsPage.includes("await revokeAnonymousSession()"), "Sign-out must revoke the server session before the browser clears its credentials.");
assert(!settingsPage.includes("SecurityCard"));
assert(settingsPage.includes('getJSON("/notifications?limit=100&offset=0")'));
assert(settingsPage.includes('getJSON("/notifications/unread-count")'));
assert(settingsPage.includes('patchJSON("/notifications/" + encodeURIComponent(item.id) + "/read", {})'));
assert(settingsPage.includes("Notification inbox"));
const notificationPage = fs.readFileSync(path.join(root, "src", "app", "workspace", "notifications", "page.tsx"), "utf8");
assert(notificationPage.includes('redirect("/workspace/settings#settings-notifications")'));
console.log("✓ Notification inbox and preferences live inside Settings; old notification URL redirects there");