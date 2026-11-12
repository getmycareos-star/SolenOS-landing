import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const component = readFileSync('src/components/workflows/AppointmentWorkspace.tsx', 'utf8')
assert.ok(component.includes('Your appointment brief'), 'before stage must show the generated appointment brief')
assert.ok(component.includes('You do not need to document while speaking with the professional.'), 'during stage must not require active documentation')
assert.ok(component.includes('You can leave this empty and return later.'), 'during capture must be optional')
assert.ok(component.includes("getJSON('/appointment-workspaces/' + encodeURIComponent(recordId) + '/outcome-draft')"), 'after stage must retrieve the persisted backend outcome draft')
assert.ok(component.includes("postJSON('/appointment-workspaces/' + encodeURIComponent(record.id) + '/outcome-proposals', {})"), 'after stage must request persisted backend outcome proposals')
assert.ok(component.includes('No appointment outcome has been recorded yet.'), 'empty outcome must be honest')
assert.ok(component.includes('nothing here silently changes the Living Care Record.'), 'draft generation must not silently update the LCR')
assert.ok(component.toLowerCase().includes('caregiver reports stay attributed to the caregiver'), 'caregiver notes must preserve attribution')
assert.ok(component.includes('Nothing to fill in.'), 'preparation must not be another required caregiver form')
assert.ok(component.includes('Open detailed appointment and follow-up controls (optional)'), 'existing follow-up controls must remain available without blocking the guided path')
console.log('PASS: low-burden appointment stages, optional capture, backend outcome retrieval and LCR write boundary')
