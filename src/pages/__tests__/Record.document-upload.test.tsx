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
      ok: true,
      document: {
        id: 'doc_123',
        name: 'discharge.pdf',
        mime_type: 'application/pdf',
        extracted_text: 'Discharge instructions say follow up within two weeks.',
        extracted_char_count: 53,
        extraction_source: 'pdf_ocr',
        ocr_confidence: 0.42,
        extraction_warnings: ['OCR confidence is low. Check the extracted text against the original before relying on it.'],
        sha256: 'a'.repeat(64),
      },
    } as never)
    mockedPostJSON.mockResolvedValue({
      qwen_extraction_status: 'pending_review',
      qwen_candidates: { observations: [] },
    } as never)
  })

  afterEach(() => cleanup())

  it('sends a PDF through the authenticated extractor and preserves OCR provenance as evidence', async () => {
    render(<MemoryRouter><Record /></MemoryRouter>)

    const file = new File(['%PDF-'], 'discharge.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByLabelText(/choose a care document/i), {
      target: { files: [file] },
    })
    fireEvent.click(screen.getByRole('button', { name: /save and review/i }))

    await waitFor(() => expect(mockedPostFormData).toHaveBeenCalledWith(
      '/documents/extract',
      expect.any(FormData),
    ))
    await waitFor(() => expect(mockedPostJSON).toHaveBeenCalledWith(
      '/situation',
      expect.objectContaining({
        person_id: 'person-real-1',
        caregiver_id: 'caregiver-real-1',
        documents: [expect.objectContaining({
          id: 'doc_123',
          sha256: 'a'.repeat(64),
          extraction_source: 'pdf_ocr',
          ocr_confidence: 0.42,
          extraction_warnings: expect.arrayContaining([expect.stringContaining('OCR confidence is low')]),
        })],
        provenance: expect.objectContaining({ transcript_uncertain: true }),
      }),
    ))

    expect(await screen.findByText(/Extraction method: pdf_ocr/i)).toBeInTheDocument()
    expect(screen.getByText(/OCR confidence: 42%/i)).toBeInTheDocument()
    expect(screen.getByText(/Review needed: OCR confidence is low/i)).toBeInTheDocument()
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

  it('does not save care evidence if extraction returns no readable text', async () => {
    mockedPostFormData.mockResolvedValueOnce({ ok: true, document: { extracted_text: '  ' } } as never)
    render(<MemoryRouter><Record /></MemoryRouter>)

    fireEvent.change(screen.getByLabelText(/choose a care document/i), {
      target: { files: [new File(['x'], 'scan.png', { type: 'image/png' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: /save and review/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/did not return readable text/i)
    expect(mockedPostJSON).not.toHaveBeenCalled()
  })
})
