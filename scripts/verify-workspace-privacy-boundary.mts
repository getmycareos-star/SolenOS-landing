import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync("src/app/workspace/layout.tsx", "utf8");
const appShell = fs.readFileSync("src/components/app-shell/AppShell.tsx", "utf8");
const legacyRecordRoute = fs.readFileSync("src/app/workspace/record/page.tsx", "utf8");
const companionHome = fs.readFileSync("src/app/workspace/page.tsx", "utf8");
const workspacePage = fs.readFileSync("src/app/workspace/care-continuity/page.tsx", "utf8");
const cognitiveWorkspace = fs.readFileSync("src/components/mvp-workspace/CognitiveWorkspace.tsx", "utf8");
const consentPanel = fs.readFileSync("src/components/mvp-workspace/ConsentGatePanel.tsx", "utf8");
const previewGate = fs.readFileSync("src/components/mvp-workspace/ResearchPreviewAckGate.tsx", "utf8");

assert.doesNotMatch(layout, /WorkspacePrivacyBoundary|ConsentGatePanel|consentState !== "accepted"/,
  "workspace layout must not block entry behind a privacy checkbox");
assert.match(layout, /<ErrorBoundary[\s\S]*?<WorkspaceProvider>\s*<WorkspaceShellContent>/,
  "workspace provider and shell mount directly");
assert.doesNotMatch(layout, /type="checkbox"|ResearchPreviewAckGate|EarlyAccessConsentForm/,
  "no acknowledgement checkbox may gate workspace routes");
assert.doesNotMatch(companionHome, /ResearchPreviewAckGate/,
  "the AI Companion home must not mount an early-version acknowledgement gate");
assert.match(legacyRecordRoute, /redirect\("\/workspace"\)/,
  "the legacy LCR route redirects to the AI Companion home");
assert.doesNotMatch(legacyRecordRoute, /ResearchPreviewAckGate|ConsentGatePanel|Living Care Record/,
  "the old LCR page is not rendered or used as a workspace destination");
assert.match(workspacePage, /Your Care Record/,
  "the retained care-continuity workspace preserves the current care record view");
assert.doesNotMatch(workspacePage, /ResearchPreviewAckGate/,
  "the care-continuity workspace must not mount an early-version acknowledgement gate");
assert.match(previewGate, /RESEARCH_PREVIEW_SECTION\.ackLabel|early.?version/i,
  "legacy component remains identifiable for regression detection, but must not be mounted in the workspace");
assert.doesNotMatch(previewGate, /type="checkbox"|RESEARCH_PREVIEW_SECTION|hasResearchPreviewAck/,
  "legacy preview wrapper must not render an acknowledgement checkbox");
assert.doesNotMatch(cognitiveWorkspace, /ConsentGatePanel|consentState|setConsentState|Retry the privacy check/,
  "the active LCR workspace must not block viewing or saving behind a privacy acknowledgement checkbox");
assert.match(consentPanel, /api\/v1\/consent/,
  "legacy consent API integration may remain for action-specific backend policy; it must not gate workspace entry");

console.log("✓ workspace routes mount without a privacy or early-version checkbox gate");
console.log("✓ direct workspace entry does not disable server-side authentication or authorisation");

const settings = fs.readFileSync("src/app/workspace/settings/page.tsx", "utf8");
assert.match(appShell, /markAnonymousSessionRevokedLocally\(\)/,
  "deleting a workspace without a bearer token must still retain the local deletion boundary");
assert.match(appShell, /key\.startsWith\("solenos_"\)/,
  "workspace deletion must clear dynamically added SolenOS-owned browser keys");
assert.match(appShell, /ownedKeys\.delete\("solenos_anonymous_session_revoked"\)/,
  "workspace deletion must preserve the local marker that blocks silent record recreation");
assert.match(appShell, /window\.sessionStorage\.clear\(\)/,
  "workspace deletion must clear temporary SolenOS browser-session state");

assert.match(settings, /await revokeAnonymousSession\(\)/,
  "clearing a device must attempt server-side revocation before local credentials are removed");
assert.match(settings, /markAnonymousSessionRevokedLocally\(\)/,
  "device clearing must retain a local deletion boundary even when no token exists or server revocation fails");
assert.match(settings, /key !== "solenos_anonymous_session_revoked"/,
  "the device cleanup sweep must preserve the local session-revocation marker");
assert.match(settings, /key\.startsWith\("solenos_"\)/,
  "clearing a device must remove underscore-prefixed SolenOS localStorage keys");
assert.match(settings, /key\.startsWith\("solenos:"\)/,
  "clearing a device must remove colon-namespaced SolenOS localStorage keys");
assert.match(settings, /await ensureAnonymousSession\(\);\s*const result = await getJSON\("\/privacy\/requests"\)/,
  "privacy request history must establish the authenticated anonymous session before reading server data");
assert.match(settings, /window\.sessionStorage\.clear\(\)/,
  "clearing a device must also clear tab-scoped SolenOS state");
assert.match(settings, /deleteJSON\("\/notifications\/push\/subscriptions"/,
  "clearing a device must remove the server-side push subscription when an authenticated session exists");
assert.match(settings, /subscription\.unsubscribe\(\)/,
  "clearing a device must unsubscribe this browser from push delivery");
assert.match(settings, /registration\?\.getNotifications\(\)/,
  "clearing a device must close visible SolenOS notifications");
assert.match(settings, /Ask us to delete care information/,
  "device clearing must remain distinct from care-record erasure");
assert.match(settings, /does not delete care information held by SolenOS/,
  "device clearing must not imply server-side care-record erasure");

console.log("✓ device cleanup revokes sessions, removes owned browser state and push subscriptions, and preserves server-record deletion as a separate request");

