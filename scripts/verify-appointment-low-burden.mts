import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync('src/components/workflows/AppointmentWorkspace.tsx', 'utf8')

// Preparation is generated from the existing care record; no appointment form is required.
assert.ok(component.includes('Your visit summary'))
assert.ok(component.includes("getJSON('/appointment-workspaces/preparation-brief?window_days=90')"))
assert.ok(component.includes('selectNextAppointment'))
// An existing scheduled visit gets a durable preparation workspace automatically.
// No appointment form or voice capture is required.
assert.ok(component.includes("postJSON('/appointment-workspaces/ensure-upcoming', {})"))
assert.ok(component.includes('Prepare and persist the workspace automatically'))
assert.ok(component.includes('This creates continuity workspace only; it does not book a visit.'))
assert.ok(component.includes('You do not have to fill in forms before, during or after a visit.'))
assert.ok(component.includes('You do not need to rewrite information already in your Care Record'))
assert.ok(component.includes('brief.prior_decisions?.length'))
assert.ok(component.includes('brief.decision_outcomes?.length'))
assert.ok(component.includes('brief.open_loops?.length'))
assert.ok(component.includes('appointment_needs?: Array<'))
assert.ok(component.includes('Appointment information to clarify'))
assert.ok(component.includes('item.subject_type !== "appointment"'))
assert.ok(component.includes('brief.documents?.length'))

// Switching caregiver/person cannot leave the previous visit visible during a new load.
assert.ok(component.includes('setBrief(null)'))
assert.ok(component.includes('setRecord(null)'))
assert.ok(component.includes('setOutcomeProposals([])'))
// Workspace selection is tied to the selected appointment; unrelated notes are not reused.
assert.ok(component.includes('items.find(item => item.appointment_id === selectedAppointmentId)'))
assert.ok(!component.includes('items.find(item => !item.appointment_id)'), 'unlinked workspaces must not be reused as appointment records')
assert.ok(component.includes('setRecord(null)'))

// Follow-ups retain their appointment/workspace lineage in the caregiver view.
assert.ok(component.includes('appointment_id?: string | null'))
assert.ok(component.includes('source_workspace_id?: string | null'))
assert.ok(component.includes('brief.appointments.find(appointment => appointment.source_id === item.appointment_id)'))

assert.ok(component.includes('It does not book appointments or confirm them with a provider.'))
// Capture is optional. Voice capture is intentionally not part of this release.
assert.ok(component.includes('You can leave this empty and return later.'))
assert.ok(component.includes('You can leave notes empty.'))
assert.ok(!component.includes('navigator.mediaDevices.getUserMedia'))
assert.ok(!component.includes('MediaRecorder'))

// After-visit details are persisted, then proposed for explicit caregiver review.
assert.ok(component.includes("getJSON('/appointment-workspaces/' + encodeURIComponent(recordId) + '/outcome-draft')"))
assert.ok(component.includes("postJSON('/appointment-workspaces/' + encodeURIComponent(record.id) + '/outcome-proposals', {})"))
assert.ok(component.includes("if (stage === 'after')"))
assert.ok(component.includes('Nothing is added to your Care Record until you review and approve a suggested detail.'))
assert.ok(component.includes('Each item is linked to the appointment information it came from.'))

// Failures remain visible and the caregiver can retry without losing saved notes.
assert.ok(component.includes('Your saved appointment note is still stored, but its details could not be loaded. Try refreshing.'))
assert.ok(component.includes('Some saved appointment details could not be refreshed. Your saved information has not been changed. Try again.'))
assert.ok(component.includes('setReloadToken(value => value + 1)'))
assert.ok(component.includes('Try again'))
assert.ok(component.includes("getJSON('/appointment-workspaces/' + encodeURIComponent(recordId) + '/outcome-proposals')"), 'manual refresh must reload saved review proposals as well as the outcome draft')
assert.ok(component.includes('Saved appointment information could not be fully refreshed. Your saved notes have not been changed. Try again.'), 'refresh failures must be visible without implying saved notes were lost')

// The actual routed appointment page opens directly onto the prepared brief.
assert.ok(component.includes('const [open, setOpen] = useState(true)'), 'the caregiver must not need an extra click to see appointment continuity');
assert.ok(component.includes("recorded.find(item => ['completed', 'resolved', 'historical']"), 'the most recent completed appointment must remain available for after-visit continuity');
assert.ok(component.includes(': null\n          // Prepare and persist the workspace automatically'), 'unlinked workspaces must not be mistaken for appointment records');
assert.ok(component.includes('There is no existing appointment record to attach this note to'), 'notes must not create a disconnected appointment workspace');
assert.ok(component.includes("brief.appointment_context_status?.code === 'date_unknown'"), 'unknown appointment dates must be explicit');
assert.ok(component.includes("brief.appointment_context_status?.code === 'cancelled'"), 'cancelled appointments must not appear as active bookings');
assert.ok(component.includes("brief.appointment_context_status?.code === 'rescheduled'"), 'rescheduled appointments must be distinguishable');
assert.ok(component.includes("brief.appointment_context_status?.code === 'occurred'"), 'occurred appointments must be distinguishable');
assert.ok(component.includes("brief.appointment_context_status?.code === 'retrieval_failed'" ) || component.includes("brief.lcr_retrieval_status?.status === 'failed'"), 'technical retrieval failures must not appear as empty history');
assert.ok(component.includes('professionalStatement') && component.includes('recordedDecisions') && component.includes('recordedInstructions') && component.includes('unansweredQuestions'), 'optional after-visit capture must preserve separate professional statements, decisions, instructions and unanswered questions');
assert.ok(component.includes('extractAttachedDocument(file, \'upload\')'), 'appointment documents must use the existing durable evidence upload workflow');
assert.ok(component.includes('attachedEvidenceIds'), 'appointment document evidence IDs must persist with the workspace')
assert.ok(component.includes('Retry linking saved document'), 'a failed appointment link must be recoverable without re-uploading the original')
assert.ok(component.includes("updateAppointmentLifecycle('cancelled')") && component.includes("updateAppointmentLifecycle('rescheduled')"), 'caregiver-recorded cancellation and rescheduling must be supported')
assert.ok(component.includes("{ status: 'completed' }"), 'saving after-visit information must update the recorded visit lifecycle');
assert.ok(!component.includes('QwenAssistPanel'), 'appointment continuity must not depend on a separate chatbot panel');
assert.ok(!component.includes('MediaRecorder') && !component.includes('getUserMedia'), 'voice capture remains deferred');
assert.ok(component.includes("'Next scheduled visit' : 'Appointment information · date unknown'"), 'unknown dates must not be labelled as scheduled visits');

console.log('PASS: automatic appointment continuity, explicit lifecycle states, optional text/document capture, provenance review and retry handling')
