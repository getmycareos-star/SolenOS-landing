import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync('src/components/workflows/AppointmentWorkspace.tsx', 'utf8')

// Preparation is generated from the existing care record; no appointment form is required.
assert.ok(component.includes('Your visit summary'))
assert.ok(component.includes("getJSON('/appointment-workspaces/preparation-brief?window_days=90')"))

// Appointment preparation must fail closed when the shared LCR retrieval is partial or missing.
assert.ok(component.includes('living_care_record_context'), 'appointment preparation must consume shared Care Record coverage');
assert.ok(component.includes('retrieval_projection_complete !== true'), 'appointment preparation must disclose incomplete Care Record projection');
assert.ok(component.includes('schema_status !== "complete"'), 'appointment preparation must disclose partial Care Record schema coverage');
assert.ok(component.includes('brief.living_care_record_context == null'), 'missing coverage metadata must not be interpreted as a complete record');
assert.ok(component.includes('missing_required_sources?.length'), 'required source failures must be disclosed');
assert.ok(component.includes('Some parts of your Care Record could not be fully checked'), 'partial coverage must be explained in caregiver language');
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
assert.ok(component.includes('Changes since the previous recorded visit'), 'changes should be anchored to the previous visit when its date is known')
assert.ok(component.includes('There is no earlier appointment date to compare these updates with. We are showing the most recent saved care information instead.'), 'the brief must disclose its bounded recent-history fallback')
assert.ok(component.includes('item.recorded_by_role === \'caregiver\' ? \'Shared by a caregiver\''), 'care-event summaries must retain reporter attribution')
assert.ok(component.includes('item.evidence_ids?.length ? \'Related note or document available\''), 'care-event summaries must show whether source evidence is linked')
assert.ok(component.includes('brief.open_loops?.length'))
assert.ok(component.includes('appointment_needs?: Array<'))
assert.ok(component.includes('Appointment details to check'))
assert.ok(component.includes('brief.appointment_needs?.length'))
assert.ok(component.includes('brief.documents?.length'))

// Switching caregiver/person cannot leave the previous visit visible during a new load.
assert.ok(component.includes('setBrief(null)'))
assert.ok(component.includes('setRecord(null)'))
assert.ok(component.includes('setOutcomeProposals([])'))
// A workspace must remain attached to the selected appointment; unlinked notes are not reused.
assert.match(component, /items\s*\.filter\(item => item\.appointment_id === appointmentId\)/, 'the latest workspace must be selected only from records linked to the chosen appointment');
assert.match(component, /latestWorkspaceForAppointment\(items, selectedAppointmentId\)/, 'the selected appointment must resolve to its newest persisted workspace revision');
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
assert.ok(component.includes('Each item is connected to the appointment information it came from.'))

// Failures remain visible and the caregiver can retry without losing saved notes.
assert.ok(component.includes('Your appointment note is still saved, but we couldn’t load its details. Try refreshing.'))
assert.ok(component.includes('Some saved appointment details could not be refreshed. Your saved information has not been changed. Try again.'))
assert.ok(component.includes('setReloadToken(value => value + 1)'))
assert.ok(component.includes('Try again'))
assert.ok(component.includes("getJSON('/appointment-workspaces/' + encodeURIComponent(recordId) + '/outcome-proposals')"), 'manual refresh must reload saved review proposals as well as the outcome draft')
assert.ok(component.includes('Saved appointment information could not be fully refreshed. Your saved notes have not been changed. Try again.'), 'refresh failures must be visible without implying saved notes were lost')

// The actual routed appointment page opens directly onto the prepared brief.
assert.ok(component.includes('const [open, setOpen] = useState(true)'), 'the caregiver must not need an extra click to see appointment continuity');
assert.ok(component.includes("recorded.find(item => ['completed', 'resolved', 'historical']"), 'the most recent completed appointment must remain available for after-visit continuity');
assert.ok(component.includes('if (!appointmentId) return null'), 'an appointment workspace must not be selected when no appointment is selected')
assert.ok(component.includes("latest?.status === 'outcome_pending'") && component.includes("latest?.payload?.captureStage === 'after'"), 'the after-visit stage must be restored from the linked workspace without inferring attendance')
assert.ok(component.includes('latest?.status === \'outcome_pending\'') && component.includes('latest?.payload?.captureStage === \'after\''), 'after-visit recovery must preserve the explicit workspace state');
assert.ok(component.includes('We couldn’t find an existing appointment to add this note to. No new appointment was created.'), 'notes must not create a disconnected appointment workspace');
assert.ok(component.includes("brief.appointment_context_status?.code === 'date_unknown'"), 'unknown appointment dates must be explicit');
assert.ok(component.includes("brief.appointment_context_status?.code === 'cancelled'"), 'cancelled appointments must not appear as active bookings');
assert.ok(component.includes("brief.appointment_context_status?.code === 'rescheduled'"), 'rescheduled appointments must be distinguishable');
assert.ok(component.includes("brief.appointment_context_status?.code === 'occurred'"), 'occurred appointments must be distinguishable');
assert.ok(component.includes("brief.appointment_context_status?.code === 'overdue'"), 'past appointment dates must not be treated as proof of attendance');
assert.ok(component.includes('appointment_recorded_events'), 'caregiver-recorded visits and clinic discussions must be recognised from existing care history');
assert.ok(component.includes("brief.appointment_context_status?.code === 'visit_recorded'"), 'recorded visit events must not be represented as external bookings');
assert.ok(component.includes("updateAppointmentLifecycle('completed')"), 'caregiver confirmation must be required before an overdue appointment is marked as occurred');
assert.ok(component.includes("brief.lcr_retrieval_status?.status === 'failed'"), 'technical retrieval failures must not appear as empty history');
assert.ok(component.includes("brief?.source_coverage?.documents === 'failed'"), 'document retrieval failures must not be shown as an empty document list');
assert.ok(component.includes('We couldn’t load all of your Care Record.') && component.includes('Try again'), 'failed and partial care-record retrieval must have a caregiver-friendly retry action');
assert.ok(component.includes('We couldn’t load your saved documents. They may still be there.') && component.includes('Try again'), 'document retrieval failures must have a caregiver-friendly retry action');
assert.ok(component.includes('professionalStatement') && component.includes('recordedDecisions') && component.includes('recordedInstructions') && component.includes('unansweredQuestions'), 'optional after-visit capture must preserve separate professional statements, decisions, instructions and unanswered questions');
assert.ok(component.includes('followUps: appointmentFollowUpsFromText(followUps, record?.payload, record?.id || appointmentId)'), 'explicit follow-ups must sync into existing Open Loop records while preserving their identities and metadata');
assert.ok(component.includes("const appointmentFollowUpText = (payload?: Record<string, unknown>)"), 'saved follow-ups must be restored after refresh');
assert.ok(component.includes("owner_role: typeof prior?.owner_role === 'string' ? prior.owner_role : 'unassigned'"), 'follow-up owners must preserve a previously recorded owner and otherwise remain unassigned');
assert.ok(component.includes('Unassigned work stays unassigned.'), 'SolenOS must not silently assign follow-up responsibility to the caregiver');
assert.ok(component.includes('extractAttachedDocument(file, \'upload\')'), 'appointment documents must use the existing durable evidence upload workflow');
assert.ok(component.includes('attachedEvidenceIds'), 'appointment document evidence IDs must persist with the workspace')
assert.ok(component.includes('Try adding the saved document again'), 'a failed appointment link must be recoverable without re-uploading the original')
assert.ok(component.includes('Add to this appointment'), 'existing care documents must be attachable without re-uploading')
assert.ok(component.includes("brief?.source_coverage?.documents === 'restricted'"), 'document attachment must respect caregiver document permissions')
assert.ok(component.includes('Documents for this appointment'), 'documents linked to the selected visit must be distinguished from other care documents')
assert.ok(component.includes("updateAppointmentLifecycle('cancelled')") && component.includes("updateAppointmentLifecycle('rescheduled')"), 'caregiver-recorded cancellation and rescheduling must be supported')
const saveNoteStart = component.indexOf('const saveNote = async () =>');
const saveNoteEnd = component.indexOf('const selectedAppointmentEvidenceIds', saveNoteStart);
const saveNoteSource = component.slice(saveNoteStart, saveNoteEnd);
assert.ok(saveNoteStart >= 0 && saveNoteEnd > saveNoteStart, 'appointment save handler must remain identifiable');
assert.ok(!saveNoteSource.includes("/lifecycle', { status: 'completed'"), 'saving notes must not automatically mark an appointment as completed');
assert.ok(component.includes('Confirm the visit occurred'), 'attendance confirmation must be an explicit caregiver action');
assert.ok(component.includes('existingPayload?: Record<string, unknown>'), 'follow-up serialization must receive the previous persisted payload');
assert.ok(component.includes("appointment-follow-up:' + identity + ':' + (index + 1)"), 'new follow-ups need stable workspace-scoped IDs');
assert.ok(component.includes("status: typeof prior?.status === 'string' ? prior.status : 'not_recorded'"), 'editing follow-up wording must preserve its saved status');
assert.ok(component.includes("owner_role: typeof prior?.owner_role === 'string' ? prior.owner_role : 'unassigned'"), 'editing follow-up wording must preserve its recorded owner and never default responsibility to the caregiver');
assert.ok(component.includes('selectedAppointmentStatus'), 'workspace generation must use the selected appointment lifecycle');
assert.ok(component.includes('generated.workspace?.appointment_id === selectedAppointmentId'), 'auto-prepared workspace must belong to the selected appointment');
assert.ok(!component.includes('QwenAssistPanel'), 'appointment continuity must not depend on a separate chatbot panel');
assert.ok(!component.includes('MediaRecorder') && !component.includes('getUserMedia'), 'voice capture remains deferred');
assert.ok(component.includes("brief.next_appointment.scheduled_at ? 'Next appointment recorded' : 'Appointment · date not recorded'"), 'unknown dates must not be labelled as scheduled visits');
assert.ok(component.includes('It does not book appointments or confirm them with a provider.'), 'recorded appointments must not be represented as external bookings');

console.log('PASS: automatic appointment continuity, explicit lifecycle states, optional text/document capture, provenance review and retry handling')
