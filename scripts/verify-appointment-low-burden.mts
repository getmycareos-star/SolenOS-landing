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
