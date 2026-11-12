import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const lcr = fs.readFileSync(
  path.join(root, "src", "components", "mvp-workspace", "LCRCurrentUnderstanding.tsx"),
  "utf8",
);
const clarification = fs.readFileSync(
  path.join(root, "src", "components", "ClarificationWorkflowPanel.tsx"),
  "utf8",
);

for (const contract of [
  'getJSON(`/registered-actions/',
  'postJSON(',
  'explicit_approval: true',
  'idempotency_key:',
  'suggestion_id:',
  'evidence_ids: item.evidence_ids',
  'Suggested follow-up — not a registered action',
  'Approve and register',
  'Keep as suggestion',
  'Defer consideration',
  'Request clarification',
  'Agreed actions',
  'View change history',
  'Confirm completed',
  'Needs clarification',
  'registeredActionsError',
  'responsible_caregiver_id: session.caregiver.id',
  'create_reminder: createReminderForSuggestion',
  'linked_reminder_status',
  'linked_reminder_due_at',
  'currentCaregiverId',
  'Only the responsible caregiver can change this action.',
  'Another caregiver',
  'Sources: {(action.source_evidence_ids ?? [action.source_evidence_id]).length} saved item(s)',
  'disabled={action.responsible_caregiver_id !== currentCaregiverId || actionTransitionLoadingId === action.id}',
  'disabled={action.responsible_caregiver_id !== currentCaregiverId || actionTransitionLoadingId === action.id || (action.linked_reminder_status === "open" && !actionDeferredUntil[action.id])}',
]) {
  assert.ok(lcr.includes(contract), `LCR approved-action contract missing: ${contract}`);
}

assert.ok(
  lcr.includes("event.evidence_ids.length"),
  "Registered-action history must show its saved source count",
);

assert.ok(
  lcr.includes('status === "completed"') && lcr.includes('explicit_completion_confirmation: status === "completed"'),
  "Completion must be an explicit caregiver transition",
);
assert.ok(
  lcr.includes('await patchJSON(`/open-loops/') && lcr.includes('status: "deferred"'),
  "Suggestion deferral must reuse the persisted Open Loop workflow",
);
assert.ok(
  lcr.includes('prefillQuestion={clarificationPrefill?.question}') &&
    clarification.includes('postJSON("/uncertainty/questions"'),
  "Request clarification must prefill and reuse the persisted clarification workflow",
);
assert.ok(
  lcr.includes('if (!saved?.id || saved.person_id !== session.person.id || saved.suggestion_id !== suggestionId.slice(0, 160))'),
  "Frontend must verify the backend action response before showing success",
);
assert.ok(
  lcr.includes('setRegisteredActions([]);') &&
    lcr.includes('Agreed actions are unavailable because your care record session could not be confirmed.'),
  "Action state must be cleared on session failure",
);

console.log("PASS: LCR suggestions remain separate; approval, lifecycle, reminder and clarification flows are backend-connected.");
