import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON, getPersonId, getCaregiverId, postJSON, postFormData } from '../api/client'

interface Evidence {
  id: string
  type: string
  source_text: string
  uploaded_at: string
  time_provenance?: string
  location?: string
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
  const [documentResult, setDocumentResult] = useState<{ status: string; candidates: any; extractionSource?: string; confidence?: number | null; warnings?: string[] } | null>(null)

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
    try {
      const form = new FormData()
      form.append('file', documentFile)
      const extracted = await postFormData('/documents/extract', form) as {
        ok?: boolean
        document?: {
          id: string
          name: string
          mime_type: string
          extracted_text: string
          extracted_text_preview?: string
          extracted_char_count?: number
          ocr_confidence?: number | null
          extraction_source?: string
          extraction_warnings?: string[]
          sha256?: string
        }
      }
      const doc = extracted.document
      if (!extracted.ok || !doc || typeof doc.extracted_text !== 'string' || !doc.extracted_text.trim()) {
        throw new Error('The document reader did not return readable text. The care record was not changed.')
      }

      const result = await postJSON('/situation', {
        caregiver_id: caregiverId,
        person_id: personId,
        raw_input: '',
        documents: [{
          id: doc.id,
          name: doc.name,
          extracted_text: doc.extracted_text,
          mime_type: doc.mime_type || documentFile.type || 'application/octet-stream',
          ocr_confidence: doc.ocr_confidence ?? null,
          extraction_source: doc.extraction_source ?? 'unknown',
          extraction_warnings: doc.extraction_warnings ?? [],
          sha256: doc.sha256,
          extracted_char_count: doc.extracted_char_count ?? doc.extracted_text.length,
        }],
        provenance: {
          input_type: 'document',
          entry_method: 'document_upload',
          captured_at: new Date().toISOString(),
          recognition_confidence: doc.ocr_confidence ?? undefined,
          transcript_uncertain: Boolean(
            (doc.ocr_confidence != null && doc.ocr_confidence < 0.65) ||
            (doc.extraction_warnings?.length ?? 0) > 0
          ),
        },
      }) as { qwen_extraction_status?: string; qwen_candidates?: any; message?: string }

      setDocumentResult({
        status: typeof result.qwen_extraction_status === 'string' ? result.qwen_extraction_status : 'saved_for_review',
        candidates: result.qwen_candidates ?? null,
        extractionSource: doc.extraction_source ?? 'unknown',
        confidence: doc.ocr_confidence ?? null,
        warnings: doc.extraction_warnings ?? [],
      })
      setDocumentFile(null)
    } catch (error) {
      setDocumentError(error instanceof Error ? error.message : 'Document processing could not be confirmed.')
    } finally {
      setProcessingDocument(false)
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
            <strong style={{ fontSize: '12px' }}>Qwen document analysis: {documentResult.status}</strong>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Extracted observations are source-linked review candidates, not established LCR facts.
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
            {documentResult.warnings?.map((warning, index) => (
              <p key={index} role="alert" style={{ fontSize: '12px', color: 'var(--unknown)', marginTop: '6px' }}>
                Review needed: {warning}
              </p>
            ))}
            {Array.isArray(documentResult.candidates?.observations) && documentResult.candidates.observations.length > 0 ? (
              <ul style={{ paddingLeft: '18px', marginTop: '8px' }}>
                {documentResult.candidates.observations.map((candidate: any, index: number) => (
                  <li key={index} style={{ fontSize: '12px', marginBottom: '8px' }}>
                    <strong>{candidate.subject || 'Observation'}:</strong> {candidate.observation}
                    <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                      Source: “{candidate.source_quote}” · {candidate.review_status || 'pending_review'}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                No Qwen candidates were returned. The document is still preserved as evidence.
              </p>
            )}
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
