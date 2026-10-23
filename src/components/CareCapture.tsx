import { useState } from 'react'
import { postJSON, getPersonId, getCaregiverId } from '../api/client'
import { useOptimisticMutation } from '../lib/optimistic'

interface CareCaptureProps {
  personId?: string
  onCapture?: (text: string) => void
}

export default function CareCapture({ personId: pid, onCapture }: CareCaptureProps) {
  const [text, setText] = useState('')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [savedText, setSavedText] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [qwenAnalysis, setQwenAnalysis] = useState<{ status: string; candidates: any; analysisId: string | null } | null>(null)
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { subject: string; observation: string }>>({})
  const [reviewingCandidate, setReviewingCandidate] = useState<number | null>(null)
  const [reviewFeedback, setReviewFeedback] = useState<string | null>(null)
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
      // The backend currently returns a saved situation, not community matches.
      // Do not call the nonexistent /community/experience endpoint or invent matches.
      setSavedMessage(typeof data?.message === 'string' ? data.message : 'Care update saved.')
      setSavedText(variables.rawInput)
      const eventTimestamp = Array.isArray(data?.events) ? data.events[0]?.occurred_at : null
      setSavedAt(typeof eventTimestamp === 'string' ? eventTimestamp : null)
      setQwenAnalysis({
        status: typeof data?.qwen_extraction_status === 'string' ? data.qwen_extraction_status : 'not_reported',
        candidates: data?.qwen_candidates ?? null,
        analysisId: typeof data?.qwen_analysis_id === 'string' ? data.qwen_analysis_id : null,
      })
      setReviewDrafts({})
      setReviewFeedback(null)
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
      setReviewFeedback('The original report is saved, but this analysis has no persistent review ID. Candidate decisions are unavailable until the backend provides one.')
      return
    }
    const draft = reviewDrafts[index]
    if (decision === 'correct' && !((draft?.subject || '').trim() || (draft?.observation || '').trim())) {
      setReviewFeedback('Enter a corrected subject or observation before saving a correction.')
      return
    }
    setReviewingCandidate(index)
    setReviewFeedback(null)
    try {
      const result = await postJSON(`/capture/analyses/${encodeURIComponent(analysisId)}/review`, {
        candidate_index: index,
        decision,
        corrected_subject: decision === 'correct' ? (draft?.subject || '').trim() || undefined : undefined,
        corrected_observation: decision === 'correct' ? (draft?.observation || '').trim() || undefined : undefined,
      }) as { candidate?: any; message?: string }
      if (!result?.candidate) throw new Error('The server did not return the saved review decision.')
      setQwenAnalysis(current => {
        if (!current || !Array.isArray(current.candidates?.observations)) return current
        const observations = [...current.candidates.observations]
        observations[index] = result.candidate
        return { ...current, candidates: { ...current.candidates, observations } }
      })
      setReviewFeedback(result.message || 'Review decision saved. The original source report remains unchanged.')
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
    setSavedText(null)
    setSavedAt(null)
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
          setSavedText(null)
          setSavedAt(null)
          setQwenAnalysis(null)
          setReviewDrafts({})
          setReviewFeedback(null)
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

      {savedMessage && savedText && (
        <section aria-label="Original captured report" style={{ marginTop: '12px', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg)' }}>
          <strong style={{ fontSize: '12px' }}>Original report — preserved</strong>
          {savedAt && <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '4px' }}>Recorded event time: {new Date(savedAt).toLocaleString()}</p>}
          <p style={{ fontSize: '12px', lineHeight: 1.55, whiteSpace: 'pre-wrap', marginTop: '6px' }}>{savedText}</p>
        </section>
      )}

      {savedMessage && qwenAnalysis && (
        <section aria-label="Qwen capture analysis" style={{ marginTop: '12px', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <strong style={{ fontSize: '12px' }}>Qwen analysis: {qwenAnalysis.status}</strong>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            AI output is an unverified candidate, not an established Living Care Record fact.
          </p>
          {Array.isArray(qwenAnalysis.candidates?.observations) && qwenAnalysis.candidates.observations.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0, marginTop: '8px' }}>
              {qwenAnalysis.candidates.observations.map((candidate: any, index: number) => {
                const draft = reviewDrafts[index] || { subject: candidate.subject || '', observation: candidate.observation || '' }
                const reviewStatus = String(candidate.review_status || 'pending_review')
                const alreadyReviewed = reviewStatus !== 'pending_review'
                return (
                  <li key={index} style={{ fontSize: '12px', marginBottom: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                    <strong>Candidate {index + 1}</strong>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '3px' }}>Unverified extraction · {reviewStatus.replace(/_/g, ' ')}</p>
                    <label style={{ display: 'block', marginTop: '8px', fontSize: '11px' }}>
                      Subject
                      <input aria-label={`Corrected subject ${index + 1}`} value={draft.subject} disabled={alreadyReviewed || reviewingCandidate !== null} onChange={event => setReviewDrafts(current => ({ ...current, [index]: { ...(current[index] || { subject: candidate.subject || '', observation: candidate.observation || '' }), subject: event.target.value } }))} maxLength={160} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', font: 'inherit' }} />
                    </label>
                    <label style={{ display: 'block', marginTop: '8px', fontSize: '11px' }}>
                      Extracted observation — edit before saving a correction
                      <textarea aria-label={`Corrected observation ${index + 1}`} value={draft.observation} disabled={alreadyReviewed || reviewingCandidate !== null} onChange={event => setReviewDrafts(current => ({ ...current, [index]: { ...(current[index] || { subject: candidate.subject || '', observation: candidate.observation || '' }), observation: event.target.value } }))} maxLength={1200} rows={2} style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '4px', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', font: 'inherit' }} />
                    </label>
                    <p style={{ color: 'var(--text-secondary)', marginTop: '6px' }}>Source evidence: “{candidate.source_quote || 'No source quote supplied'}”</p>
                    {candidate.time_expression && <p style={{ color: 'var(--text-secondary)', marginTop: '3px' }}>Time expression in source: {candidate.time_expression}</p>}
                    {candidate.certainty && <p style={{ color: 'var(--text-secondary)', marginTop: '3px' }}>Certainty: {candidate.certainty}</p>}
                    {!alreadyReviewed && <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                      <button type="button" disabled={reviewingCandidate !== null} onClick={() => void reviewCandidate(index, 'correct')} style={{ padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '11px' }}>{reviewingCandidate === index ? 'Saving…' : 'Save correction'}</button>
                      <button type="button" disabled={reviewingCandidate !== null} onClick={() => void reviewCandidate(index, 'accept')} style={{ padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '11px' }}>Mark reviewed</button>
                      <button type="button" disabled={reviewingCandidate !== null} onClick={() => void reviewCandidate(index, 'reject')} style={{ padding: '7px 9px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: '11px' }}>Reject candidate</button>
                    </div>}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
              No verified Qwen candidates are available. The saved input remains preserved.
            </p>
          )}
          {Array.isArray(qwenAnalysis.candidates?.possible_safety_flags) && qwenAnalysis.candidates.possible_safety_flags.length > 0 && (
            <div style={{ marginTop: '10px', padding: '10px', border: '1px solid var(--border)', borderRadius: '6px' }}>
              <strong style={{ fontSize: '12px' }}>Items flagged for caregiver review</strong>
              <ul style={{ paddingLeft: '18px', marginTop: '5px' }}>{qwenAnalysis.candidates.possible_safety_flags.map((flag: string, index: number) => <li key={index} style={{ fontSize: '12px', marginBottom: '4px' }}>{flag}</li>)}</ul>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '5px' }}>These are unverified model flags, not a diagnosis or emergency assessment.</p>
            </div>
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
          {reviewFeedback && <p role="status" style={{ fontSize: '11px', marginTop: '10px', color: 'var(--text-secondary)' }}>{reviewFeedback}</p>}
          {!qwenAnalysis.analysisId && qwenAnalysis.status !== 'pending_review' && <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '8px' }}>This analysis has no review ID. The original report remains saved, but candidate decisions cannot be persisted yet.</p>}
        </section>
      )}

    </div>
  )
}