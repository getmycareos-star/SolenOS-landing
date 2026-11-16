import assert from "node:assert/strict";
import fs from "node:fs";

const state = fs.readFileSync("src/components/ui/RecordState.tsx", "utf8");
const overview = fs.readFileSync("src/components/app-shell/CareRecordOverview.tsx", "utf8");

for (const kind of [
  "first-empty",
  "period-empty",
  "no-results",
  "loading",
  "error",
  "forbidden",
  "unavailable",
  "incomplete",
]) {
  assert(state.includes(`"${kind}"`), `shared record states must define ${kind}`);
}

assert(overview.includes("response.person_id !== personId"), "care record response must match the authenticated person");
assert(overview.includes("hasLoadedRef.current = true"), "a successful primary record read must be remembered");
assert(overview.includes("setItems(response.items)"), "successful reads must replace the visible record");
assert(overview.includes("onAction={() => void load(true)}"), "record retrieval errors must retry the failed read");
assert(overview.includes('router.push("/workspace/daily-care")'), "the first-record action must open the existing Daily Care workflow");
assert(overview.includes("historyLoading ? <RecordState kind=\"loading\""), "pending change history must not render as an empty result");
assert(overview.includes("!historyLoading && !historyNote && changes.length === 0"), "only a completed successful history read may render an empty state");
assert(overview.includes("loadedPersonIdRef.current !== personId"), "cached records must not cross person/account identity changes");

const catchStart = overview.indexOf("} catch (cause) {");
const catchEnd = overview.indexOf("} finally {", catchStart);
assert(catchStart >= 0 && catchEnd > catchStart, "primary record request must have an explicit failure path");
const catchBody = overview.slice(catchStart, catchEnd);
assert(!catchBody.includes("setItems([])"), "a failed refresh must not erase previously loaded care information");
assert(!catchBody.includes("setChanges([])"), "a failed refresh must not erase previously loaded change history");

console.log("PASS: shared information states distinguish empty, loading, error, access and incomplete states.");
console.log("PASS: failed refresh preserves same-person saved data and cannot show it across account identities.");
console.log("PASS: pending history is not shown as empty; retry and Daily Care actions are connected.");
