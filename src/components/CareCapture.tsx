import { useState } from 'react'
import { postJSON, getPersonId, getCaregiverId } from '../api/client'
import { useOptimisticMutation } from '../lib/optimistic'

interface CareCaptureProps {
  personId?: string
  onCapture?: (text: string) => void
}

interface QwenCandidate {
  subject: string
  observation: string
  time_expression: string | null
  certainty: 'reported' | 'uncertain' | 'unclear'
  source_quote: string
  evidence_ids: string[]
  review_status: string
}

interface QwenCandidateBundle {
  observations: QwenCandidate[]
  open_questions: string[]
  possible_safety_flags: string[]
  rejected_unverifiable_candidates: number
}

export default function CareCapture({ personId: pid, onCapture }: CareCaptureProps) {
  const [text, setText] = useState('')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [identityError, setIdentityError] = useState<string | null>(null)
  const [analysisWarning, setAnalysisWarning] = useState<string | null>(null)
  const [qwenStatus, setQwenStatus] = useState<string | null>(null)
  const [qwenCandidates, setQwenCandidates] = useState<QwenCandidateBundle | null>(null)
  const personId = pid || getPersonId()
  
  const { mutate: submitSituation, loading: submitting, error: submitError } = useOptimisticMutation<
    any, 
    { caregiverId: string; personId: string; rawInput: string }
  >({
    mutationFn: ({ caregiverId, personId, rawInput }) => 
      postJSON('/situation', {
        caregiver_id: caregiverId,
        person_id: personId,
        raw_input: rawInput,
      }),
    onMutate: async ({ caregiverId, personId, rawInput }) => {
      // Return snapshot for potential rollback (we're not storing previous state since this is a creation)
      return { caregiverId, personId, rawInput };
    },
    onSuccess: async (data, variables) => {
      // The backend currently returns a saved situation, not community matches.
      // Do not call the nonexistent /community/experience endpoint or invent matches.
      setSavedMessage(typeof data?.message === 'string' ? data.message : 'Care update saved.')
      setAnalysisWarning(data?.analysis_status === 'complete' ? null : (data?.analysis_error || 'The report was saved, but deterministic analysis could not be confirmed.'))
      setQwenStatus(typeof data?.qwen_extraction_status === 'string' ? data.qwen_extraction_status : 'not_configured')
      setQwenCandidates(data?.qwen_candidates && typeof data.qwen_candidates === 'object' ? data.qwen_candidates as QwenCandidateBundle : null)
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
      setIdentityError('A signed-in caregiver is required to save this care update.')
      return
    }
    setIdentityError(null)
    setSavedMessage(null)
    setAnalysisWarning(null)
    setQwenStatus(null)
    setQwenCandidates(null)

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
            {identityError || 'Failed to save'}
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
          setAnalysisWarning(null)
          setQwenStatus(null)
          setQwenCandidates(null)
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
          The save could not be confirmed. Your text remains in the field; check the connection and retry.
        </p>
      )}

      {savedMessage && (
        <p role="status" style={{ marginTop: '12px', fontSize: '12px', color: 'var(--success)' }}>
          {savedMessage}
        </p>
      )}

      {analysisWarning && (
        <p role="status" style={{ marginTop: '10px', fontSize: '12px', color: 'var(--warning)' }}>
          {analysisWarning}
        </p>
      )}

      {qwenStatus === 'pending_review' && qwenCandidates && (
        <section aria-label="Qwen extraction candidates" style={{ marginTop: '14px', padding: '12px', border: '1px solid var(--border)', borderRadius: '10px' }}>
          <p style={{ fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>Qwen draft extraction — review required</p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            These are model-generated candidates, not confirmed facts. They have not been added as new Living Care Record facts.
          </p>
          {qwenCandidates.observations.length === 0 ? (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>No source-verified candidate observations were returned.</p>
          ) : qwenCandidates.observations.map((candidate, index) => (
            <div key={index} style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', marginTop: '8px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600 }}>{candidate.subject || 'Observation'} · {candidate.certainty}</p>
              <p style={{ fontSize: '12px', marginTop: '3px' }}>{candidate.observation}</p>
              {candidate.time_expression && <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '3px' }}>Time as reported: {candidate.time_expression}</p>}
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>Source: “{candidate.source_quote}”</p>
              {candidate.evidence_ids?.length > 0 && <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '3px' }}>Evidence: {candidate.evidence_ids.join(', ')}</p>}
            </div>
          ))}
          {qwenCandidates.open_questions?.length > 0 && (
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600 }}>Questions to clarify</p>
              <ul>{qwenCandidates.open_questions.map((question, index) => <li key={index} style={{ fontSize: '12px', marginTop: '3px' }}>{question}</li>)}</ul>
            </div>
          )}
        </section>
      )}

      {qwenStatus && qwenStatus !== 'pending_review' && (
        <p role="status" style={{ marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          {qwenStatus === 'not_configured' ? 'Qwen extraction is not configured on the backend. The original report is saved; no AI extraction was produced.' :
            qwenStatus === 'failed' ? 'Qwen extraction failed. The original report remains saved; no AI candidates were accepted.' :
            qwenStatus === 'no_source_evidence' ? 'Qwen extraction was skipped because text-bearing source evidence was unavailable.' :
            `Qwen extraction status: ${qwenStatus}.`}
        </p>
      )}

    </div>
  )
}