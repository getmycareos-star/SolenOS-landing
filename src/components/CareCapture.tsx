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
  const [identityError, setIdentityError] = useState<string | null>(null)
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

    </div>
  )
}