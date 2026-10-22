import { useState } from 'react'
import { Link } from 'react-router-dom'
import { postJSON, getPersonId, getCaregiverId } from '../api/client'
import { useOptimisticMutation } from '../lib/optimistic'

interface CareCaptureProps {
  personId?: string
  onCapture?: (text: string) => void
}

export default function CareCapture({ personId: pid, onCapture }: CareCaptureProps) {
  const [text, setText] = useState('')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [qwenAnalysis, setQwenAnalysis] = useState<{ status: string; candidates: any; analysisId?: string | null } | null>(null)
  const [identityError, setIdentityError] = useState<string | null>(null)
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, string>>({})
  const [reviewingCandidate, setReviewingCandidate] = useState<number | null>(null)
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null)
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
      setQwenAnalysis({
        status: typeof data?.qwen_extraction_status === 'string' ? data.qwen_extraction_status : 'not_reported',
        candidates: data?.qwen_candidates ?? null,
        analysisId: typeof data?.qwen_analysis_id === 'string' ? data.qwen_analysis_id : null,
      })
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

  async function reviewCandidate(index: number, decision: 'accept' | 'correct' | 'reject') {
    const analysisId = qwenAnalysis?.analysisId
    if (!analysisId) {
      setReviewFeedback('This extraction did not return a persistent review ID. The original report is saved, but this candidate cannot be reviewed until the backend returns that ID.')
      return
    }
    const correctedObservation = reviewDrafts[index]?.trim()
    if (decision === 'correct' && !correctedObservation) {
      setReviewFeedback('Enter the corrected observation before saving a correction.')
      return
    }
    setReviewingCandidate(index)
    setReviewFeedback(null)
    try {
      const result = await postJSON(`/capture/analyses/${encodeURIComponent(analysisId)}/review`, {
        candidate_index: index,
        decision,
        corrected_observation: decision === 'correct' ? correctedObservation : undefined,
      }) as { candidate?: any; message?: string }
      if (!result.candidate) throw new Error('The server did not return the saved review decision.')
      setQwenAnalysis((current) => {
        if (!current || !Array.isArray(current.candidates?.observations)) return current
        const observations = [...current.candidates.observations]
        observations[index] = result.candidate
        return { ...current, candidates: { ...current.candidates, observations } }
      })
      setReviewFeedback(result.message || 'Review decision saved. The Living Care Record was not changed.')
    } catch (error) {
      setReviewFeedback(error instanceof Error ? error.message : 'The review decision could not be saved.')
    } finally {
      setReviewingCandidate(null)
    }
  }

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
    setReviewFeedback(null)
    setReviewDrafts({})

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
          The save could not be confirmed. Your text remains in the field; check the connection and retry.
        </p>
      )}

      {savedMessage && (
        <p role="status" style={{ marginTop: '12px', fontSize: '12px', color: 'var(--success)' }}>
          {savedMessage}
        </p>
      )}
      {savedMessage && (
        <p style={{ marginTop: '8px', fontSize: '12px' }}>
          <Link to="/record" style={{ color: 'var(--trust)' }}>Review the Living Care Record →</Link>
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
                <li key={index} style={{ fontSize: '12px', marginBottom: '12px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                  <strong>{candidate.subject || 'Observation'}:</strong> {candidate.observation}
                  <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Source: “{candidate.source_quote}” · {candidate.review_status || 'pending_review'}
                  </div>
                  <label style={{ display: 'block', marginTop: '8px', fontSize: '11px' }}>
                    Correct the extracted wording (optional unless saving a correction)
                    <textarea
                      aria-label={`Corrected observation ${index + 1}`}
                      value={reviewDrafts[index] || ''}
                      onChange={(event) => setReviewDrafts((current) => ({ ...current, [index]: event.target.value }))}
                      placeholder={candidate.observation}
                      rows={2}
                      style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', font: 'inherit' }}
                    />
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button type="button" disabled={reviewingCandidate !== null} onClick={() => void reviewCandidate(index, 'correct')} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '11px' }}>Save correction</button>
                    <button type="button" disabled={reviewingCandidate !== null} onClick={() => void reviewCandidate(index, 'accept')} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '11px' }}>Mark reviewed</button>
                    <button type="button" disabled={reviewingCandidate !== null} onClick={() => void reviewCandidate(index, 'reject')} style={{ padding: '6px 8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '11px' }}>Reject candidate</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              No verified Qwen candidates are available. The saved input remains preserved.
            </p>
          )}
          {reviewFeedback && <p role="status" style={{ fontSize: '11px', marginTop: '8px', color: 'var(--text-secondary)' }}>{reviewFeedback}</p>}
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