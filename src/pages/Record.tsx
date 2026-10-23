import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON, getBlob, getPersonId, getCaregiverId, postJSON, postFormData } from '../api/client'
import { buildAppointmentBrief } from '../lib/document-intelligence/appointment-brief'

interface Evidence {
  id: string
  type: string
  source_text: string
  uploaded_at: string
  time_provenance?: string
  location?: string
  source_type?: string | null
  confidence?: number | null
  extra_metadata?: {
    mime_type?: string
    extraction_source?: string
    extraction_warnings?: string[]
    sha256?: string
    extracted_char_count?: number
    ocr_confidence?: number | null
    metadata_unreadable?: boolean
  } | null
}

export default function Record() {
  const [items, setItems] = useState<Evidence[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [lcrExplanation, setLcrExplanation] = useState<string | null>(null)
  const [lcrProviderStatus, setLcrProviderStatus] = useState<string | null>(null)
  const [lcrError, setLcrError] = useState<string | null>(null)
  const [explainingLcr, setExplainingLcr] = useState(false)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [processingDocument, setProcessingDocument] = useState(false)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [documentReviewMessage, setDocumentReviewMessage] = useState<string | null>(null)
  const [documentResult, setDocumentResult] = useState<{ status: string; candidates: any[]; extractionSource?: string; confidence?: number | null; warnings?: string[]; evidenceId?: string; filename?: string; documentType?: string; documentDate?: string | null; extractionError?: string | null } | null>(null)
  const [showAppointmentBrief, setShowAppointmentBrief] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const personId = getPersonId()
      if (!personId) {
        setLoadError('No care record is selected. Select an authorized care record to continue.')
        setLoading(false)
        return
      }
      try {
        const data = await getJSON(`/evidence/${encodeURIComponent(personId)}`)
        if (!Array.isArray(data)) throw new Error('The server response was incomplete.')
        if (!cancelled) setItems(data)
      } catch {
        if (!cancelled) {
          setItems([])
          setLoadError('This information could not be loaded. Try again when the service is available.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  async function submitDocument() {
    const personId = getPersonId()
    const caregiverId = getCaregiverId()
    if (!personId || !caregiverId) {
      setDocumentError('A valid authorized care session is required before processing a document.')
      return
    }
    if (!documentFile) {
      setDocumentError('Choose a supported document first.')
      return
    }
    if (documentFile.size > 10 * 1024 * 1024) {
      setDocumentError('Documents must be 10 MiB or smaller.')
      return
    }
    const allowedExtensions = /\.(pdf|png|jpe?g|webp|tiff?|bmp|txt|md|csv|json|log)$/i
    if (!allowedExtensions.test(documentFile.name)) {
      setDocumentError('Supported formats are PDF, JPG, PNG, WEBP, TIFF, BMP, TXT, MD, CSV, JSON, and LOG.')
      return
    }
    setProcessingDocument(true)
    setDocumentError(null)
    setDocumentResult(null)
    setDocumentReviewMessage(null)
    try {
      // One authenticated endpoint extracts text, stores the original bytes,
      // creates source evidence, and returns exact-source candidates for review.
      const form = new FormData()
      form.append('file', documentFile)
      const result = await postFormData('/documents/intake', form) as {
        evidence_id: string
        filename: string
        document_type_candidate: string
        document_date_candidate: string | null
        extraction_status: string
        extraction_source: string
        ocr_confidence: number | null
        extraction_warnings: string[]
        extraction_error: string | null
        document_candidates: any[]
        source_file_preserved: boolean
        candidate_count: number
      }
      if (!result.evidence_id || result.source_file_preserved !== true) {
        throw new Error('The server did not confirm source-file preservation. The document intake is not confirmed.')
      }
      setDocumentResult({
        status: result.extraction_status,
        evidenceId: result.evidence_id,
        filename: result.filename,
        documentType: result.document_type_candidate,
        documentDate: result.document_date_candidate,
        extractionSource: result.extraction_source,
        confidence: result.ocr_confidence,
        warnings: result.extraction_warnings ?? [],
        extractionError: result.extraction_error,
        candidates: result.document_candidates ?? [],
      })
      setDocumentFile(null)
      // Refresh the evidence list from persisted server data, not optimistic state.
      try {
        const refreshed = await getJSON(`/evidence/${encodeURIComponent(personId)}`)
        if (Array.isArray(refreshed)) setItems(refreshed)
      } catch {
        // The upload was already confirmed and persisted. Keep that success visible;
        // the list can be refreshed on the next page load.
      }
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Document processing could not be confirmed.')
    } finally {
      setProcessingDocument(false)
    }
  }

  async function downloadOriginalDocument() {
    const evidenceId = documentResult?.evidenceId
    if (!evidenceId) return
    try {
      const blob = await getBlob(`/documents/${encodeURIComponent(evidenceId)}/file`)
      const objectUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = objectUrl
      link.download = documentResult.filename || 'care-document'
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'The original document could not be downloaded.')
    }
  }

  async function reviewDocumentCandidate(candidateIndex: number, decision: 'accept' | 'reject') {
    const evidenceId = documentResult?.evidenceId
    if (!evidenceId) return
    setDocumentReviewMessage(null)
    try {
      const result = await postJSON(
        `/documents/${encodeURIComponent(evidenceId)}/candidates/${candidateIndex}/review`,
        { decision },
      ) as { candidate?: any; message?: string; authoritative_lcr_write?: boolean }
      if (!result.candidate || result.authoritative_lcr_write !== false) {
        throw new Error('The review response did not confirm a review-only decision.')
      }
      setDocumentResult((current) => {
        if (!current) return current
        const candidates = [...(current.candidates || [])]
        candidates[candidateIndex] = result.candidate
        return { ...current, candidates }
      })
      setDocumentReviewMessage(result.message || 'Review decision saved. No authoritative care fact was changed.')
    } catch (error) {
      setDocumentReviewMessage(error instanceof Error ? error.message : 'The review decision could not be saved.')
    }
  }

    async function explainRecord() {
    const personId = getPersonId()
    if (!personId) {
      setLcrError('No authorized care record is selected.')
      return
    }
    setExplainingLcr(true)
    setLcrError(null)
    setLcrExplanation(null)
    setLcrProviderStatus(null)
    try {
      const result = await postJSON('/lcr/explain', {
        person_id: personId,
        question: 'Explain the currently recorded care situation. Separate recorded facts from uncertainty and missing information, identify any supported changes, and suggest useful questions to clarify. Do not diagnose or invent facts.',
      }) as { explanation?: string; provider_status?: string; ai_generated?: boolean; evidence_ids?: string[] }
      if (typeof result.explanation !== 'string' || !result.explanation.trim()) {
        throw new Error('The Qwen explanation response was incomplete.')
      }
      setLcrExplanation(result.explanation)
      setLcrProviderStatus(result.provider_status || 'unknown')
    } catch {
      setLcrError('Qwen could not provide a verified explanation. The existing care record has not been changed.')
    } finally {
      setExplainingLcr(false)
    }
  }

  const typeIcon: Record<string, string> = {
    document: '📄',
    note: '📝',
    conversation: '💬',
    observation: '👁️',
  }
  const appointmentBrief = showAppointmentBrief ? buildAppointmentBrief(items) : null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>Living Care Record</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, maxWidth: '500px' }}>
             Upload documents, notes, photos, messages, and care information. SolenOS remembers and connects these over time.
           </p>
         </div>
         <div>
           <Link to="/daily-care" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none', marginRight: '16px' }}>
             ← Daily notes
           </Link>
           <Link to="/structured-daily-capture" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
             ← Structured capture
           </Link>
         </div>
       </div>

      <section style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '12px 14px', marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: '13px' }}>Qwen LCR explanation</strong>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>
              Read-only explanation grounded in this authorized record. It does not change recorded facts.
            </p>
          </div>
          <button onClick={explainRecord} disabled={explainingLcr} style={{
            padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
            background: explainingLcr ? 'var(--bg)' : 'var(--accent)', color: explainingLcr ? 'var(--text-secondary)' : 'white',
            fontSize: '12px', cursor: explainingLcr ? 'default' : 'pointer'
          }}>
            {explainingLcr ? 'Asking Qwen…' : 'Explain current record'}
          </button>
        </div>
        {lcrProviderStatus && (
          <p role="status" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
            Qwen provider status: {lcrProviderStatus}
          </p>
        )}
        {lcrExplanation && <p style={{ fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: '8px' }}>{lcrExplanation}</p>}
        {lcrError && <p role="alert" style={{ fontSize: '12px', color: 'var(--error)', marginTop: '8px' }}>{lcrError}</p>}
      </section>

      <section style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '12px 14px', marginBottom: '16px'
      }}>
        <strong style={{ fontSize: '13px' }}>Add a document to the Living Care Record</strong>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '10px' }}>
          Upload a PDF, scan, photo, or text file. SolenOS extracts source text, flags uncertain OCR, and saves it as evidence for review. Extracted text is not a verified medical instruction.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            aria-label="Choose a care document"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.bmp,.txt,.md,.csv,.json,.log,application/pdf,image/*,text/plain,text/markdown,text/csv,application/json"
            disabled={processingDocument}
            onChange={(event) => {
              setDocumentFile(event.target.files?.[0] || null)
              setDocumentError(null)
              setDocumentResult(null)
            }}
          />
          <button onClick={submitDocument} disabled={processingDocument || !documentFile} style={{
            padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
            background: processingDocument || !documentFile ? 'var(--bg)' : 'var(--accent)',
            color: processingDocument || !documentFile ? 'var(--text-secondary)' : 'white',
            fontSize: '12px', cursor: processingDocument || !documentFile ? 'default' : 'pointer'
          }}>
            {processingDocument ? 'Reading document…' : 'Save and review'}
          </button>
        </div>
        {documentError && <p role="alert" style={{ fontSize: '12px', color: 'var(--error)', marginTop: '8px' }}>{documentError}</p>}
        {documentResult && (
          <div role="status" style={{ marginTop: '10px' }}>
            <strong style={{ fontSize: '12px' }}>Document intake: {documentResult.status}</strong>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Original file preserved · {documentResult.filename || 'document'} · evidence ID {documentResult.evidenceId}
            </p>
            <button type="button" onClick={() => void downloadOriginalDocument()} style={{ marginTop: '5px', padding: '6px 9px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text)', fontSize: '10px' }}>Download original document</button>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Type candidate: {documentResult.documentType || 'not detected'} · document date candidate: {documentResult.documentDate || 'not detected'}
            </p>
            {documentResult.extractionSource && (
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Extraction method: {documentResult.extractionSource}
              </p>
            )}
            {documentResult.confidence != null && (
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                OCR confidence: {Math.round(documentResult.confidence * 100)}%
              </p>
            )}
            {documentResult.extractionError && (
              <p role="alert" style={{ fontSize: '11px', color: 'var(--unknown)', marginTop: '5px' }}>
                Text extraction not completed: {documentResult.extractionError}
              </p>
            )}
            {documentResult.warnings?.map((warning, index) => (
              <p key={index} role="alert" style={{ fontSize: '12px', color: 'var(--unknown)', marginTop: '6px' }}>
                Review needed: {warning}
              </p>
            ))}
            {documentResult.candidates.length > 0 ? (
              <ul style={{ paddingLeft: '18px', marginTop: '8px' }}>
                {documentResult.candidates.map((candidate: any, index: number) => (
                  <li key={candidate.candidate_id || index} style={{ fontSize: '12px', marginBottom: '10px' }}>
                    <strong>{candidate.candidate_type?.replace(/_/g, ' ') || 'Document candidate'}:</strong> {candidate.observation}
                    <div style={{ color: 'var(--text-secondary)', marginTop: '3px' }}>
                      Exact source: “{candidate.source_quote}” · {candidate.review_status || 'pending_review'}
                    </div>
                    {candidate.review_status === 'pending_review' && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                        <button type="button" disabled={processingDocument} onClick={() => void reviewDocumentCandidate(index, 'accept')} style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text)', fontSize: '10px' }}>Mark reviewed</button>
                        <button type="button" disabled={processingDocument} onClick={() => void reviewDocumentCandidate(index, 'reject')} style={{ padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--text)', fontSize: '10px' }}>Reject candidate</button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                No reviewable text candidates were found. The original file and extraction status are preserved; no facts were inferred.
              </p>
            )}
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Review decisions are saved with provenance and do not write authoritative Living Care Record facts. Confirm all details against the original document.
            </p>
            {documentReviewMessage ? (
              <p role="status" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>{documentReviewMessage}</p>
            ) : null}
          </div>
        )}
      </section>

      <section style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '14px', marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <strong style={{ fontSize: '13px' }}>Prepare an appointment brief</strong>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Organize saved records into documented sources, caregiver observations, unknowns, and questions. No diagnosis is generated.
            </p>
          </div>
          <button
            onClick={() => setShowAppointmentBrief(true)}
            disabled={loading || Boolean(loadError) || items.length === 0}
            style={{
              padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
              background: loading || Boolean(loadError) || items.length === 0 ? 'var(--bg)' : 'var(--accent)',
              color: loading || Boolean(loadError) || items.length === 0 ? 'var(--text-secondary)' : 'white',
              fontSize: '12px', cursor: loading || Boolean(loadError) || items.length === 0 ? 'default' : 'pointer'
            }}
          >
            Prepare appointment brief
          </button>
        </div>
        {showAppointmentBrief && appointmentBrief && (
          <div style={{ marginTop: '14px' }}>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Recorded period: {appointmentBrief.recorded_period.from} to {appointmentBrief.recorded_period.to}
            </p>
            {[
              { title: 'Documented source text', items: appointmentBrief.documented_sources },
              { title: 'Caregiver observations', items: appointmentBrief.caregiver_observations },
              { title: 'Other recorded items', items: appointmentBrief.other_records },
            ].map(section => (
              <section key={section.title} style={{ marginTop: '12px' }}>
                <h3 style={{ fontSize: '12px', marginBottom: '6px' }}>{section.title} ({section.items.length})</h3>
                {section.items.length === 0 ? (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No items of this source type are recorded.</p>
                ) : (
                  <ul style={{ paddingLeft: '18px', margin: 0 }}>
                    {section.items.map(item => (
                      <li key={item.id} style={{ fontSize: '12px', marginBottom: '8px' }}>
                        <strong>{item.recorded_at} · {item.source_label}</strong>
                        <p style={{ marginTop: '3px', lineHeight: 1.5 }}>{item.excerpt}</p>
                        {item.review_warnings.map((warning, index) => (
                          <p key={index} role="alert" style={{ color: 'var(--unknown)', marginTop: '3px' }}>
                            Verify: {warning}
                          </p>
                        ))}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ))}
            <section style={{ marginTop: '12px' }}>
              <h3 style={{ fontSize: '12px', marginBottom: '6px' }}>System interpretations</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                This brief generates no new AI interpretation. Keep any existing AI-derived insight separate from documented source text and caregiver reports.
              </p>
            </section>
            <section style={{ marginTop: '12px' }}>
              <h3 style={{ fontSize: '12px', marginBottom: '6px' }}>Unknowns to verify</h3>
              {appointmentBrief.unknowns_to_verify.length ? (
                <ul style={{ paddingLeft: '18px', margin: 0 }}>
                  {appointmentBrief.unknowns_to_verify.map((item, index) => <li key={index} style={{ fontSize: '12px', marginBottom: '5px' }}>{item}</li>)}
                </ul>
              ) : (
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No extraction warnings are recorded; this does not prove the source material is complete or correct.</p>
              )}
            </section>
            <section style={{ marginTop: '12px' }}>
              <h3 style={{ fontSize: '12px', marginBottom: '6px' }}>Questions for the care team</h3>
              <ul style={{ paddingLeft: '18px', margin: 0 }}>
                {appointmentBrief.questions_for_care_team.map((question, index) => <li key={index} style={{ fontSize: '12px', marginBottom: '5px' }}>{question}</li>)}
              </ul>
            </section>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '12px' }}>{appointmentBrief.disclaimer}</p>
          </div>
        )}
      </section>

      <div style={{
        background: 'var(--accent-soft)', border: '1px solid var(--accent)',
        borderRadius: '8px', padding: '8px 14px', marginBottom: '16px'
      }}>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '2px' }}>
          Changes recorded in "What Matters Today" automatically become part of the Living Care Record.
        </p>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.8 }}>
          Not sure where something belongs? Add it anywhere. SolenOS will organize it.
        </p>
      </div>

      <div style={{
        display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '24px',
        padding: '8px 12px', background: 'var(--bg)', borderRadius: '8px', border: '1px dashed var(--border)'
      }}>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Examples:</span>
        {['Doctor\'s note', 'Hospital discharge paper', 'Medication list', 'Family message', 'Photo of document'].map(ex => (
          <span key={ex} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>• {ex}</span>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>}

      {!loading && loadError && <p role="alert" style={{ color: 'var(--error)', fontSize: '14px' }}>{loadError}</p>}

      {!loading && !loadError && items.length === 0 && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No evidence recorded yet.</p>
      )}

      {!loading && !loadError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.map(item => (
            <div key={item.id} style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '16px 20px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>{typeIcon[item.type] || '📎'}</span>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                  {item.type}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(item.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
              <p style={{ fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.source_text}</p>
              {item.source_type && (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  Evidence origin: {item.source_type.replace(/_/g, ' ')}
                </p>
              )}
              {item.extra_metadata?.extraction_source && (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Document extraction: {item.extra_metadata.extraction_source}
                  {item.extra_metadata.ocr_confidence != null ? ` · OCR confidence ${Math.round(item.extra_metadata.ocr_confidence * 100)}%` : ''}
                  {item.extra_metadata.extracted_char_count != null ? ` · ${item.extra_metadata.extracted_char_count} characters` : ''}
                </p>
              )}
              {item.extra_metadata?.metadata_unreadable && (
                <p role="alert" style={{ fontSize: '11px', color: 'var(--unknown)', marginTop: '4px' }}>
                  Some document provenance metadata could not be read. Verify against the original source.
                </p>
              )}
              {item.extra_metadata?.extraction_warnings?.map((warning, index) => (
                <p key={index} role="alert" style={{ fontSize: '12px', color: 'var(--unknown)', marginTop: '4px' }}>
                  Document review needed: {warning}
                </p>
              ))}
              {item.time_provenance && (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
                  Time source: {item.time_provenance}
                </p>
              )}
              {item.location && (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Location: {item.location}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
