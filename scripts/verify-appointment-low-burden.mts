import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync('src/components/workflows/AppointmentWorkspace.tsx', 'utf8')

// Preparation is generated from the existing care record; no appointment form is required.
assert.ok(component.includes('Your visit summary'))
assert.ok(component.includes("getJSON('/appointment-workspaces/preparation-brief?window_days=90')"))
assert.ok(component.includes('selectNextAppointment'))
assert.ok(component.includes('You do not have to fill in forms before, during or after a visit.'))
assert.ok(component.includes('You do not need to rewrite information already in your Care Record'))
assert.ok(component.includes('brief.prior_decisions?.length'))
assert.ok(component.includes('brief.decision_outcomes?.length'))
assert.ok(component.includes('brief.open_loops?.length'))
assert.ok(component.includes('brief.documents?.length'))

// Workspace selection is tied to the selected appointment; unrelated notes are not reused.
assert.ok(component.includes('items.find(item => item.appointment_id === selectedAppointmentId)'))
assert.ok(component.includes('items.find(item => !item.appointment_id)'))
assert.ok(component.includes('setRecord(null)'))

// Follow-ups retain their appointment/workspace lineage in the caregiver view.
assert.ok(component.includes('appointment_id?: string | null'))
assert.ok(component.includes('source_workspace_id?: string | null'))
assert.ok(component.includes('Linked to this care record\'s appointment'))

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

console.log('PASS: low-burden appointment preparation, optional capture, linked follow-ups, review boundaries and retry handling')
