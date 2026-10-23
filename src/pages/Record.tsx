import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON, getPersonId, getCaregiverId, postJSON } from '../api/client'
import CareContinuityIntegrityPanel from '../components/CareContinuityIntegrityPanel'
import CareDeltaPanel from '../components/CareDeltaPanel'

interface ReminderItem {
  id: string
  title: string
  message: string
  due_at: string
  timezone: string
  recurrence_rule?: string | null
  status: string
  attempt_count: number
  last_error?: string | null
}

interface CareRecordTimelineItem {
  id: string
  kind: string
  source_id: string
  occurred_at: string | null
  recorded_at?: string | null
  title: string
  summary?: string | null
  status?: string | null
  source_type?: string | null
  time_provenance?: string | null
  evidence?: Array<{
    id: string
    type: string
    source_text: string
    uploaded_at?: string | null
    source_type?: string | null
    time_provenance?: string | null
    confidence?: number | null
    evidence_status?: string | null
  }>
  details?: Record<string, unknown>
  related_observations?: Array<{
    id: string
    original_text: string
    observed_at?: string | null
    time_provenance?: string | null
    tags?: string[]
    evidence?: Array<{ id: string; type: string; source_text: string; uploaded_at?: string | null }>
  }>
  assertions?: Array<{
    id: string
    field: string
    asserted_value: string
    assertion_status: string
    source_label: string
    source_text?: string | null
    evidence?: Array<{ id: string; type: string; source_text: string; uploaded_at?: string | null }>
  }>
  outcomes?: Array<{
    id: string
    outcome_status: string
    notes?: string | null
    correction_text?: string | null
    created_at?: string | null
    evidence?: Array<{ id: string; type: string; source_text: string; uploaded_at?: string | null }>
  }>
}

export default function Record() {
  const [items, setItems] = useState<CareRecordTimelineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [lcrExplanation, setLcrExplanation] = useState<string | null>(null)
  const [lcrProviderStatus, setLcrProviderStatus] = useState<string | null>(null)
  const [lcrError, setLcrError] = useState<string | null>(null)
  const [explainingLcr, setExplainingLcr] = useState(false)
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [processingDocument, setProcessingDocument] = useState(false)
  const [documentError, setDocumentError] = useState<string | null>(null)
  const [documentResult, setDocumentResult] = useState<{ status: string; candidates: any } | null>(null)
  const [deltaAutoInput, setDeltaAutoInput] = useState<{ personId: string; content: string; source: string; eventDate: string; token: number; evidenceIds?: string[]; sourceEventId?: string } | null>(null)
  const [deltaToken, setDeltaToken] = useState(0)
  const [reminders, setReminders] = useState<ReminderItem[]>([])
  const [remindersError, setRemindersError] = useState<string | null>(null)
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderMessage, setReminderMessage] = useState('')
  const [reminderDueAt, setReminderDueAt] = useState('')
  const [reminderRecurrence, setReminderRecurrence] = useState('')
  const [savingReminder, setSavingReminder] = useState(false)
  const careContinuityPersonId = getPersonId()

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
        const data = await getJSON(`/care-record/${encodeURIComponent(personId)}?limit=200&offset=0`) as { timeline?: unknown; has_more?: boolean }
        if (!Array.isArray(data.timeline)) throw new Error('The unified care record response was incomplete.')
        if (!cancelled) {
          setItems(data.timeline as CareRecordTimelineItem[])
          setHasMore(Boolean(data.has_more))
        }
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

  useEffect(() => {
    let cancelled = false
    async function loadReminders() {
      const personId = getPersonId()
      if (!personId) return
      try {
        const data = await getJSON(`/reminders/${encodeURIComponent(personId)}`)
        if (!cancelled && Array.isArray(data)) setReminders(data as ReminderItem[])
      } catch {
        if (!cancelled) setRemindersError('Reminders are unavailable while the care service is offline.')
      }
    }
    loadReminders()
    return () => { cancelled = true }
  }, [])

  async function createReminder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const personId = getPersonId()
    const caregiverId = getCaregiverId()
    if (!personId || !caregiverId) {
      setRemindersError('An authorized care session is required to schedule a reminder.')
      return
    }
    if (!reminderDueAt) {
      setRemindersError('Choose a date and time for the reminder.')
      return
    }
    setSavingReminder(true)
    setRemindersError(null)
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      const result = await postJSON('/reminders', {
        person_id: personId,
        caregiver_id: caregiverId,
        title: reminderTitle.trim(),
        message: reminderMessage.trim(),
        due_at: new Date(reminderDueAt).toISOString(),
        timezone,
        recurrence_rule: reminderRecurrence || null,
        idempotency_key: crypto.randomUUID(),
        max_attempts: 5,
      }) as ReminderItem
      setReminders((current) => [result, ...current.filter((item) => item.id !== result.id)].sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at)))
      setReminderTitle('')
      setReminderMessage('')
      setReminderDueAt('')
      setReminderRecurrence('')
    } catch (error) {
      setRemindersError(error instanceof Error ? error.message : 'The reminder could not be saved.')
    } finally {
      setSavingReminder(false)
    }
  }

  async function cancelReminder(reminderId: string) {
    const personId = getPersonId()
    const caregiverId = getCaregiverId()
    if (!personId || !caregiverId) {
      setRemindersError('An authorized care session is required to cancel a reminder.')
      return
    }
    try {
      const result = await postJSON(`/reminders/${encodeURIComponent(personId)}/${encodeURIComponent(reminderId)}/cancel?caregiver_id=${encodeURIComponent(caregiverId)}`, {}) as ReminderItem
      setReminders((current) => current.map((item) => item.id === result.id ? result : item))
      setRemindersError(null)
    } catch (error) {
      setRemindersError(error instanceof Error ? error.message : 'The reminder could not be cancelled.')
    }
  }

  async function submitTextDocument() {
    const personId = getPersonId()
    const caregiverId = getCaregiverId()
    if (!personId || !caregiverId) {
      setDocumentError('A valid authorized care session is required before processing a document.')
      return
    }
    if (!documentFile) {
      setDocumentError('Choose a supported text document first.')
      return
    }
    if (documentFile.size > 5 * 1024 * 1024) {
      setDocumentError('Text documents must be 5 MiB or smaller.')
      return
    }
    const allowedExtensions = /\.(txt|md|csv|json|log)$/i
    if (!allowedExtensions.test(documentFile.name)) {
      setDocumentError('This intake currently supports .txt, .md, .csv, .json, and .log files. PDF/scanned-image OCR is not available yet.')
      return
    }
    setProcessingDocument(true)
    setDocumentError(null)
    setDocumentResult(null)
    try {
      const extractedText = await documentFile.text()
      if (!extractedText.trim()) throw new Error('The selected document contains no readable text.')
      const result = await postJSON('/situation', {
        caregiver_id: caregiverId,
        person_id: personId,
        raw_input: '',
        documents: [{
          id: documentFile.name + '-' + documentFile.lastModified,
          name: documentFile.name,
          extracted_text: extractedText,
          mime_type: documentFile.type || 'text/plain',
        }],
        provenance: {
          input_type: 'document',
          entry_method: 'text_file_upload',
          captured_at: new Date().toISOString(),
          transcript_uncertain: false,
        },
      }) as { qwen_extraction_status?: string; qwen_candidates?: any; message?: string; care_event_id?: string; evidence_id?: string }
      setDocumentResult({
        status: typeof result.qwen_extraction_status === 'string' ? result.qwen_extraction_status : 'not_reported',
        candidates: result.qwen_candidates ?? null,
      })
      setDocumentFile(null)
      // Refresh the unified timeline and keep the existing Delta Engine handoff.
      // The document is already saved at this point; a failed refresh must not misreport it as unsaved.
      const nextToken = deltaToken + 1
      setDeltaToken(nextToken)
      let linkedEvidenceIds: string[] = []
      try {
        const refreshed = await getJSON(`/care-record/${encodeURIComponent(personId)}?limit=200&offset=0`) as { timeline?: unknown; has_more?: boolean }
        if (Array.isArray(refreshed.timeline)) {
          const refreshedItems = refreshed.timeline as CareRecordTimelineItem[]
          setItems(refreshedItems)
          setHasMore(Boolean(refreshed.has_more))
          const refreshedEvidence = refreshedItems.flatMap(item => item.evidence || [])
          const matchingEvidence = refreshedEvidence.filter(item =>
            item.type === 'document' &&
            typeof item.source_text === 'string' &&
            (item.source_text === extractedText || item.source_text.includes(extractedText.slice(0, Math.min(120, extractedText.length))))
          )
          linkedEvidenceIds = matchingEvidence.slice(-3).map(item => item.id)
        }
      } catch {
        // The document has already been saved; reconciliation may proceed without linked evidence IDs.
      }
      setDeltaAutoInput({ personId: careContinuityPersonId, content: extractedText, source: documentFile.name, eventDate: new Date().toISOString(), token: nextToken, evidenceIds: Array.from(new Set([result.evidence_id, ...linkedEvidenceIds].filter((id): id is string => typeof id === 'string' && !!id))), sourceEventId: result.care_event_id })
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
    care_event: '📝',
    evidence: '📄',
    appointment: '📅',
    care_action: '☑️',
    care_transition: '🔄',
    observation: '👁️',
    care_assertion: '📌',
    care_action_outcome: '☑️',
    care_window: '⏱️',
    document: '📄',
    note: '📝',
    conversation: '💬',
  }

  const continuityEvidenceMap = new Map<string, { id: string; type: string; source_text: string; uploaded_at: string }>()
  for (const item of items) {
    const linkedSources = [
      ...(item.evidence || []),
      ...(item.related_observations || []).flatMap(observation => observation.evidence || []),
      ...(item.assertions || []).flatMap(assertion => assertion.evidence || []),
      ...(item.outcomes || []).flatMap(outcome => outcome.evidence || []),
    ]
    for (const source of linkedSources) {
      continuityEvidenceMap.set(source.id, { id: source.id, type: source.type, source_text: source.source_text, uploaded_at: source.uploaded_at || '' })
    }
  }
  const continuityEvidenceItems = Array.from(continuityEvidenceMap.values())

  async function loadOlderRecords() {
    const personId = getPersonId()
    if (!personId) {
      setLoadMoreError('No authorized care record is selected.')
      return
    }
    setLoadingMore(true)
    setLoadMoreError(null)
    try {
      const offset = items.length
      const result = await getJSON(`/care-record/${encodeURIComponent(personId)}?limit=200&offset=${offset}`) as { timeline?: unknown; has_more?: boolean }
      if (!Array.isArray(result.timeline)) throw new Error('The older care record response was incomplete.')
      const nextItems = result.timeline as CareRecordTimelineItem[]
      setItems(current => {
        const existingIds = new Set(current.map(item => item.id))
        return [...current, ...nextItems.filter(item => !existingIds.has(item.id))]
      })
      setHasMore(Boolean(result.has_more))
    } catch {
      setLoadMoreError('Older care records could not be loaded. The records already on screen remain available.')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>Living Care Record</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, maxWidth: '500px' }}>
             One chronological view of recorded care events, observations, source documents, appointments, transitions, and follow-up actions. Original source material stays attached where available.
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
        <strong style={{ fontSize: '13px' }}>Analyze a text document with Qwen</strong>
        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '10px' }}>
          Upload a text-bearing file to save it as source evidence and run Qwen extraction. PDF and scanned-image OCR are not available in this intake yet.
        </p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            aria-label="Choose a text document"
            type="file"
            accept=".txt,.md,.csv,.json,.log,text/plain,text/markdown,text/csv,application/json"
            disabled={processingDocument}
            onChange={(event) => {
              setDocumentFile(event.target.files?.[0] || null)
              setDocumentError(null)
              setDocumentResult(null)
            }}
          />
          <button onClick={submitTextDocument} disabled={processingDocument || !documentFile} style={{
            padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)',
            background: processingDocument || !documentFile ? 'var(--bg)' : 'var(--accent)',
            color: processingDocument || !documentFile ? 'var(--text-secondary)' : 'white',
            fontSize: '12px', cursor: processingDocument || !documentFile ? 'default' : 'pointer'
          }}>
            {processingDocument ? 'Processing…' : 'Save and analyze'}
          </button>
        </div>
        {documentError && <p role="alert" style={{ fontSize: '12px', color: 'var(--error)', marginTop: '8px' }}>{documentError}</p>}
        {documentResult && (
          <div role="status" style={{ marginTop: '10px' }}>
            <strong style={{ fontSize: '12px' }}>Qwen document analysis: {documentResult.status}</strong>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Extracted observations are source-linked review candidates, not established LCR facts.
            </p>
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
                <span style={{ fontSize: '16px' }}>{typeIcon[item.kind] || '📎'}</span>
                <span style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>
                  {item.kind.replace(/_/g, ' ')}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {new Date(item.occurred_at || item.recorded_at || '').toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '2px 0 6px' }}>{item.title}</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{item.summary || item.title}</p>
              {item.status && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>Status: {item.status.replace(/_/g, ' ')}</p>}
              {item.time_provenance && (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>
                  Time source: {item.time_provenance}
                </p>
              )}
              {typeof item.details?.location === 'string' && item.details.location && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Location: {item.details.location}</p>}
              {typeof item.details?.provider === 'string' && item.details.provider && <p style={{ fontSize: '12px', marginTop: '6px' }}>Provider: {item.details.provider}</p>}
              {typeof item.details?.healthcare_org === 'string' && item.details.healthcare_org && <p style={{ fontSize: '12px', marginTop: '4px' }}>Organization: {item.details.healthcare_org}</p>}
              {typeof item.details?.event_type === 'string' && item.details.event_type && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Event type: {item.details.event_type.replace(/_/g, ' ')}</p>}
              {typeof item.details?.from_location === 'string' && item.details.from_location && <p style={{ fontSize: '12px', marginTop: '4px' }}>From: {item.details.from_location}</p>}
              {typeof item.details?.to_location === 'string' && item.details.to_location && <p style={{ fontSize: '12px', marginTop: '4px' }}>To: {item.details.to_location}</p>}
              {typeof item.details?.action_type === 'string' && item.details.action_type && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Action: {item.details.action_type.replace(/_/g, ' ')}</p>}
              {Array.isArray(item.details?.medication_questions) && item.details.medication_questions.length > 0 && <div style={{ marginTop: '8px' }}><strong style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Medication questions</strong><ul style={{ paddingLeft: '18px', marginTop: '4px' }}>{item.details.medication_questions.map((question, index) => <li key={`${item.id}-medication-question-${index}`} style={{ fontSize: '12px', marginBottom: '3px' }}>{String(question)}</li>)}</ul></div>}
              {Array.isArray(item.details?.documents_to_bring) && item.details.documents_to_bring.length > 0 && <div style={{ marginTop: '8px' }}><strong style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Documents to bring</strong><ul style={{ paddingLeft: '18px', marginTop: '4px' }}>{item.details.documents_to_bring.map((document, index) => <li key={`${item.id}-document-${index}`} style={{ fontSize: '12px', marginBottom: '3px' }}>{String(document)}</li>)}</ul></div>}
              {(item.related_observations?.length ?? 0) > 0 && <section aria-label="Related observations" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}><strong style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Related observations</strong>{item.related_observations?.map(observation => <div key={observation.id} style={{ marginTop: '6px' }}><p style={{ fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{observation.original_text}</p>{observation.observed_at && <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Observed: {new Date(observation.observed_at).toLocaleString()}</p>}{observation.evidence?.map(source => <p key={source.id} style={{ fontSize: '11px', lineHeight: 1.5 }}>Source ({source.type.replace(/_/g, ' ')}): {source.source_text}</p>)}</div>)}</section>}
              {(item.assertions?.length ?? 0) > 0 && <section aria-label="Source-attributed care facts" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}><strong style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Source-attributed care facts</strong>{item.assertions?.map(assertion => <div key={assertion.id} style={{ marginTop: '6px' }}><p style={{ fontSize: '12px', lineHeight: 1.5 }}><strong>{assertion.field.replace(/_/g, ' ')}:</strong> {assertion.asserted_value}</p><p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{assertion.source_label} · {assertion.assertion_status.replace(/_/g, ' ')}</p>{assertion.source_text && <p style={{ fontSize: '11px', lineHeight: 1.5 }}>{assertion.source_text}</p>}{assertion.evidence?.map(source => <p key={source.id} style={{ fontSize: '11px', lineHeight: 1.5 }}>Source ({source.type.replace(/_/g, ' ')}): {source.source_text}</p>)}</div>)}</section>}
              {(item.outcomes?.length ?? 0) > 0 && <section aria-label="Care action outcomes" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}><strong style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Action outcomes</strong>{item.outcomes?.map(outcome => <div key={outcome.id} style={{ marginTop: '6px' }}><p style={{ fontSize: '12px' }}>{outcome.outcome_status.replace(/_/g, ' ')}</p>{(outcome.notes || outcome.correction_text) && <p style={{ fontSize: '11px', lineHeight: 1.5 }}>{outcome.notes || outcome.correction_text}</p>}{outcome.created_at && <p style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Recorded: {new Date(outcome.created_at).toLocaleString()}</p>}{outcome.evidence?.map(source => <p key={source.id} style={{ fontSize: '11px', lineHeight: 1.5 }}>Source ({source.type.replace(/_/g, ' ')}): {source.source_text}</p>)}</div>)}</section>}
              {item.kind !== 'evidence' && (item.evidence?.length ?? 0) > 0 && <section aria-label="Supporting source material" style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}><strong style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Supporting source material</strong>{item.evidence?.map(source => <div key={source.id} style={{ marginTop: '6px' }}><span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>{source.type.replace(/_/g, ' ')}</span><p style={{ fontSize: '12px', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{source.source_text}</p></div>)}</section>}
            </div>
          ))}
        </div>
      )}
      {loadMoreError && <p role="alert" style={{ color: 'var(--error)', fontSize: '12px', marginTop: '12px' }}>{loadMoreError}</p>}
      {hasMore && !loading && !loadError && <div style={{ display: 'flex', justifyContent: 'center', marginTop: '16px' }}><button type="button" onClick={loadOlderRecords} disabled={loadingMore} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--border)', background: loadingMore ? 'var(--bg)' : 'var(--surface)', color: 'var(--text)', fontSize: '12px', cursor: loadingMore ? 'default' : 'pointer' }}>{loadingMore ? 'Loading older records…' : 'Load older records'}</button></div>}
      <section aria-labelledby="reminders-heading" style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '10px', padding: '16px', marginBottom: '18px'
      }}>
        <h2 id="reminders-heading" style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 6px' }}>Care reminders</h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 14px' }}>
          Schedule a follow-up and keep its delivery status visible. A reminder is only marked delivered after the notification provider confirms receipt.
        </p>
        <form onSubmit={createReminder} style={{ display: 'grid', gap: '10px', maxWidth: '620px' }}>
          <label style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
            Reminder title
            <input required maxLength={200} value={reminderTitle} onChange={(event) => setReminderTitle(event.target.value)} placeholder="Call the clinic" style={{ padding: '9px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
          </label>
          <label style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
            Details
            <textarea required maxLength={4000} value={reminderMessage} onChange={(event) => setReminderMessage(event.target.value)} placeholder="What needs to be remembered?" rows={2} style={{ padding: '9px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical' }} />
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px' }}>
            <label style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
              Date and time (your local time)
              <input type="datetime-local" required value={reminderDueAt} onChange={(event) => setReminderDueAt(event.target.value)} style={{ padding: '9px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
            </label>
            <label style={{ display: 'grid', gap: '4px', fontSize: '12px' }}>
              Repeat
              <select value={reminderRecurrence} onChange={(event) => setReminderRecurrence(event.target.value)} style={{ padding: '9px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}>
                <option value="">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>Timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'}</p>
          <div><button type="submit" disabled={savingReminder} style={{ padding: '9px 13px', borderRadius: '8px', border: 0, background: 'var(--accent)', color: 'white', fontSize: '12px', cursor: savingReminder ? 'default' : 'pointer' }}>{savingReminder ? 'Saving reminder…' : 'Save reminder'}</button></div>
        </form>
        {remindersError && <p role="alert" style={{ color: 'var(--error)', fontSize: '12px', marginTop: '10px' }}>{remindersError}</p>}
        <div style={{ display: 'grid', gap: '8px', marginTop: '14px' }}>
          {reminders.length === 0 && <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No reminders are recorded for this care recipient yet.</p>}
          {reminders.map((item) => (
            <article key={item.id} style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start' }}>
                <div>
                  <strong style={{ fontSize: '13px' }}>{item.title}</strong>
                  <p style={{ fontSize: '12px', margin: '4px 0', whiteSpace: 'pre-wrap' }}>{item.message}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                    {new Date(item.due_at).toLocaleString()} · {item.timezone} · {item.recurrence_rule || 'One-time'} · {item.status.replace(/_/g, ' ')}
                  </p>
                  {item.last_error && <p style={{ fontSize: '11px', color: 'var(--error)', margin: '5px 0 0' }}>Last delivery issue: {item.last_error}</p>}
                </div>
                {['scheduled', 'failed'].includes(item.status) && <button type="button" onClick={() => cancelReminder(item.id)} style={{ padding: '6px 9px', borderRadius: '7px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '11px', whiteSpace: 'nowrap' }}>Cancel</button>}
              </div>
            </article>
          ))}
        </div>
      </section>

      <CareContinuityIntegrityPanel personId={careContinuityPersonId} evidenceItems={continuityEvidenceItems} />
      <CareDeltaPanel key={careContinuityPersonId} personId={careContinuityPersonId} autoInput={deltaAutoInput} />
    </div>
  )
}
