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

const documents = fs.readFileSync("src/app/workspace/documents/page.tsx", "utf8");
assert(documents.includes("listError && documents.length === 0 ? null"), "a failed initial document read must not render a genuine empty state");
assert(documents.includes("listError && <RecordState kind=\"error\""), "document read failures must have a distinct retryable state");
assert(documents.includes("loadDocuments(documents.length > 0)"), "retrying a document refresh must preserve already visible documents");
assert(documents.includes('kind={documents.length === 0 ? "first-empty" : "no-results"}'), "document empty and filtered-result states must remain distinct");
assert(documents.includes("uploadInputRef.current?.click()"), "the empty document action must open the existing upload workflow");
assert(documents.includes("() => setQuery(\"\")"), "the no-results action must clear the search");
console.log("PASS: document retrieval failures cannot masquerade as an empty library; empty and search states have working actions.");

const dailyCare = fs.readFileSync("src/app/workspace/daily-care/page.tsx", "utf8");
assert(dailyCare.includes("hasContextLoadedRef.current"), "Daily Care must retain the last successful load across refreshes");
assert(dailyCare.includes("if (!hasContextLoadedRef.current) setContextLoading(true)"), "refreshing existing Daily Care data must not hide it behind an initial loading screen");
assert(dailyCare.includes("contextError && careItems.filter((item) => !isOpenMatter(item)).length === 0"), "a failed current-care read with no cached records must show an error, not an empty state");
assert(dailyCare.includes("contextError && careItems.length > 0"), "a failed refresh with cached care information must retain the information and show a warning");
const historyFailureStart = dailyCare.indexOf('if (!Array.isArray(payload?.records))');
const historyFailureEnd = dailyCare.indexOf('} else {', historyFailureStart);
assert(historyFailureStart >= 0 && historyFailureEnd > historyFailureStart, "Daily Care history response must be validated");
assert(!dailyCare.slice(historyFailureStart, historyFailureEnd).includes("setHistoryItems([])"), "a failed history read must not erase previously loaded care history");
assert(dailyCare.includes("historyError ? null : (") && dailyCare.includes("No new care updates recorded"), "a failed history read must not appear as no new updates");
console.log("PASS: Daily Care preserves previously loaded care and history when a refresh fails.");

const followUps = fs.readFileSync("src/app/workspace/open-loops/page.tsx", "utf8");
assert(followUps.includes("if (nextLoops !== null) setLoops(nextLoops)"), "a failed follow-up read must not clear previously loaded follow-ups");
assert(followUps.includes("if (nextAssessment !== null) setAssessment(nextAssessment)"), "a failed attention review must not clear the previous review");
assert(followUps.includes("Your previously saved information remains visible"), "follow-up refresh errors must explain that saved information remains visible");
console.log("PASS: partial follow-up refresh failures preserve the last successfully loaded information.");

const reminders = fs.readFileSync("src/app/workspace/reminders/page.tsx", "utf8");
assert(reminders.includes("hasLoadedRef.current = true"), "reminders must remember a successful list read");
assert(reminders.includes("error && !hasLoadedRef.current ? null"), "an initial reminder read failure must not render a false empty list");
assert(reminders.includes("onAction={() => { setError(\"\")"), "reminder errors must expose a retry action");
assert(reminders.includes("loading && !hasLoadedRef.current"), "only an initial reminder load should replace the list with a loading state");
console.log("PASS: reminder loading, empty and failed states are separate, and retries preserve previously loaded reminders.");
