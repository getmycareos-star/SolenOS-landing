import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync("src/app/workspace/open-loops/page.tsx", "utf8");
const careContinuity = fs.readFileSync("src/components/mvp-workspace/LCRCurrentUnderstanding.tsx", "utf8");
const caregiverLanguage = fs.readFileSync("src/lib/caregiver-language.ts", "utf8");
const allCareViews = page + "\n" + careContinuity;

const required: Array<[string, RegExp]> = [
  ["loads every persisted follow-up page before presenting the list", /async function loadAllOpenLoops\(\)[\s\S]*?limit=\$\{pageSize\}&offset=\$\{offset\}[\s\S]*?expectedCount[\s\S]*?records\.length > expectedCount[\s\S]*?records\.length === expectedCount/],
  ["rejects incomplete, duplicate or invalid follow-up pages instead of presenting partial history as complete", /seenIds\.has\(row\.id\)[\s\S]*?could not be fully retrieved[\s\S]*?larger than the available page limit/],
  ["loads the canonical situation-understanding assessment", /getJSON\("\/care-continuity\/situation-understanding"\)/],
  ["keeps partial source failures visible", /Promise\.allSettled\([\s\S]*?if \(!nextLoops && !nextAssessment\)/],
  ["refreshes a missing or stale assessment through the existing endpoint", /status === "not_assessed"[\s\S]*?reassessment_recommended === true[\s\S]*?postJSON\("\/care-continuity\/situation-understanding\/reassess"/],
  ["does not use an assessment belonging to another person", /nextAssessmentResponse\.assessment\.person_id === personId/],
  ["refreshes when a care record is changed or the caregiver returns", /careRecordUpdated[\s\S]*?window\.addEventListener\("focus"/],
  ["ignores stale refresh responses after a newer refresh starts", /const requestSequence = \+\+refreshSequence\.current[\s\S]*?const isCurrentRequest = \(\) =>[\s\S]*?requestSequence === refreshSequence\.current[\s\S]*?if \(!isCurrentRequest\(\)\) return/],
  ["invalidates in-flight refreshes when the follow-up page unmounts", /active = false;[\s\S]*?refreshSequence\.current \+= 1/],
  ["records the caregiver response against the existing loop type", /if \(\["awaiting_response", "follow_up"\]\.includes\(loop\.loop_type\)\)[\s\S]*?postJSON\(`\/open-loops\/\$\{encodeURIComponent\(loop\.id\)\}\/responses`, updatePayload\)[\s\S]*?else[\s\S]*?postJSON\(`\/open-loops\/\$\{encodeURIComponent\(loop\.id\)\}\/outcomes`, updatePayload\)/],
  ["submits the exact displayed loop version with caregiver response and outcome updates", /const updatePayload = \{[\s\S]*?expected_version: loop\.version[\s\S]*?postJSON\(`\/open-loops\/\$\{encodeURIComponent\(loop\.id\)\}\/responses`, updatePayload\)/],
  ["submits the exact displayed loop version with caregiver action notes", /function recordAction[\s\S]*?expected_version: loop\.version[\s\S]*?\/actions/],
  ["reuses the same idempotency key when a caregiver update response is uncertain", /pendingUpdateKeys\.current\[loop\.id\][\s\S]*?pending\?\.signature === signature \? pending\.key : crypto\.randomUUID\(\)/],
  ["clears the pending update key only after the saved view refreshes", /await refresh\(\)[\s\S]*?delete pendingUpdateKeys\.current\[loop\.id\]/],
  ["preserves the caregiver report draft after an uncertain save", /onUpdate\(loop, updateText\.trim\(\)\)[\s\S]*?\.catch\(\(\) => \{ \/\* Keep the exact report text available for a safe retry\. \*\//],
  ["states that a caregiver update is not a verified outcome", /Your update was saved\. SolenOS has not marked this as resolved\./],
  ["fails closed when the update cannot be confirmed", /The update could not be confirmed\. Nothing has been marked resolved\./],
  ["discloses bounded or incomplete source coverage", /assessmentIsBounded[\s\S]*?Some saved care information is missing or has not been checked/],
  ["shows evidence status and incomplete history beside LCR care changes", /item\.evidence_status[\s\S]*?item\.history_completeness[\s\S]*?Some earlier care information may be missing/],
  ["shows linked follow-up status and outcome in both care views", /item\.linked_follow_up_outcome_status[\s\S]*?caregiverStatusLabel/],
  ["renders the four explicit attention classifications", /needs_attention_now[\s\S]*?important_to_address[\s\S]*?can_wait_with_documented_basis[\s\S]*?needs_clarification/],
  ["uses the three specified caregiver follow-up sections", /<h2>Needs attention<\/h2>[\s\S]*?<h2>Being monitored<\/h2>[\s\S]*?<h2>Needs clarification<\/h2>/],
  ["maps persisted follow-up states to caregiver-facing progress labels", /function lifecycleLabel/],
  ["maps information waits from persisted loop types", /awaiting_response[\s\S]*missing_information[\s\S]*professional_input[\s\S]*unconfirmed_outcome/],
  ["maps action waits from persisted loop types", /pending_action[\s\S]*follow_up[\s\S]*pending_decision/],
  ["shows progress only after a response or outcome is recorded", /response_evidence\.length > 0[\s\S]*outcome_evidence\.length > 0[\s\S]*return "In progress"/],
  ["lists cancelled follow-ups separately and shows the cancellation reason", /No longer relevant[\s\S]*cancellation_reason/],
  ["keeps resolved follow-ups separate from cancelled items", /Items marked as resolved/],
  ["shows lifecycle status separately from urgency", /Status: \{lifecycleLabel\(loop\)\}/],
  ["shows linked notes and documents", /Related notes and documents[\s\S]*?uniqueEvidenceIds/],
  ["reads the appointment ID from the persisted Open Loop projection", /appointment_id\?: string \| null/],
  ["shows appointment lineage in the caregiver-facing follow-up card", /Related to a saved appointment/],
  ["explains that appointment follow-ups remain connected to the visit history", /Related appointment[\s\S]*?connected to a saved appointment and its history/],
  ["passes a linked follow-up review date into its card", /review_at: loop\.review_at/],
  ["labels a due review as requested rather than as a future date", /Check-in requested/],
  ["records caregiver actions without marking the concern resolved", /function recordAction[\s\S]*?postJSON\("\/open-loops\/" \+ encodeURIComponent\(loop\.id\) \+ "\/actions"[\s\S]*?The concern has not been marked as resolved\./],
  ["does not expose a second general-purpose follow-up writer", /function shareUpdate[\s\S]*?const updatePayload =[\s\S]*?postJSON\(`\/open-loops\/\$\{encodeURIComponent\(loop\.id\)\}\/responses`, updatePayload\)[\s\S]*?postJSON\(`\/open-loops\/\$\{encodeURIComponent\(loop\.id\)\}\/outcomes`, updatePayload\)/],
  ["reassesses saved follow-ups before refreshing the page", /postJSON\("\/open-loops\/reassess"/],
  ["loads all follow-up event and occurrence history pages", /loadAllLoopRecords<LoopHistoryEvent>[\s\S]*?\/history[\s\S]*?loadAllLoopRecords<LoopOccurrence>[\s\S]*?\/occurrences/],
  ["uses offset pagination and rejects duplicate or incomplete history pages", /async function loadAllLoopRecords[\s\S]*?offset=\$\{page \* pageSize\}[\s\S]*?seenIds\.has\(row\.id\)[\s\S]*?rows\.length < pageSize/],
];

for (const [label, pattern] of required) {
  assert.match(allCareViews, pattern, `Follow-ups contract missing: ${label}`);
}

assert.match(page, /item\.category === "needs_attention_now" \|\| item\.category === "important_to_address" \? "Needs attention"/, "all items needing action use the same simple label");
assert.doesNotMatch(page, /Needs attention now|Important to address|followup-status/, "follow-up cards avoid extra labels and repeated status text");
const openLoopCreateWrites = page.match(/postJSON\("\/open-loops",/g) ?? [];
assert.equal(openLoopCreateWrites.length, 1, "event-derived follow-ups must use one canonical create writer");
assert.match(page, /async function createFollowUp\(item: AttentionDecision\)[\s\S]*?if \(\(item\.source !== "events" && item\.source !== "persisted_change"\) \|\| !item\.record_id\) return;[\s\S]*?postJSON\("\/open-loops",\s*\{[\s\S]*?source_type: item\.source,[\s\S]*?source_id: item\.record_id,[\s\S]*?idempotency_key: idempotencyKey/s, "follow-up creation must remain bound to a persisted source record and retry-safe");
assert.doesNotMatch(page, /function createLoop/, "do not add a second general-purpose follow-up writer");
assert.match(page, /!loop && \(item\.source === "events" \|\| item\.source === "persisted_change"\) && item\.record_id/, "persisted change candidates must expose the same explicit Add to Follow-ups action");
assert.match(page, /item\.evidence_status/, "follow-up cards must expose evidence status separately from care significance");
assert.match(page, /item\.history_completeness/, "follow-up cards must disclose incomplete history");
assert.match(page, /Who is following up:[\s\S]*?loop\?\.owner_label/, "follow-up cards must show who is responsible or say no one is assigned");
assert.match(page, /item\.source === "open_loop_records" \? caregiverSourceText\(item\.title\) : caregiverSafeGeneratedText\(item\.title\)/, "caregiver-written follow-up titles retain their exact wording while generated titles are screened");
assert.match(page, /title: caregiverSafeGeneratedText\(item\.title\)/, "new follow-ups must not persist an internal generated title");
assert.match(page, /rawDescriptionLines[\s\S]*?safeDescriptionLines[\s\S]*?safeDescriptionLines\.length === rawDescriptionLines\.length[\s\S]*?The reason needs to be checked against the original care information/, "generated follow-up explanations must be caregiver-safe before persistence; rejected text must not be stored raw");
assert.match(page, /reasonLines\.length > 0[\s\S]*?No reason was recorded for this follow-up yet\./,
  "a follow-up must explain its reason or say plainly when no reason was recorded");
assert.match(page, /reasonCandidates\.length > 0[\s\S]*?The explanation could not be shown clearly/,
  "filtered follow-up reasons must remain visible as unavailable rather than disappearing");

assert.match(page, /Last updated:[\s\S]*?loop\?\.updated_at/, "follow-up cards must show the last saved update when available");

assert.match(page, /caregiverSafeGeneratedText\(line\)/, "system-generated follow-up reasons must be filtered before display");
assert.match(page, /loopHistoryLoadFailed/, "a failed follow-up history read must be tracked separately from an empty history");
assert.match(page, /We couldn’t check which follow-ups have been resolved just now\. Your last saved list remains visible\./, "a failed history read must not be presented as no resolved follow-ups");
assert.match(page, /We couldn’t check what can wait or needs a check-in just now/, "a failed attention assessment must not be presented as an empty monitoring list");
assert.match(page, /We couldn’t check which details need clarification just now/, "a failed attention assessment must not be presented as no clarification needed");


assert.match(page, /const unclassifiedFollowUpItems: AttentionDecision\[\] = unclassifiedLoops\.map\([\s\S]*?category: "needs_clarification"[\s\S]*?We do not yet have enough information to tell whether this needs action or can wait/, "unclassified saved follow-ups must remain explicitly unassessed rather than being represented as safe to wait");
assert.match(page, /<h2>Being monitored<\/h2>[\s\S]*?categorized\.monitored\.map\([\s\S]*?<h2>Needs clarification<\/h2>[\s\S]*?unclassifiedFollowUpItems\.map\(/, "unclassified follow-ups must appear in Needs clarification, not Being monitored");
assert.doesNotMatch(page, /<h2>Being monitored<\/h2>[\s\S]*?unclassifiedLoops\.map\(/, "Being monitored must contain only items with an explicit documented basis to wait");
assert.doesNotMatch(page, /action_status: loop\.status/, "Open Loop lifecycle status must not be copied into the independent action-status dimension");
assert.doesNotMatch(page, /linkedToSavedFollowUp/, "a linked Open Loop must not suppress the care-attention classification from the latest assessment");
assert.match(page, /needsAttention: unique\(\[\.\.\.\(care\?\.needs_attention_now \|\| \[\]\), \.\.\.\(care\?\.important_to_address \|\| \[\]\)\]\)/, "linked follow-ups must retain their assessment-derived attention category");
assert.match(page, /const unclassifiedLoops = linkedLoops\.filter\(\(loop\) => !allAttention\.some\(\(item\) =>[\s\S]*?item\.source === loop\.source_type && item\.record_id === loop\.source_id/, "only loops with no matching assessed source may enter the unclassified clarification group");
assert.match(page, /item\.action_status === "not_recorded"/, "follow-up cards must distinguish missing action records from completed actions");
assert.match(caregiverLanguage, /outcome_unknown: "Outcome not recorded"/, "an unknown follow-up outcome must not be described as resolved");
assert.ok(page.includes("Follow-ups"), "Follow-ups must be visible as a named caregiver capability");
assert.ok(page.includes("Follow-ups are based on the care information saved here"), "caregiver copy must explain what follow-ups are based on");
assert.match(careContinuity, /item\.evidence_status[\s\S]*?item\.history_completeness[\s\S]*?Some earlier care information may be missing/, "LCR important changes must show evidence status and incomplete history");
assert.match(careContinuity, /item\.linked_follow_up_outcome_status[\s\S]*?caregiverStatusLabel/, "LCR important changes must show the linked follow-up outcome");


assert.match(careContinuity, /Only items that may need your attention appear here[\s\S]*?This is not a diagnosis/, "Care priorities must remain a short, non-diagnostic current summary");
assert.match(careContinuity, /These are changes or things that are still unclear in the saved care history[\s\S]*?not automatically tasks[\s\S]*?Follow-ups screen/, "monitoring signals must remain distinct from the follow-up workflow");
assert.match(careContinuity, /href="\/workspace\/open-loops"[\s\S]*?See follow-ups/, "Care priorities must link to the dedicated Follow-ups screen");
assert.match(careContinuity, /href="\/workspace\/open-loops"[\s\S]*?See follow-ups/, "Changes to keep an eye on must link to the dedicated Follow-ups screen");

console.log("FOLLOW_UPS_UI_CONTRACT=PASS");
console.log(`Assertions=${required.length + 3}`);
console.log("Scope=frontend source contract; not a browser or deployed-system test");

assert.match(page, /Pages use immutable creation order[\s\S]*?displayOrdered[\s\S]*?deadline_at[\s\S]*?setLoops\(displayOrdered\)/,
  "caregiver priority ordering is restored only after the complete paginated list has been retrieved");

assert.match(page, /response\.count !== expectedCount[\s\S]*?changed while it was being loaded/,
  "follow-up pagination must fail visibly if the collection changes between pages");

assert.match(page, /function lifecycleNextStepLabel/, "every follow-up state must map to a plain next step");
assert.match(page, /Next step: \{lifecycleNextStepLabel\(loop\)\}/, "follow-up cards must display the next step beside the current status");
assert.match(page, /No action is needed unless new information changes this/, "resolved follow-ups must not create unnecessary work");
assert.match(page, /Ask the person who may know, or add the information when it becomes available/, "missing-information follow-ups must explain a practical next step");

assert.match(page, /loop\?\.priority_reasons/, "saved follow-up reasons must be included in the caregiver explanation");
assert.match(page, /What information is missing/, "follow-ups that need clarification must show the missing information section");
assert.match(page, /caregiverSafeGeneratedText\(detail\)/, "missing-information details must pass through the caregiver language boundary");
assert.match(page, /The specific information needed has not been recorded yet/, "missing-information states must not invent details");

assert.match(page, /records\.length > expectedCount[\s\S]*?count did not match the records returned/, "follow-up pagination must reject more rows than the API reports, including a zero-count response with rows");
