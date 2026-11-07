import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const component = fs.readFileSync(
  path.join(process.cwd(), "src", "components", "workflows", "AppointmentWorkspace.tsx"),
  "utf8",
);
const handoff = fs.readFileSync(
  path.join(process.cwd(), "src", "components", "workflows", "CareHandoffSharing.tsx"),
  "utf8",
);

for (const contract of [
  "attendanceStatus",
  "actualVisitAt",
  "rescheduledAt",
  "testsReferrals",
  "Waiting for result",
  "resultStatus",
  "appointment_id: selectedAppointmentId",
  "idempotency_key: activeDraftKey",
  "idempotency_key: activeDraftKey + '-v'",
  "postJSON('/evidence'",
  "ingestion_key:",
  "registered-actions/",
  "explicit_approval: true",
  "care-continuity/assertions/",
  "assertion_status: 'accepted'",
  "evidence_ids:",
  "applySavedWorkspace",
  "savedWorkspaces.map",
  "Add this to my follow-up responsibilities",
  "remains a caregiver report",
  "/care-continuity/contradictions/",
  "Different accounts need a closer look",
  "Neither has been chosen as correct.",
]) {
  assert.ok(component.includes(contract), `Appointment continuity contract missing: ${contract}`);
}

assert.ok(component.includes("setAttendanceStatus('not_recorded')"), "A new appointment must not default to attended.");
assert.ok(component.includes("disabled={!actualVisitDate || attendanceStatus !== 'attended'"), "Only an attended visit with an actual date can be added as a time-bound care assertion.");
assert.ok(component.includes("A name here is only a note; SolenOS does not notify that person."), "A typed owner name must not be represented as an account assignment.");
assert.ok(component.includes("acceptedHandoffRecipients"), "appointment follow-ups must only offer caregivers who accepted a handoff.");
assert.ok(component.includes("/assignee"), "appointment follow-ups must persist assignment through the backend.");
assert.ok(component.includes("target_caregiver_id:"), "assignment must target a real linked caregiver identity.");
assert.ok(component.includes("handoff_id:"), "assignment must retain the accepted handoff reference.");
assert.ok(component.includes("Result status<select value={item.resultStatus} disabled={!item.register || Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)}"), "only the responsible caregiver may change result status.");
assert.ok(component.includes("What result was received?<textarea value={item.resultText || ''} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)}"), "only the responsible caregiver may record a received result.");
assert.ok(component.includes("Review decision<select value={item.reviewDecision || ''} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)}"), "only the responsible caregiver may record a result review decision.");
assert.ok(component.includes("What did the caregiver decide after reviewing?<textarea value={item.reviewNotes || ''} disabled={Boolean(item.assignedCaregiverId && item.assignedCaregiverId !== currentCaregiverId)}"), "only the responsible caregiver may edit result review notes.");
assert.ok(component.includes("/care-continuity/action-outcomes"), "received and reviewed results must be written to their own durable care-history records.");
assert.ok(component.includes("outcome_status: 'result_received'"), "result receipt must be persisted independently.");
assert.ok(component.includes("outcome_status: 'result_reviewed'"), "result review must be persisted as a separate event.");
assert.ok(component.includes("related_outcome_id:"), "result review must refer to the exact received-result event.");
assert.ok(component.includes("review_decision:"), "result review must retain the caregiver's explicit decision.");
assert.ok(component.includes("/care-continuity/outcomes/"), "fresh sessions must reconstruct result state from persisted outcome events.");
assert.ok(component.includes("resultReviewedEventId"), "appointment revisions must retain the review event reference.");
assert.ok(component.includes("Include this caregiver-reported result in the Living Care Record"), "result evidence must enter the LCR only after explicit caregiver approval.");
assert.ok(component.includes("followUpResult_"), "approved follow-up results must be reconciled as distinct appointment assertions.");
assert.ok(component.includes("Caregiver-reported follow-up result"), "result assertions must preserve caregiver-source attribution.");
assert.ok(component.includes("invalidatesResultApproval"), "changing result content must invalidate an earlier LCR approval.");
assert.ok(component.includes("extra_metadata: { appointment_draft_key: activeDraftKey, follow_up_index: index }"), "follow-up evidence must retain the active draft key even on the first save.");
assert.ok(component.includes("let baseWorkspaceSaved = false"), "the save flow must distinguish a persisted workspace from incomplete linked follow-up work.");
assert.ok(component.includes("Your appointment notes were saved, but some follow-up updates could not be confirmed."), "partial completion must not be presented as a total save failure.");
assert.ok(component.includes("Appointment notes and available follow-up updates have been saved."), "full success must be reported only after linked follow-up and review work finishes.");
assert.ok(!component.includes("setSaveMessage('Your appointment notes have been saved.')"), "the UI must not announce full success immediately after the first workspace write.");
assert.ok(handoff.includes('scope: [...selectedScope].sort()') && handoff.includes('"open_loops"'), "care handoffs must pass the caregiver-selected scope and include source-grounded open-loop responsibility when applicable.");
assert.ok(!component.includes("Evidence freshness assessments"), "Internal evidence diagnostics must not appear in the caregiver interface.");
assert.ok(!component.includes("source snapshot"), "Internal source terminology must not appear in the caregiver interface.");


const workspaceHome = fs.readFileSync(path.join(process.cwd(), "src/app/workspace/page.tsx"), "utf8");
const homeSummary = fs.readFileSync(path.join(process.cwd(), "src/components/mvp-workspace/AppointmentContinuitySummary.tsx"), "utf8");
assert(workspaceHome.includes("<AppointmentContinuitySummary />"), "caregiver home must show saved appointment continuity");
assert(homeSummary.includes('getJSON("/appointment-workspaces")'), "home summary must read saved appointment outcomes");
assert(homeSummary.includes('/care-continuity/assertions/'), "home summary must count only accepted care-history entries");
assert(homeSummary.includes("Follow-ups still open") && homeSummary.includes("Results and questions"), "home summary must show outstanding responsibilities, results and unresolved questions");
assert(homeSummary.includes("Overdue") && homeSummary.includes("Received"), "home summary must surface overdue actions and results awaiting review");
assert(!homeSummary.toLowerCase().includes("sample appointment") && !homeSummary.toLowerCase().includes("demo appointment"), "home summary must not use fabricated appointment examples");
console.log("PASS: appointment outcomes, evidence review, follow-up continuity and caregiver-facing language are wired.");

assert.ok(component.includes("function DetailedAppointmentWorkspace({ initiallyOpen = false }"), "the existing detailed continuity and approval workflow must remain available as an optional review path");
assert.ok(component.includes("export default function AppointmentWorkspace()"), "the default appointment experience must be the low-burden guided workflow");
assert.ok(component.includes("You can leave this empty"), "during-visit capture must be explicitly optional");
assert.ok(component.includes("getJSON('/appointment-workspaces/' + encodeURIComponent(recordId) + '/outcome-draft')"), "the caregiver view must load the backend-organized outcome draft");
assert.ok(component.includes("No appointment outcome has been recorded yet"), "an empty after-visit state must be honest and must not fabricate an outcome");
assert.ok(component.includes("The Living Care Record has not been changed"), "generating an outcome draft must remain read-only until explicit review");
assert.ok(component.includes("Open detailed review and follow-up controls"), "the existing detailed evidence approval and follow-up controls must remain accessible but optional");
assert.ok(component.includes("Caregiver notes remain caregiver reports"), "the guided workflow must preserve source attribution");
