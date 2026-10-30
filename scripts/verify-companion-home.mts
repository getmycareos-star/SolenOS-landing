import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const home = read("src/app/workspace/page.tsx");
const dailyCare = read("src/app/workspace/daily-care/page.tsx");
const shell = read("src/components/app-shell/AppShell.tsx");
const record = read("src/app/workspace/record/page.tsx");
const companionAlias = read("src/app/workspace/companion/page.tsx");

assert.match(home, /@\/components\/workflows\/AICompanion/);
assert.match(home, /solenos-companion-home/);
assert.match(home, /companion-conversation/);
assert.match(home, /conversation|Companion/);
assert.match(home, /compose/);
assert.match(dailyCare, /StructuredDailyCapture/);
assert.doesNotMatch(dailyCare, /DailyCareQwen|daily-care\/intelligence\/ask|Ask Daily Care Qwen/);
assert.match(shell, /href: "\/workspace", label: "AI Companion"/);
assert.match(shell, /href: "\/workspace\/record", label: "Living Care Record"/);
assert.match(record, /LCRCurrentUnderstanding/);
assert.match(record, /Record timeline/);
assert.doesNotMatch(record, /lcr-support-section|AI Companion/);
assert.match(companionAlias, /redirect\("\/workspace"\)/);

console.log("Companion home contract passed: one canonical AI Companion home, preserved add-record flow and separate LCR route, and no AI agent embedded in Daily Care.");
