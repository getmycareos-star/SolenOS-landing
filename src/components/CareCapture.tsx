import { useState } from 'react'
import { postJSON, getPersonId, getCaregiverId, requestQwenCandidateAnalysis } from '../api/client'
import { useOptimisticMutation } from '../lib/optimistic'

interface CareCaptureProps {
  personId?: string
  onCapture?: (text: string) => void
}

export default function CareCapture({ personId: pid, onCapture }: CareCaptureProps) {
  const [text, setText] = useState('')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [qwenAnalysis, setQwenAnalysis] = useState<{ status: string; candidates: any } | null>(null)
  const [identityError, setIdentityError] = useState<string | null>(null)
  const personId = pid || getPersonId()
  
  const { mutate: submitSituation, loading: submitting, error: submitError } = useOptimisticMutation<
    any, 
    { caregiverId: string; personId: string; rawInput: string }
  >({
    mutationFn: async ({ caregiverId, personId, rawInput }) => {
      const response = await postJSON('/situation', {
        caregiver_id: caregiverId,
        person_id: personId,
        raw_input: rawInput,
      }) as { ok?: boolean; message?: string };
      if (response?.ok !== true) {
        throw new Error(
          typeof response?.message === 'string' && response.message.trim()
            ? response.message
            : 'The server did not confirm that this care update was saved.',
        );
      }
      return response;
    },
    onMutate: async ({ caregiverId, personId, rawInput }) => {
      // Return snapshot for potential rollback (we're not storing previous state since this is a creation)
      return { caregiverId, personId, rawInput };
    },
    onSuccess: async (data, variables) => {
      setSavedMessage(typeof data?.message === 'string' ? data.message : 'Care update saved.')
      const savedEventId = typeof data?.care_event_id === 'string'
        ? data.care_event_id
        : typeof data?.situation_id === 'string' ? data.situation_id : ''
      setQwenAnalysis({ status: savedEventId ? 'processing' : 'unavailable', candidates: null })
      if (savedEventId) {
        // Analyze only after the durable care save. A Qwen outage never turns
        // the saved note into a retryable write or a duplicate care event.
        void requestQwenCandidateAnalysis(savedEventId)
          .then((analysis) => setQwenAnalysis({
            status: analysis.qwen_extraction_status,
            candidates: analysis.qwen_candidates,
          }))
          .catch(() => setQwenAnalysis({ status: 'unavailable', candidates: null }))
      }
      setIdentityError(null)
      setText('')
      onCapture?.(variables.rawInput)
    },
    onError: async (error, variables, context) => {
      // The hook's error state drives the visible failure message; do not clear input.
      console.error('Failed to save situation:', error)
    },
    onSettled: () => {
      // Preserve the user's text on failure so it can be corrected and retried.
    },
  })

  const handleSubmit = async () => {
    if (!text.trim()) return
    if (!personId.trim() || /^(?:demo|sample|test|fake|placeholder)(?:[-_:]|$)|^(?:current-user-id|team-moderator)$/i.test(personId.trim())) {
      setIdentityError('Select a real care record before saving this care update.')
      return
    }
    const caregiverId = getCaregiverId()
    if (!caregiverId) {
      setIdentityError('A secure care session is required to save this care update. Retry session setup before saving.')
      return
    }
    setIdentityError(null)
    setSavedMessage(null)

    try {
      await submitSituation({
        caregiverId,
        personId,
        rawInput: text.trim()
      })
    } catch {
      // The mutation hook exposes the failure; keep the user's text intact.
    }
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '16px 20px', marginBottom: '24px'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: savedMessage ? '12px' : '8px',
      }}>
        <span style={{ fontSize: '20px' }}>📝</span>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
          What changed today?
        </h2>
        {savedMessage && (
          <span style={{
            fontSize: '11px', color: 'var(--success)', fontWeight: 500,
            background: 'var(--success-soft)', padding: '2px 8px', borderRadius: '999px',
          }}>
            Saved
          </span>
        )}
        {submitting && !savedMessage && (
          <span style={{
            fontSize: '11px', color: 'var(--warning)', fontWeight: 500,
            background: 'var(--warning-soft)', padding: '2px 8px', borderRadius: '999px',
          }}>
            Saving...
          </span>
        )}
        {Boolean(submitError || identityError) && (
          <span style={{
            fontSize: '11px', color: 'var(--error)', fontWeight: 500,
            background: 'var(--error-soft)', padding: '2px 8px', borderRadius: '999px',
          }}>
            {identityError || (submitError instanceof Error ? submitError.message : 'Failed to save')}
          </span>
        )}
      </div>

      <p style={{
        fontSize: '12px', color: 'var(--text-secondary)',
        marginBottom: '12px', lineHeight: 1.5
      }}>
        Capture one thing that changed — a behavior, a symptom, a moment.
        SolenOS saves this update to the care record so you can review it alongside other recorded events.
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSavedMessage(null)
          setQwenAnalysis(null)
          setIdentityError(null)
        }}
        placeholder="Describe what you observed, when it happened, and what remains uncertain."
        disabled={submitting}
        rows={Math.max(2, Math.floor(text.length / 50) + 1)}
        style={{
          width: '100%', padding: '12px 14px', borderRadius: '8px',
          border: '1px solid var(--border)', background: 'var(--bg)',
          fontSize: '14px', fontFamily: 'inherit', resize: 'vertical',
          outline: 'none', color: 'var(--text)',
          minHeight: '50px', maxHeight: '140px',
        }}
      />


      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          style={{
            flex: 1, padding: '10px 20px', borderRadius: '8px', border: 'none',
            background: submitting || !text.trim()
              ? 'var(--text-secondary)'
              : 'var(--trust)',
            color: 'white', fontSize: '13px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer',
          }}
        >
          {submitting ? 'Saving...' : 'Save what changed →'}
        </button>
      </div>

      {Boolean(submitError) && !identityError && (
        <p role="alert" style={{ marginTop: '12px', fontSize: '12px', color: 'var(--error)' }}>
          The save could not be confirmed{submitError instanceof Error && submitError.message ? `: ${submitError.message}` : ''}. Your text remains in the field; check the connection and retry.
        </p>
      )}

      {savedMessage && (
        <p role="status" style={{ marginTop: '12px', fontSize: '12px', color: 'var(--success)' }}>
          {savedMessage}
        </p>
      )}

      {savedMessage && qwenAnalysis && (
        <section aria-label="Qwen capture analysis" style={{ marginTop: '12px', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <strong style={{ fontSize: '12px' }}>Qwen analysis: {qwenAnalysis.status}</strong>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            AI output is an unverified candidate, not an established Living Care Record fact.
          </p>
          {Array.isArray(qwenAnalysis.candidates?.observations) && qwenAnalysis.candidates.observations.length > 0 ? (
            <ul style={{ paddingLeft: '18px', marginTop: '8px' }}>
              {qwenAnalysis.candidates.observations.map((candidate: any, index: number) => (
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
              No verified Qwen candidates are available. The saved input remains preserved.
            </p>
          )}
          {Array.isArray(qwenAnalysis.candidates?.open_questions) && qwenAnalysis.candidates.open_questions.length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <strong style={{ fontSize: '12px' }}>Questions to clarify</strong>
              <ul style={{ paddingLeft: '18px', marginTop: '4px' }}>
                {qwenAnalysis.candidates.open_questions.map((question: string, index: number) => (
                  <li key={index} style={{ fontSize: '12px', marginBottom: '4px' }}>{question}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

    </div>
  )
}