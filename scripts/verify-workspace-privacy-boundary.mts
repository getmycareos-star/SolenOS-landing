import assert from "node:assert/strict";
import fs from "node:fs";

const layout = fs.readFileSync("src/app/workspace/layout.tsx", "utf8");
const consentPanel = fs.readFileSync("src/components/mvp-workspace/ConsentGatePanel.tsx", "utf8");

assert.match(layout, /function WorkspacePrivacyBoundary/);
assert.match(layout, /consentState !== "accepted"/, "workspace content must remain hidden until backend consent is confirmed");
assert.match(layout, /<ConsentGatePanel caregiverId="" onStatusChange={setConsentState}\s*\/>/);
assert.match(layout, /<WorkspacePrivacyBoundary>\s*<WorkspaceProvider>/, "consent gate must wrap provider and all workspace route content");
assert.match(layout, /return <>\{children\}<\/>;/, "children should mount only after accepted state");
assert.doesNotMatch(layout, /<OnboardingGate>/, "do not show a second local-only consent wall inside the workspace");

assert.match(consentPanel, /apiUrl\("\/api\/v1\/consent"\)/, "required acknowledgement must be sent to backend");
assert.match(consentPanel, /data\.verified !== true \|\| data\.required !== false/, "gate must trust only backend confirmation");
assert.match(consentPanel, /onStatusChange\?\.\("accepted"\)/, "only confirmed server response releases the workspace");
console.log("✓ every workspace route is hidden until persisted consent is confirmed");
console.log("✓ browser onboarding flags are not accepted as consent proof");
console.log("✓ backend confirmation is required before workspace children mount");
