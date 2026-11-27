import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const workspace = read("src/app/workspace/page.tsx");
const orientation = read("src/components/onboarding/FirstUseOrientation.tsx");
const context = read("src/lib/workspace-context.tsx");
const styles = read("src/app/mobile-app.css");

assert.match(workspace, /<FirstUseOrientation\s*\/>/, "Today must own the shared first-use experience");
assert.match(orientation, /Early access · We&apos;re testing SolenOS/, "First use must disclose early testing");
assert.match(orientation, /Who is this care record for\?/, "First use must explain recipient identity");
assert.match(orientation, /optional/, "Recipient details must remain optional");
assert.match(orientation, /Add a care update/);
assert.match(orientation, /Upload a document/);
assert.match(orientation, /Ask SolenOS a question/);
assert.match(orientation, /AI suggestions are not confirmed medical facts/);
assert.match(orientation, /Continue to Today/);
assert.match(orientation, /\/workspace\/daily-care/);
assert.match(orientation, /\/workspace\/documents/);
assert.match(orientation, /\/workspace\/companion/);
assert.match(orientation, /\/care-profile\/orientation-complete/);
assert.match(orientation, /first_use_orientation_completed_at/);
assert.match(context, /hasCareHistory/);
assert.doesNotMatch(context, /hasCompletedOnboarding|onboardingPending/);
assert.match(styles, /\.first-use-orientation/);
assert.match(styles, /\.early-access-compact/);
assert.doesNotMatch(workspace, /EarlyAccessConsentForm|ConsentGatePanel/);

console.log("✓ shared first-use orientation is mounted on Today with persisted caregiver completion and no blanket consent gate");
