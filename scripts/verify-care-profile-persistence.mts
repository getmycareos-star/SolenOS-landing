import fs from "node:fs";
import assert from "node:assert/strict";

const settings = fs.readFileSync("src/app/workspace/settings/page.tsx", "utf8");
const appShell = fs.readFileSync("src/components/app-shell/AppShell.tsx", "utf8");

assert.match(settings, /getJSON\(["']\/care-profile["']\)/, "settings must hydrate the care profile from the backend");
assert.match(settings, /putJSON\(["']\/care-profile["']/, "settings must save the care profile through the backend");
assert.match(settings, /careProfile.*caregiver-reported context|caregiver-reported context, not an independently verified clinical fact/i, "condition context must remain explicitly caregiver-reported");
assert.match(settings, /removeItem\(CARE_RECIPIENT_NAME_STORAGE\)[\s\S]*?removeItem\(["']solenos_care_profile["']\)/, "legacy device-only profile values may be removed only after successful server migration");
assert.doesNotMatch(settings, /localStorage\.setItem\(CARE_RECIPIENT_NAME_STORAGE/, "the recipient name must not be saved as browser-only authoritative data");
assert.doesNotMatch(settings, /localStorage\.setItem\(["']solenos_care_profile["']/, "relationship and condition must not be saved as browser-only authoritative data");
assert.match(appShell, /getJSON\(["']\/care-profile["']\)/, "share/export must read the persisted recipient name rather than a localStorage copy");
assert.doesNotMatch(appShell, /getItem\(["']solenos_care_recipient_display_name["']\)/, "share/export must not depend on the legacy device-only name");

console.log("PASS: care profile settings and share/export use the bearer-scoped backend record.");
