import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { MemoryRouter } from 'react-router-dom'
import Record from '../Record'
import { getJSON, getCaregiverId, getPersonId, postFormData, postJSON } from '../../api/client'

jest.mock('../../api/client', () => ({
  getJSON: jest.fn(),
  postJSON: jest.fn(),
  postFormData: jest.fn(),
  getPersonId: jest.fn(),
  getCaregiverId: jest.fn(),
}))

const mockedGetJSON = jest.mocked(getJSON)
const mockedPostJSON = jest.mocked(postJSON)
const mockedPostFormData = jest.mocked(postFormData)
const mockedGetPersonId = jest.mocked(getPersonId)
const mockedGetCaregiverId = jest.mocked(getCaregiverId)

describe('Living Care Record document intake', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockedGetJSON.mockResolvedValue([] as never)
    mockedGetPersonId.mockReturnValue('person-real-1')
    mockedGetCaregiverId.mockReturnValue('caregiver-real-1')
    mockedPostFormData.mockResolvedValue({
      evidence_id: 'evidence-doc-123',
      care_event_id: 'event-doc-123',
      filename: 'discharge.pdf',
      content_type: 'application/pdf',
      size_bytes: 2048,
      sha256: 'a'.repeat(64),
      document_type_candidate: 'discharge_instructions',
      document_date_candidate: '2026-10-20',
      document_date_review_status: 'pending_review',
      extraction_status: 'extracted',
      extraction_source: 'pdf_ocr',
      extraction_version: 'document-intake-v1',
      ocr_confidence: 0.42,
      extraction_warnings: ['OCR confidence is low. Check the extracted text against the original before relying on it.'],
      extraction_error: null,
      extracted_char_count: 53,
      source_file_preserved: true,
      review_required: true,
      document_candidates: [{
        candidate_id: 'evidence-doc-123:0',
        candidate_type: 'follow_up',
        subject: 'Follow-up reference',
        observation: 'Discharge instructions say follow up within two weeks.',
        source_quote: 'Discharge instructions say follow up within two weeks.',
        source_evidence_id: 'evidence-doc-123',
        review_status: 'pending_review',
      }],
      candidate_count: 1,
    } as never)
    mockedPostJSON.mockResolvedValue({
      candidate: { candidate_type: 'follow_up', observation: 'Discharge instructions say follow up within two weeks.', source_quote: 'Discharge instructions say follow up within two weeks.', review_status: 'accepted_by_caregiver' },
      authoritative_lcr_write: false,
      message: 'Review decision saved. No authoritative care fact was changed.',
    } as never)
  })

  afterEach(() => cleanup())

  it('persists the original PDF and displays extracted candidates with OCR provenance', async () => {
    render(<MemoryRouter><Record /></MemoryRouter>)

    const file = new File(['%PDF-'], 'discharge.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/choose a care document/i), {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole('button', { name: /save and review/i }))

    await waitFor(() => expect(mockedPostFormData).toHaveBeenCalledWith(
      '/documents/intake',
      expect.any(FormData),
    ))
    expect(mockedPostJSON).not.toHaveBeenCalledWith('/situation', expect.anything())

    expect(await screen.findByText(/Original file preserved/i)).toBeInTheDocument()
    expect(screen.getByText(/Type candidate: discharge_instructions/i)).toBeInTheDocument()
    expect(screen.getByText(/document date candidate: 2026-10-20/i)).toBeInTheDocument()
    expect(screen.getByText(/Extraction method: pdf_ocr/i)).toBeInTheDocument()
    expect(screen.getByText(/OCR confidence: 42%/i)).toBeInTheDocument()
    expect(screen.getByText(/Review needed: OCR confidence is low/i)).toBeInTheDocument()
    expect(screen.getByText(/follow up:/i)).toBeInTheDocument()
  })

  it('persists an explicit review decision without writing a care fact', async () => {
    render(<MemoryRouter><Record /></MemoryRouter>)
    fireEvent.change(screen.getByLabelText(/choose a care document/i), {
      target: { files: [new File(['%PDF-'], 'discharge.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /save and review/i }))
    await screen.findByText(/Original file preserved/i)
    fireEvent.click(screen.getByRole('button', { name: /mark reviewed/i }))
    await waitFor(() => expect(mockedPostJSON).toHaveBeenCalledWith(
      '/documents/evidence-doc-123/candidates/0/review',
      { decision: 'accept' },
    ))
    expect(await screen.findByText(/Review decision saved/i)).toBeInTheDocument()
  })

  it('builds an appointment brief with separate sources and unresolved uncertainties', async () => {
    mockedGetJSON.mockResolvedValueOnce([
      {
        id: 'evidence-doc-1',
        type: 'document',
        source_text: 'Prescription document lists medication and follow-up.',
        uploaded_at: '2026-10-20T10:00:00.000Z',
        source_type: 'document',
        extra_metadata: {
          extraction_source: 'pdf_ocr',
          ocr_confidence: 0.42,
          extraction_warnings: ['OCR confidence is low.'],
        },
      },
      {
        id: 'evidence-doc-2',
        type: 'document',
        source_text: 'Earlier discharge document lists a follow-up plan.',
        uploaded_at: '2026-10-21T10:00:00.000Z',
        source_type: 'document',
        extra_metadata: { extraction_source: 'pdf_text' },
      },
      {
        id: 'evidence-note-1',
        type: 'note',
        source_text: 'Caregiver reports a change; onset is uncertain.',
        uploaded_at: '2026-10-22T10:00:00.000Z',
        source_type: 'caregiver_observation',
      },
    ] as never)

    render(<MemoryRouter><Record /></MemoryRouter>)
    fireEvent.click(await screen.findByRole('button', { name: /prepare appointment brief/i }))

    expect(await screen.findByRole('heading', { name: /documented source text/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /caregiver observations/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /system interpretations/i })).toBeInTheDocument()
    expect(screen.getByText(/the system has not established whether newer documents supersede earlier instructions/i)).toBeInTheDocument()
    expect(screen.getByText(/questions for the care team/i)).toBeInTheDocument()
    expect(screen.getByText(/does not diagnose or authorize treatment/i)).toBeInTheDocument()
  })

  it('shows stored document origin and extraction warnings after record reload', async () => {
    mockedGetJSON.mockResolvedValueOnce([{
      id: 'evidence-doc-1',
      type: 'document',
      source_text: 'Discharge instructions say follow up within two weeks.',
      uploaded_at: '2026-10-23T12:00:00.000Z',
      source_type: 'document',
      confidence: 0.42,
      extra_metadata: {
        extraction_source: 'image_ocr',
        ocr_confidence: 0.42,
        extracted_char_count: 53,
        extraction_warnings: ['OCR confidence is low; compare with the original.'],
      },
    }] as never)

    render(<MemoryRouter><Record /></MemoryRouter>)

    expect(await screen.findByText(/Evidence origin: document/i)).toBeInTheDocument()
    expect(screen.getByText(/Document extraction: image_ocr/i)).toBeInTheDocument()
    expect(screen.getByText(/Document review needed: OCR confidence is low/i)).toBeInTheDocument()
  })

  it('restores reviewable candidates and original-file download from persisted evidence after reload', async () => {
    mockedGetJSON.mockResolvedValueOnce([{
      id: 'evidence-doc-reloaded',
      type: 'document',
      source_text: 'Discharge instructions say follow up within two weeks.',
      uploaded_at: '2026-10-23T12:00:00.000Z',
      source_type: 'document_upload',
      extra_metadata: {
        original_filename: 'discharge.pdf',
        document_type_candidate: 'discharge_instructions',
        document_date_candidate: '2026-10-20',
        document_date_review_status: 'pending_review',
        document_candidates: [{
          candidate_id: 'evidence-doc-reloaded:0',
          candidate_type: 'follow_up',
          observation: 'Follow up within two weeks.',
          source_quote: 'Discharge instructions say follow up within two weeks.',
          review_status: 'pending_review',
        }],
      },
    }] as never)

    render(<MemoryRouter><Record /></MemoryRouter>)

    expect(await screen.findByText(/Document type candidate: discharge_instructions/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /download original document/i })).toBeInTheDocument()
    expect(screen.getByText(/Source quote: “Discharge instructions say follow up within two weeks.” · pending_review/i)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /mark reviewed/i }))
    await waitFor(() => expect(mockedPostJSON).toHaveBeenCalledWith(
      '/documents/evidence-doc-reloaded/candidates/0/review',
      { decision: 'accept' },
    ))
    expect(await screen.findByText(/accepted_by_caregiver/i)).toBeInTheDocument()
  })

  it('keeps an unreadable scanned file while clearly showing extraction failure and no candidates', async () => {
    mockedPostFormData.mockResolvedValueOnce({
      evidence_id: 'evidence-scan-1',
      filename: 'scan.png',
      document_type_candidate: 'image_document',
      document_date_candidate: null,
      extraction_status: 'pending_ocr',
      extraction_source: 'failed',
      ocr_confidence: null,
      extraction_warnings: ['OCR is unavailable'],
      extraction_error: 'OCR is unavailable on this service.',
      document_candidates: [],
      source_file_preserved: true,
      candidate_count: 0,
    } as never)
    render(<MemoryRouter><Record /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText(/choose a care document/i), {
      target: { files: [new File(['image bytes'], 'scan.png', { type: 'image/png' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /save and review/i }))

    expect(await screen.findByText(/Text extraction not completed: OCR is unavailable on this service/i)).toBeInTheDocument()
    expect(screen.getByText(/No reviewable text candidates were found/i)).toBeInTheDocument()
  })
})
