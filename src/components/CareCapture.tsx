import { useState } from 'react'
import { postJSON, getPersonId } from '../api/client'
import { useOptimisticMutation } from '../lib/optimistic'

interface CareCaptureProps {
  personId?: string
  onCapture?: (text: string) => void
}

const CAPTURE_HINTS = [
  { emoji: '🌙', text: 'Wandering overnight' },
  { emoji: '💊', text: 'Refused medication' },
  { emoji: '💤', text: 'Sleep got worse' },
  { emoji: '🍽️', text: 'Eating less' },
  { emoji: '😕', text: 'New confusion' },
  { emoji: '😠', text: 'Increased agitation' },
  { emoji: '⚖️', text: 'Weight loss' },
]

export default function CareCapture({ personId: pid, onCapture }: CareCaptureProps) {
  const [text, setText] = useState('')
  const [saved, setSaved] = useState(false)
  const personId = pid || getPersonId()
  
  const { mutate: submitSituation, loading: submitting, error: submitError } = useOptimisticMutation<
    any,
    { caregiverId: string; personId: string; rawInput: string }
  >()

  const handleSubmit = async () => {
    if (!text.trim()) return

    // TODO: obtain caregiver identity from the authenticated server session.
    // Do not trust this client-supplied identifier for authorization.
    const caregiverId = 'demo-caregiver'
    const variables = { caregiverId, personId, rawInput: text.trim() }

    await submitSituation({
      mutationFn: ({ caregiverId, personId, rawInput }) =>
        postJSON('/api/situation', {
          caregiver_id: caregiverId,
          person_id: personId,
          raw_input: rawInput,
        }),
      onMutate: async ({ caregiverId, personId, rawInput }) => ({
        caregiverId, personId, rawInput,
      }),
      onSuccess: async (_data, mutationVariables) => {
        // Only report success after the backend confirms the situation was saved.
        setSaved(true)
        onCapture?.(mutationVariables.rawInput)
      },
      onError: async (error) => {
        console.error('Failed to save situation:', error)
      },
      onSettled: (_data, error) => {
        // Preserve the caregiver's text when saving fails so it can be retried.
        if (!error) setText('')
      },
      retry: false,
      maxRetries: 0,
    }, variables)
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '16px 20px', marginBottom: '24px'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: saved ? '12px' : '8px',
      }}>
        <span style={{ fontSize: '20px' }}>📝</span>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
          What changed today?
        </h2>
        {saved && (
          <span style={{
            fontSize: '11px', color: 'var(--success)', fontWeight: 500,
            background: 'var(--success-soft)', padding: '2px 8px', borderRadius: '999px',
          }}>
            Saved
          </span>
        )}
        {submitting && !experiences && (
          <span style={{
            fontSize: '11px', color: 'var(--warning)', fontWeight: 500,
            background: 'var(--warning-soft)', padding: '2px 8px', borderRadius: '999px',
          }}>
            Saving...
          </span>
        )}
        {submitError && !experiences && (
          <span style={{
            fontSize: '11px', color: 'var(--error)', fontWeight: 500,
            background: 'var(--error-soft)', padding: '2px 8px', borderRadius: '999px',
          }}>
            Failed to save
          </span>
        )}
      </div>

      <p style={{
        fontSize: '12px', color: 'var(--text-secondary)',
        marginBottom: '12px', lineHeight: 1.5
      }}>
        Capture one thing that changed — a behavior, a symptom, a moment.
        SolenOS will remember it for your next appointment and find similar experiences from other caregivers.
      </p>

      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setSaved(false) }}
        placeholder="Dad wandered at 2 AM and was confused about where he was..."
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

      <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
        {CAPTURE_HINTS.map(hint => (
          <button
            key={hint.text}
            type="button"
            onClick={() => setText(hint.emoji + ' ' + hint.text + ' — ')}
            style={{
              padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)',
              background: 'var(--bg)', fontSize: '11px', color: 'var(--text-secondary)',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
          >
            {hint.emoji} {hint.text}
          </button>
        ))}
      </div>

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

}
    </div>
  )
}