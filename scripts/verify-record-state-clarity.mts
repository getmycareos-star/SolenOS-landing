import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const state = read("src/components/ui/RecordState.tsx");
const lcr = read("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx");
const orientation = read("src/components/mvp-workspace/PersistedCareOrientation.tsx");
const overview = read("src/components/app-shell/CareRecordOverview.tsx");
const daily = read("src/app/workspace/daily-care/page.tsx");
const reminders = read("src/app/workspace/reminders/page.tsx");
const history = read("src/components/app-shell/HistoryDrawer.tsx");

assert.match(state, /"empty" \| "no-results" \| "loading" \| "error" \| "unavailable" \| "unconfirmed"/);
assert.match(state, /aria-busy=\{isBusy \|\| undefined\}/);
assert.match(state, /role=\{isError \? "alert" : "status"\}/);

assert.match(lcr, /No care information recorded yet/);
assert.doesNotMatch(lcr, /Missing information does not mean everything is fine/);
assert.doesNotMatch(lcr, /This does not mean there are no care needs/);
assert.match(orientation, /No care information recorded yet/);
assert.match(orientation, /href="\/workspace\/daily-care"/);
assert.doesNotMatch(orientation, /Missing information does not mean that nothing happened/);

assert.match(daily, /contextLoading \? \([\s\S]*?RecordState kind="loading"/);
assert.match(daily, /contextError \? \([\s\S]*?RecordState kind="error"/);
assert.match(daily, /historyError \? \([\s\S]*?RecordState kind="error"/);
assert.doesNotMatch(daily, /This does not mean nothing happened|That does not mean nothing happened/);
assert.doesNotMatch(daily, /No new care records have been added since your last visit/);
assert.doesNotMatch(daily, /No updates have been saved today/);
assert.doesNotMatch(daily, /setHistoryItems\(\[\]\);\s*setHistoryMayBeTruncated\(false\);/);

assert.match(overview, /setHasLoaded\(true\)/);
assert.match(overview, /Keep the last successfully loaded records visible if a refresh fails/);
assert.doesNotMatch(overview, /No care information is available in this view yet/);
assert.doesNotMatch(overview, /missing information as proof that nothing happened/);

assert.match(reminders, /const \[hasLoaded, setHasLoaded\] = useState\(false\)/);
assert.match(reminders, /!hasLoaded && error \? null/);
assert.match(reminders, /RecordState kind="loading"/);
assert.doesNotMatch(reminders, /SolenOS does not invent sample reminders/);

assert.doesNotMatch(history, /empty section does not mean nothing happened/);

console.log("Record-state clarity and failure-separation checks passed.");
