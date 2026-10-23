import { describe, expect, it } from '@jest/globals'

import { buildAppointmentBrief } from './appointment-brief'

describe('buildAppointmentBrief', () => {
  it('keeps documents and caregiver observations in separate source categories', () => {
    const brief = buildAppointmentBrief([
      {
        id: 'doc-1',
        type: 'document',
        source_type: 'document',
        source_text: 'Prescription lists medication; follow-up in two weeks.',
        uploaded_at: '2026-10-20T10:00:00.000Z',
        extra_metadata: {
          extraction_source: 'image_ocr',
          ocr_confidence: 0.42,
          extraction_warnings: ['OCR confidence is low.'],
        },
      },
      {
        id: 'note-1',
        type: 'note',
        source_type: 'caregiver_observation',
        source_text: 'Caregiver reports sleep changed; onset date uncertain.',
        uploaded_at: '2026-10-22T10:00:00.000Z',
      },
    ])

    expect(brief).not.toBeNull()
    expect(brief?.documented_sources).toHaveLength(1)
    expect(brief?.caregiver_observations).toHaveLength(1)
    expect(brief?.system_interpretations).toEqual([])
    expect(brief?.documented_sources[0].review_warnings).toContain('OCR confidence is low.')
    expect(brief?.unknowns_to_verify.some((item) => /upload timestamp/i.test(item))).toBe(true)
    expect(brief?.questions_for_care_team.some((item) => /medication list/i.test(item))).toBe(true)
    expect(brief?.questions_for_care_team.some((item) => /follow-up/i.test(item))).toBe(true)
  })

  it('does not create a brief from an empty or unreadable evidence list', () => {
    expect(buildAppointmentBrief([])).toBeNull()
    expect(buildAppointmentBrief([{ id: 'blank', type: 'document', source_text: '  ', uploaded_at: '' }])).toBeNull()
  })

  it('preserves conflicting-document uncertainty instead of resolving it', () => {
    const brief = buildAppointmentBrief([
      { id: 'doc-1', type: 'document', source_text: 'Instruction A', uploaded_at: '2026-10-20T10:00:00Z' },
      { id: 'doc-2', type: 'document', source_text: 'Instruction B', uploaded_at: '2026-10-22T10:00:00Z' },
    ])
    expect(brief?.unknowns_to_verify.some((item) => /not established whether newer documents supersede/i.test(item))).toBe(true)
    expect(brief?.documented_sources).toHaveLength(2)
  })
})
