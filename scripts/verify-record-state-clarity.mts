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
const claimReview = read("src/components/ClaimAssessmentPanel.tsx");

for (const kind of ["empty", "no-results", "loading", "error", "unavailable", "unconfirmed"]) {
  assert.ok(state.includes(`| "${kind}"`) || state.includes(`= "${kind}"`), `shared state supports ${kind}`);
}
assert.match(state, /aria-busy=\{isBusy \|\| undefined\}/);
assert.match(state, /role=\{isError \? "alert" : "status"\}/);

assert.match(lcr, /No care information recorded yet/);
assert.match(lcr, /href="\/workspace\/daily-care"/);
assert.doesNotMatch(lcr, /Missing information does not mean everything is fine/);
assert.doesNotMatch(lcr, /This does not mean there are no care needs|This is not a statement that no care needs exist/);
assert.match(lcr, /Not everything that happens is automatically recorded/);
assert.match(lcr, /error && projection &&/);
assert.match(lcr, /if \(manual\) setRefreshing\(true\);\s*else \{[\s\S]*?setProjection\(null\)/);
assert.doesNotMatch(lcr, /catch \(cause\) \{\s*setProjection\(null\)/);
assert.doesNotMatch(lcr, /Your Care Record does not have any care information yet/);
assert.doesNotMatch(lcr, /No saved care details to review yet/);
assert.doesNotMatch(lcr, /catch \(cause\) \{\s*setChanges\(\[\]\)/);
assert.doesNotMatch(lcr, /catch \(cause\) \{\s*setPatterns\(\[\]\)/);
assert.doesNotMatch(lcr, /catch \(cause\) \{\s*setAssessment\(null\)/);
assert.match(orientation, /No care information recorded yet/);
assert.match(orientation, /href="\/workspace\/daily-care"/);
assert.doesNotMatch(orientation, /Missing information does not mean that nothing happened/);

assert.match(daily, /contextLoading \? \([\s\S]*?RecordState kind="loading"/);
assert.match(daily, /contextError \? \([\s\S]*?RecordState kind="error"/);
assert.match(daily, /if \(Array\.isArray\(payload\?\.items\)\) \{\s*setCareItems/);
assert.match(daily, /const \[careItemsLoaded, setCareItemsLoaded\] = useState\(false\)/);
assert.match(daily, /const \[historyLoaded, setHistoryLoaded\] = useState\(false\)/);
assert.match(daily, /contextError && careItemsLoaded/);
assert.match(daily, /historyError && historyLoaded/);
assert.doesNotMatch(daily, /setCareItems\(Array\.isArray\(payload\?\.items\) \?/);
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
const followUps = read("src/app/workspace/open-loops/page.tsx");
assert.match(followUps, /if \(nextLoops\) setLoops\(nextLoops\)/);
assert.match(followUps, /if \(nextAssessment\) setAssessment\(nextAssessment\)/);
assert.doesNotMatch(followUps, /setLoops\(nextLoops \|\| \[\]\)/);
assert.match(reminders, /RecordState kind="loading"/);
assert.doesNotMatch(reminders, /SolenOS does not invent sample reminders/);

assert.doesNotMatch(history, /empty view is not evidence that no care was recorded/);
assert.match(history, /error && records\.length > 0/);
assert.match(history, /loading && !hasLoaded/);
assert.doesNotMatch(read("src/components/mvp-workspace/ChangeIntelligencePanel.tsx"), /This does not mean nothing changed/);
assert.doesNotMatch(read("src/app/workspace/open-loops/page.tsx"), /An empty section does not mean nothing needs attention/);
assert.doesNotMatch(claimReview, /This does not mean there are no past reviews|This does not mean this review is current/);
assert.match(claimReview, /Past reviews could not be loaded\. Try again\./);
assert.match(claimReview, /New information could not be checked\. Try again before relying on this review\./);

console.log("Record-state clarity and failure-separation checks passed.");
