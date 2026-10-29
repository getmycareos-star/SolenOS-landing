import assert from 'node:assert/strict'
import { isEmergencyCompanionResponse } from '../src/lib/companion-safety'

const cases = [
  {
    name: 'explicit emergency safety note',
    response: { safety_note: 'Possible emergency language detected; urgent human assessment is needed.' },
    expected: true,
  },
  {
    name: 'explicit emergency reply',
    response: { reply: 'This may be an emergency. Contact local emergency services now.' },
    expected: true,
  },
  {
    name: 'unsupported trend is not an emergency',
    response: {
      guard_verdict: 'blocked',
      safety_note: 'A trend claim was withheld because the retrieved record lacks two distinct dated observations.',
      reply: 'The available record is not enough to establish a trend.',
    },
    expected: false,
  },
  {
    name: 'missing measurement is not an emergency',
    response: {
      guard_verdict: 'blocked',
      safety_note: 'A requested measurement was not found in the retrieved authorized record; no value was inferred.',
      reply: 'No blood pressure reading is recorded for that date.',
    },
    expected: false,
  },
  {
    name: 'medication boundary is not an emergency',
    response: {
      guard_verdict: 'blocked',
      safety_note: 'A medication dose-change request was withheld for qualified professional confirmation.',
      reply: 'I cannot recommend changing the dose.',
    },
    expected: false,
  },
  {
    name: 'generic immediate wording is not an emergency classification',
    response: {
      safety_note: 'Immediate follow-up may be useful.',
      reply: 'Please review this with the care team.',
    },
    expected: false,
  },
  {
    name: 'empty response is not an emergency',
    response: {},
    expected: false,
  },
]

for (const testCase of cases) {
  assert.equal(
    isEmergencyCompanionResponse(testCase.response),
    testCase.expected,
    testCase.name,
  )
}

console.log(`PASS: ${cases.length} Companion emergency-signal cases`)
