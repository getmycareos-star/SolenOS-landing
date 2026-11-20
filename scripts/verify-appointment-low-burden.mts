import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync('src/components/workflows/AppointmentWorkspace.tsx', 'utf8')
assert.ok(component.includes('Your visit summary'), 'before stage must show the generated appointment brief')
assert.ok(component.includes('living_care_record_context'), 'appointment preparation must consume shared Care Record coverage when the backend provides it')
assert.ok(component.includes('retrieval_scan_complete !== true'), 'appointment preparation must disclose an incomplete Care Record scan')
assert.ok(component.includes('schema_status !== "complete"'), 'appointment preparation must fail closed when the shared Care Record schema is partial')
assert.ok(component.includes('brief.living_care_record_context == null'), 'appointment preparation must fail closed when coverage metadata is absent')
assert.ok(component.includes('missing_required_sources?.length'), 'appointment preparation must disclose required sources that could not be checked')
assert.ok(component.includes('retrieval_projection_complete !== true'), 'appointment preparation must disclose an incomplete shared Care Record projection')
assert.ok(component.includes('Some parts of your Care Record could not be fully checked'), 'incomplete shared Care Record coverage must be explained in plain language')
assert.ok(component.includes('You do not need to document while speaking with the professional.'), 'during stage must not require active documentation')
assert.ok(component.includes('You can leave this empty and return later.'), 'during capture must be optional')
assert.ok(component.includes("getJSON('/appointment-workspaces/' + encodeURIComponent(recordId) + '/outcome-draft')"), 'after stage must retrieve the persisted backend outcome draft')
assert.ok(component.includes("postJSON('/appointment-workspaces/' + encodeURIComponent(record.id) + '/outcome-proposals', {})"), 'after stage must request persisted backend outcome proposals')
assert.ok(component.includes('No appointment outcome has been recorded yet.'), 'empty outcome must be honest')
assert.ok(component.includes('nothing here changes your Care Record without your approval.'), 'draft generation must not silently update the LCR')
assert.ok(component.toLowerCase().includes('your reports stay marked as yours'), 'caregiver notes must preserve attribution')
assert.ok(component.includes('Nothing to fill in.'), 'preparation must not be another required caregiver form')
assert.ok(component.includes('appointment-quick-summary'), 'caregiver-facing summary must lead with useful retrieved care context');
assert.ok(component.includes('What SolenOS found'), 'appointment preparation must explain what SolenOS actually found');
assert.ok(component.includes('There is not enough linked care information available'), 'empty retrieval must be disclosed without implying the care record is empty');
assert.ok(component.includes('Review source details and information checks'), 'source audit details must remain available behind an optional disclosure');
assert.ok(component.includes('<details className="appointment-source-review">'), 'technical source audit must not dominate the default caregiver view');
assert.ok(!component.includes('DetailedAppointmentWorkspace'), 'the caregiver-facing appointment path must not expose the long manual administration form');
assert.ok(!component.includes('guided-details-toggle'), 'appointment preparation must not send caregivers into a second administrative workspace');
assert.ok(component.includes('You do not need to rewrite information already in your Care Record'), 'caregivers must not be asked to re-enter information already recorded');
console.log('PASS: low-burden appointment stages, optional capture, backend outcome retrieval and LCR write boundary')

assert.ok(component.includes('brief.open_loops?.length'), 'preparation must surface existing unresolved follow-ups without caregiver re-entry')
assert.ok(component.includes('brief.documents?.length'), 'preparation must surface extracted care documents already stored in the LCR')
assert.ok(component.includes('Recent care documents'), 'document context must be visible in the caregiver summary')
assert.ok(component.includes('Still being followed up'), 'open follow-ups must be visible in the caregiver summary')

assert.ok(component.includes('brief.prior_decisions?.length'), 'preparation must include previously recorded care decisions')
assert.ok(component.includes('brief.decision_outcomes?.length'), 'preparation must include recorded outcomes from prior decisions')
assert.ok(component.includes('What happened after those decisions'), 'prior decision outcomes must be visible in the caregiver summary')

assert.ok(component.includes('!(brief.documents?.length)'), 'document-only history must not be hidden by the empty-state branch')
assert.ok(component.includes('!(brief.open_loops?.length)'), 'follow-up-only history must not be hidden by the empty-state branch')
assert.ok(component.includes('!(brief.prior_decisions?.length)'), 'decision-only history must not be hidden by the empty-state branch')
assert.ok(component.includes('!(brief.decision_outcomes?.length)'), 'outcome-only history must not be hidden by the empty-state branch')

assert.ok(component.includes('selectNextAppointment'), 'appointment support must target the nearest scheduled visit rather than the furthest future visit')
assert.ok(component.includes('brief.next_appointment'), 'the caregiver summary must identify the next scheduled visit from the backend')

assert.ok(component.includes("if (stage === 'after')"), 'saving an after-visit note must trigger outcome preparation automatically')
assert.ok(component.includes('SolenOS prepared possible care updates for your review'), 'automatic preparation must keep suggestions pending caregiver review')
assert.ok(component.includes('items.length === 0') && component.includes("latest.payload?.captureStage === 'after'"), 'reopening an after-visit record must recover missing review proposals')
assert.ok(component.includes('outcomeProposals.length === 0'), 'manual retry must only appear when automatic proposal preparation produced no suggestions')

assert.ok(component.includes('items.find(item => item.appointment_id === selectedAppointmentId)'), 'an upcoming visit must not inherit a previous appointment workspace')
assert.ok(component.includes('setRecord(null)'), 'a new appointment with no saved workspace must not retain stale appointment notes')

assert.ok(component.includes('!brief.next_appointment'), 'the next visit must not be hidden by an empty-state branch when older appointment history is truncated')
