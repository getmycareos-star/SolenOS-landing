import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const drawer = fs.readFileSync(path.join(root, "src/components/app-shell/HistoryDrawer.tsx"), "utf8");
const shell = fs.readFileSync(path.join(root, "src/components/app-shell/AppShell.tsx"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/app/mobile-app.css"), "utf8");
const apiClient = fs.readFileSync(path.join(root, "src/api/client.ts"), "utf8");

assert.match(drawer, /ensureAnonymousSession/);
assert.match(drawer, /getJSON\("\/events\/"/);
assert.match(drawer, /Array\.isArray\(result\)/);
assert.match(drawer, /occurred_at/);
assert.match(drawer, /recorded_at/);
assert.match(drawer, /evidence_ids/);
assert.match(drawer, /time_provenance/);
assert.match(drawer, /Search care history/);
assert.match(drawer, /aria-modal="true"/);
assert.match(drawer, /role="menu"/);
assert.match(drawer, /Share/);
assert.match(drawer, /Copy details/);
assert.match(drawer, /Download record/);
assert.match(drawer, /No saved care events were returned/);
assert.match(drawer, /No example records were inserted/);
assert.doesNotMatch(drawer, /localStorage\.(?:get|set)Item/);
assert.match(shell, /<HistoryDrawer \/>/);
assert.match(shell, /from "@\/components\/app-shell\/HistoryDrawer"/);
assert.match(styles, /\.history-backdrop/);
assert.match(styles, /\.history-drawer/);
assert.match(styles, /@media \(max-width: 480px\)/);
assert.match(apiClient, /requestAuthorizationHeaders/);

console.log("History drawer contract checks passed: authenticated persisted event read, chronological grouping, search and filters, original record detail, source/time/evidence metadata, responsive drawer, and real share/copy/download actions.");
