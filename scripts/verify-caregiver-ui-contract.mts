import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const companion = fs.readFileSync(path.join(root, "src/components/workflows/AICompanion.tsx"), "utf8");
const orientation = fs.readFileSync(path.join(root, "src/components/mvp-workspace/PersistedCareOrientation.tsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/app/globals.css"), "utf8");
const deltaPanel = fs.readFileSync(path.join(root, "src/components/CareDeltaPanel.tsx"), "utf8");

// Errors must be event-driven, dismissible through correction/reset, and not stale.
assert.match(companion, /\{requestError && <p role="alert"/);
assert.match(companion, /setRequestError\(null\)/);
assert.match(companion, /const startNewSession = \(\) => \{[\s\S]*?setRequestError\(null\)/);
assert.match(companion, /onChange=\{e => \{[\s\S]*?setRequestError\(null\)/);

// Internal evaluation metadata must never be rendered into the caregiver conversation.
assert.doesNotMatch(companion, /Safety: \{msg\.safety_note\}/);
assert.doesNotMatch(companion, /Guard: \{msg\.guard_verdict\}/);
assert.doesNotMatch(companion, /Confidence: \{Math\.round/);
assert.doesNotMatch(companion, /Evidence: \{msg\.evidence_ids/);
assert.doesNotMatch(companion, /Replies may be unavailable sometimes/);
assert.doesNotMatch(companion, /The safety engine flagged this exchange/);
assert.match(companion, /Ask a question or share what’s happening/);
assert.match(companion, /showPanel=\{false\}/);
assert.match(deltaPanel, /if \(!showPanel\) return null/);
assert.match(deltaPanel, /if \(!personId \|\| !showPanel\)/);

// A successful empty response is a first-visit state, not a load error.
assert.match(orientation, /Your care record is ready to build/);
assert.match(orientation, /data\.ok === false/);
assert.doesNotMatch(orientation, /!Array\.isArray\(data\.events\)/);
assert.match(orientation, /Your care information isn't available right now\. Check your connection and try again\./);
assert.doesNotMatch(orientation, /<p><\/p>/);

// Primary controls have explicit, high-contrast sage/ink tokens.
assert.match(styles, /--solenos-sage-button: #b9d5b5/);
assert.match(styles, /--solenos-button-ink: #17251c/);

console.log("Caregiver UI contract checks passed.");
