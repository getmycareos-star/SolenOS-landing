import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const component = fs.readFileSync(path.join(root, "src/components/mvp-workspace/PersistedCareOrientation.tsx"), "utf8");
const legacyRoute = fs.readFileSync(path.join(root, "src/app/workspace/record/page.tsx"), "utf8");
const overview = fs.readFileSync(path.join(root, "src/app/workspace/care-continuity/page.tsx"), "utf8");
const shell = fs.readFileSync(path.join(root, "src/components/app-shell/AppShell.tsx"), "utf8");
const featureFlags = fs.readFileSync(path.join(root, "src/lib/feature-flags.ts"), "utf8");
const openLoops = fs.readFileSync(path.join(root, "src/app/workspace/open-loops/page.tsx"), "utf8");

assert.match(component, /ensureAnonymousSession/);
assert.match(component, /fetch\(`\/api\/situation\?\${params\.toString\(\)}`/);
assert.match(component, /response\.ok/);
assert.match(component, /We couldn't load your care information/);
assert.match(component, /is-new-caregiver/);
assert.match(component, /is-returning-caregiver/);
assert.match(component, /You can start with what you remember/);
assert.match(component, /Pick up where you left off/);
assert.match(component, /Your care information isn.t available right now/);
assert.match(component, /what_i_understood/);
assert.match(component, /ui_situations/);
assert.doesNotMatch(component, /sample care event|demo caregiver|fabricated/i);
assert.match(legacyRoute, /redirect\("\/workspace"\)/, "old LCR screen redirects to the Companion");
assert.doesNotMatch(legacyRoute, /PersistedCareOrientation|LCRCurrentUnderstanding|Record timeline/, "legacy route must not render the old LCR interface");
assert.match(component, /Start with one detail/, "new caregivers get a direct first action");
assert.match(component, /Add a care update/, "returning caregivers can continue their saved record");
assert.match(overview, /onEntryStateChange=\{setPersistedEntryState\}/, "overview receives the persisted entry classification");
assert.match(overview, /persistedEntryState === "returning"/, "overview distinguishes server-confirmed returning caregivers");
assert.match(overview, /Record status unavailable/, "failed record retrieval is not presented as a first visit");
assert.match(overview, /hasAnyContent && \(/, "local-only timeline content does not contradict a server-confirmed returning state");
assert.doesNotMatch(shell, /label: "Community"|href: "\/workspace\/community"/, "disabled Community is absent from workspace navigation");
assert.match(featureFlags, /community: false/);
assert.match(featureFlags, /professionalCommunity: false/);

// Open Loops must not expose the internal case-management schema to caregivers.
assert.match(openLoops, /id="open-loop-note"/);
assert.match(openLoops, /What still needs attention\\?/);
assert.match(openLoops, /description: rawText/);
assert.match(openLoops, /kind: "caregiver_recorded", text: rawText/);
assert.match(openLoops, /uncertainty: "unknown"/);
assert.doesNotMatch(openLoops, /Source reference \\(optional\\)|datetime-local|Short title|<label[^>]*>Type/);
assert.match(openLoops, /<details className="open-loop-more-actions">/);
assert.match(openLoops, /No deadline or outcome was assumed/);
assert.match(openLoops, /error \\? null :/, "an API failure must not render the empty-state message");
assert.match(openLoops, /An empty view does not mean nothing happened/);

console.log("Persisted-care orientation contract checks passed.");
