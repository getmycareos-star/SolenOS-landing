import assert from "node:assert/strict";
import fs from "node:fs";

const state = fs.readFileSync("src/components/ui/RecordState.tsx", "utf8");
const overview = fs.readFileSync("src/components/app-shell/CareRecordOverview.tsx", "utf8");
const currentUnderstanding = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const darkModeStyles = fs.readFileSync("src/app/dark-mode-remediation.css", "utf8");

assert(darkModeStyles.includes(':root[data-solenos-theme="dark"] .record-state'), "record states must use the dark-theme panel surface");
assert(darkModeStyles.includes(".record-state--error") && darkModeStyles.includes("background-color: var(--theme-warning-bg)"), "error, forbidden and unavailable states must retain a warning surface in dark mode");
assert(darkModeStyles.includes("color: var(--theme-warning-fg)"), "warning-state text must retain accessible contrast in dark mode");

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
const accessDeniedStart = catchBody.indexOf("if (accessDenied) {");
const accessDeniedEnd = catchBody.indexOf("\n      }\n      setError", accessDeniedStart);
assert(accessDeniedStart >= 0 && accessDeniedEnd > accessDeniedStart, "access-denied handling must be explicit");
const accessDeniedBody = catchBody.slice(accessDeniedStart, accessDeniedEnd);
assert(accessDeniedBody.includes("setItems([])") && accessDeniedBody.includes("setChanges([])"), "care information must be cleared when access is denied");
const nonAccessDeniedBody = catchBody.slice(0, accessDeniedStart) + catchBody.slice(accessDeniedEnd + "\n      }".length);
assert(!nonAccessDeniedBody.includes("setItems([])"), "a transient refresh failure must not erase previously loaded care information");
assert(!nonAccessDeniedBody.includes("setChanges([])"), "a transient refresh failure must not erase previously loaded change history");


assert(currentUnderstanding.includes("personIdRef.current !== scopedPersonId"), "cached care information must be cleared when the authenticated person changes");
assert.match(currentUnderstanding, /catch \{\s*if \(!isCurrentRequest\(\)\) return;\s*setChangesError/);
assert.match(currentUnderstanding, /catch \{\s*if \(!isCurrentRequest\(\)\) return;\s*setPatternsError/);
assert.doesNotMatch(currentUnderstanding, /catch \{\s*setChanges\(\[\]\)/, "failed change-history refresh must preserve the last successful history");
assert.doesNotMatch(currentUnderstanding, /catch \{\s*setPatterns\(\[\]\)/, "failed repeated-change refresh must preserve the last successful history");
assert.match(currentUnderstanding, /changesError && <RecordState kind="error"/);
assert.match(currentUnderstanding, /patternsError && <RecordState kind="error"/);
assert.doesNotMatch(currentUnderstanding, /Missing records do not mean nothing changed/);
assert.doesNotMatch(currentUnderstanding, /This does not mean nothing is repeating/);

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
assert(dailyCare.includes("<DailyCareOfflineQueueNotice />"), "the capture screen must surface the actual offline queue state");
assert(dailyCare.includes("<NaturalLanguageDailyUpdate />"), "the primary detailed capture must preserve the caregiver's own words");
assert(dailyCare.includes("<QuickDailyCheckIn />"), "the quick check-in remains available without becoming a required workflow");
assert(dailyCare.includes("<DailyCarePhotoCapture />"), "photo capture remains available from Daily Care");
assert(dailyCare.includes('href="/workspace/timeline"'), "full historical review belongs to the dedicated Care Timeline");
assert(!dailyCare.includes("/daily-care/intelligence/history"), "Daily Care capture must not duplicate the full history retrieval surface");
console.log("PASS: Daily Care keeps capture, offline status and historical navigation separate.");


const followUps = fs.readFileSync("src/app/workspace/open-loops/page.tsx", "utf8");
assert(followUps.includes("if (nextLoops !== null) {") && followUps.includes("setLoops(displayOrdered)"), "a failed follow-up read must not clear previously loaded follow-ups; successful reads retain the caregiver-facing sort order");
assert(followUps.includes("if (nextAssessment !== null) setAssessment(nextAssessment)"), "a failed attention review must not clear the previous review");
assert(followUps.includes("Your previously saved information remains visible"), "follow-up refresh errors must explain that saved information remains visible");
console.log("PASS: partial follow-up refresh failures preserve the last successfully loaded information.");

const reminders = fs.readFileSync("src/app/workspace/reminders/page.tsx", "utf8");
assert(reminders.includes("hasLoadedRef.current = true"), "reminders must remember a successful list read");
assert(reminders.includes("error && reminders.length === 0 ? null"), "a failed reminder read with no cached reminders must suppress the empty state");
assert(reminders.includes("{error ? <RecordState kind=\"error\""), "reminder read failures must render a distinct recoverable error state");
assert(reminders.includes("void refresh(personId || undefined)"), "reminder error recovery must retry the persisted list read");
assert(reminders.includes("onAction={() => { setError(\"\")"), "reminder errors must expose a retry action");
assert(reminders.includes("loading && !hasLoadedRef.current"), "only an initial reminder load should replace the list with a loading state");
console.log("PASS: reminder loading, empty and failed states are separate, and retries preserve previously loaded reminders.");

assert(reminders.includes('kind={reminders.length === 0 ? "first-empty" : "no-results"}'), "reminder filters with no matches must not be presented as an empty reminder list");
assert(reminders.includes('onAction={reminders.length > 0 ? () => setFilter("all") : undefined}'), "the no-results reminder action must clear the filter");

assert(documents.includes('actionLabel={documents.length === 0 ? "Add a document" : "Clear search"}'), "document empty-state actions must use accurate caregiver-facing labels");

const lcr = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
assert(lcr.includes("This record reflects the care information saved here. It may not include everything happening in care."), "the Care Record must explain once what its information represents without repeating its introduction");
assert(lcr.includes('<RecordState kind="first-empty" title="No care updates recorded yet"'), "the Care Record must distinguish a genuine first-time empty state");
assert(lcr.includes('<RecordState kind="incomplete"'), "insufficient information must remain distinct from an empty record");
assert(lcr.includes('<RecordState kind="period-empty" title="No recent changes recorded"'), "recent changes must have a distinct empty state");
assert(!lcr.includes("Missing information does not mean"), "repeated defensive empty-state disclaimers must be removed from the Care Record");
assert(!lcr.includes("This is not a statement that no care needs exist"), "care-priority empty states must not repeat defensive disclaimers");
console.log("PASS: the Care Record has one contextual introduction and concise, distinct empty/incomplete/error states.");

const history = fs.readFileSync("src/components/app-shell/HistoryDrawer.tsx", "utf8");
assert(history.includes("error && records.length > 0 && <RecordState"), "a failed history refresh must keep previously loaded records visible");
assert(history.includes("error && records.length === 0"), "an initial history failure must not be shown as an empty history");
assert(history.includes('<RecordState kind="loading" title="Loading saved care history"'), "history loading must remain distinct from empty");
assert(history.includes('<RecordState kind="incomplete" title="Your care history is incomplete"'), "partial history retrieval must be distinct from an empty history");
assert(history.includes('<RecordState kind="no-results" title="No matching records"'), "filtered history with zero matches must be distinct from a genuinely empty history");
assert(!history.includes("an empty section does not mean nothing happened"), "the history view must not repeat defensive empty-state disclaimers");
console.log("PASS: care history preserves loaded records and separates empty, filtered, incomplete, loading and failure states.");

const companion = fs.readFileSync("src/components/workflows/AICompanion.tsx", "utf8");
assert(companion.includes("getJSON('/assistant/status')"), "Companion must check the backend readiness signal before presenting its welcome state");
assert(companion.includes("status.operational === true"), "Companion must require confirmed inference operation before showing starter prompts");
assert(companion.includes("availability === 'checking'"), "Companion readiness checks must have a loading state");
assert(companion.includes("availability === 'unavailable'"), "unavailable inference must not display the normal welcome state");
assert(companion.includes("availability === 'unverified'"), "unverified inference must not be presented as ready");
assert(companion.includes("availability !== \"available\""), "the message composer must remain disabled until inference is confirmed");
assert(companion.includes("Your Care Record, Daily Care and Documents remain available"), "Companion unavailability must direct caregivers to working care-record areas");
console.log("PASS: Companion welcome and message composer are gated on confirmed inference readiness.");

assert(history.includes("sourceWarnings.length > 0 && !loading && records.length > 0"), "partial history warnings must not be duplicated with the incomplete empty state");

assert(companion.includes("void checkAvailability().then(() => loadPendingCareUpdates())"), "Companion must reuse one bootstrapped session for readiness and pending-update reads");

const handoffs = fs.readFileSync("src/components/workflows/CareHandoffSharing.tsx", "utf8");
for (const source of ["directoryResult", "inboxResult", "outboxResult", "draftsResult"]) {
  assert(handoffs.includes(`Array.isArray(${source}.value.items)`), `handoff ${source} must validate a real list before treating it as loaded`);
}
assert(handoffs.includes("historyError && (inbox.length > 0 || outbox.length > 0) && <RecordState"), "failed handoff refreshes must keep previously loaded sharing history visible");
assert(handoffs.includes('title="No handoffs recorded yet"'), "only a successful, consent-authorized empty read may show no handoffs");
assert(handoffs.includes('title="Sharing history could not be loaded"'), "failed handoff history must be distinct from an empty history");
assert(handoffs.includes('title="Recipient access could not be checked"'), "failed recipient discovery must have a distinct retryable state");
console.log("PASS: handoff lists validate their payloads and preserve loaded history across retrieval failures.");

assert(handoffs.includes("const [draftsError, setDraftsError]"), "saved-summary retrieval errors must be tracked separately from inbox/outbox errors");
assert(handoffs.includes("draftsError && savedDrafts.length > 0"), "failed summary refreshes must preserve and display previously loaded drafts");
assert(handoffs.includes("savedDrafts.length === 0 && !loading && !draftsError"), "only a successful empty saved-draft read may show the no-summaries state");

assert(history.includes("loadedPersonIdRef.current !== requestPersonId"), "history cache must be cleared when the authenticated person changes");
assert(history.includes("if (!requestPersonId || accessDenied ||"), "history cache must be cleared when access is denied or the active session cannot be confirmed");
console.log("PASS: care history cannot remain visible across account changes or denied access.");

assert(overview.includes("const storedPersonId = getPersonId()"), "the Care Record must detect a cleared or changed browser identity before refreshing");
assert(overview.includes("if (accessDenied)"), "the Care Record must not keep cached details visible after access is denied");

assert(handoffs.includes("loadedScopeRef.current.personId !== requestPersonId") && handoffs.includes("loadedScopeRef.current.caregiverId !== requestCaregiverId"), "handoff data must be cleared when the active Care Record or caregiver changes");
assert(handoffs.includes("setSavedDrafts([])") && handoffs.includes("setInbox([])") && handoffs.includes("setOutbox([])"), "handoff drafts and sharing history must be cleared on identity changes");
assert(handoffs.includes("if (!requestPersonId || !requestCaregiverId || accessDenied)"), "handoff data must be cleared when the session cannot be confirmed or access is denied");
assert(handoffs.includes("cause instanceof ApiResponseError") && handoffs.includes("cause.status === 401") && handoffs.includes("cause.status === 403"), "handoff identity isolation must use HTTP status, not only error-message wording");
console.log("PASS: handoff lists and drafts are isolated to the active Care Record identity.");