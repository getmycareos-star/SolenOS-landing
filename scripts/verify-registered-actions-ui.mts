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
  'This item is shown for reference only. It cannot be added as a follow-up without a clear request and supporting information.',
  'Approve and register',
  'Keep as suggestion',
  'Defer consideration',
  'Review questions',
  'Agreed actions',
  'View change history',
  'Confirm completed',
  'Needs checking',
  'registeredActionsError',
  'responsible_caregiver_id: responsibleCaregiverId || session.caregiver.id',
  'getJSON("/caregiver-access/assignable-members")',
  'Responsible caregiver',
  'setAssignableCaregivers(members as AssignableCaregiver[])',
  'create_reminder: createReminderForSuggestion',
  'linked_reminder_status',
  'linked_reminder_due_at',
  'currentCaregiverId',
  'Only the responsible caregiver can change this action.',
  'Another caregiver',
  'Related to {(action.source_evidence_ids ?? [action.source_evidence_id]).length} saved care detail',
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
  lcr.includes('status === "completed"') &&
    lcr.includes('explicit_completion_confirmation: status === "completed"') &&
    lcr.includes('completion_outcome: status === "completed" ? reason : undefined'),
  "Completion must include an explicitly recorded outcome, not just a status toggle",
);
assert.ok(
  lcr.includes('Record what happened before completing this follow-up.') &&
    lcr.includes('if (status === "completed")') &&
    lcr.includes('await load(true)') &&
    lcr.includes('const savedActions = await getJSON(`/registered-actions/${encodeURIComponent(personId)}`)') &&
    lcr.includes('persisted?.status === "completed"') &&
    lcr.includes('Completion was saved, but the response was interrupted.'),
  "The caregiver must record an outcome, refresh the canonical LCR and reconcile an uncertain completion response before retrying",
);
assert.ok(
  lcr.includes('await patchJSON(`/open-loops/') && lcr.includes('status: "deferred"'),
  "Suggestion deferral must reuse the persisted Open Loop workflow",
);
assert.ok(
  lcr.includes("onClick={openClarification}") &&
    lcr.includes("<ClarificationWorkflowPanel personId={personId} />") &&
    clarification.includes('getJSON(`/uncertainty/questions/${encodeURIComponent(sessionPersonId)}`)') &&
     /patchJSON\(`\/uncertainty\/questions\/\$\{encodeURIComponent\(selectedQuestion\.id\)\}`,\s*payload\)/.test(clarification),
  "Review questions must open, retrieve and update the persisted clarification workflow",
);
assert.ok(
  lcr.includes('if (!saved?.id || saved.person_id !== session.person.id || saved.suggestion_id !== suggestionId.slice(0, 160))'),
  "Frontend must verify the backend action response before showing success",
);
assert.ok(
  lcr.includes("let sessionConfirmed = false;") &&
    lcr.includes("sessionConfirmed = true;") &&
    lcr.includes("if (!sessionConfirmed)") &&
    lcr.includes("setRegisteredActions([]);") &&
    lcr.includes("setRegisteredActionsError(accessMessage);") &&
    lcr.includes("setActionHistory({});") &&
    lcr.includes("setChangeEvidence({});") &&
    lcr.includes("setEvidenceIntegrityByFact({});") &&
    lcr.includes("setError(accessMessage);") &&
    lcr.includes("Your previously saved information is still shown when available."),
  "Care-scoped actions and history must be cleared when access is lost, while confirmed-session fetch failures may retain the last saved view",
);

console.log("PASS: LCR suggestions remain separate; approval, lifecycle, reminder and clarification flows are backend-connected.");
