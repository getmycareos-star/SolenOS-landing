import { useState } from 'react'
import { postJSON, getPersonId, getCaregiverId } from '../api/client'
import { useOptimisticMutation } from '../lib/optimistic'

interface CareCaptureProps {
  personId?: string
  onCapture?: (text: string) => void
}

interface SavedSituation {
  ok: boolean
  care_event_id: string
  evidence_id: string
  person_id: string
  message?: string
}

export default function CareCapture({ personId: pid, onCapture }: CareCaptureProps) {
  const [text, setText] = useState('')
  const [savedMessage, setSavedMessage] = useState<string | null>(null)
  const [identityError, setIdentityError] = useState<string | null>(null)
  const personId = pid ?? getPersonId()

  const { mutate: submitSituation, loading: submitting, error: submitError } = useOptimisticMutation<
    SavedSituation,
    { caregiverId: string; personId: string; rawInput: string }
  >({
    mutationFn: ({ caregiverId, personId, rawInput }) =>
      postJSON('/situation', {
        caregiver_id: caregiverId,
        person_id: personId,
        raw_input: rawInput,
      }),
    onSuccess: async (data, variables) => {
      if (
        data?.ok !== true ||
        typeof data?.care_event_id !== 'string' || !data.care_event_id ||
        typeof data?.evidence_id !== 'string' || !data.evidence_id ||
        data?.person_id !== variables.personId
      ) {
        throw new Error('The server did not confirm this care record. Your text has been preserved; check the Living Care Record before retrying to avoid a duplicate.')
      }
      setSavedMessage(typeof data.message === 'string' && data.message.trim() ? data.message : 'Care update saved and confirmed by the server.')
      setIdentityError(null)
      setText('')
      onCapture?.(variables.rawInput)
    },
    onError: async () => {
      // Keep the entered account intact. A timed-out write may have reached the server.
      setSavedMessage(null)
    },
    onSettled: () => {
      // Never clear user-authored care text as a side effect of settling a request.
    },
  })

  const handleSubmit = async () => {
    if (!text.trim()) return

    if (!personId.trim()) {
      setIdentityError('Select an authorized care record before saving this update.')
      return
    }
    const caregiverId = getCaregiverId()
    if (!caregiverId) {
      setIdentityError('A linked caregiver account is required to save this update.')
      return
    }

    setIdentityError(null)
    setSavedMessage(null)
    try {
      await submitSituation({
        caregiverId,
        personId,
        rawInput: text.trim(),
      })
    } catch {
      // The mutation error is rendered below. Keep the user's original text.
    }
  }

  const errorMessage = identityError
    || (submitError instanceof Error ? submitError.message : submitError ? 'The care update could not be confirmed. Your text has been preserved.' : null)

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '16px 20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '20px' }}>📝</span>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>What changed today?</h2>
        {savedMessage && <span style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 500, background: 'var(--success-soft)', padding: '2px 8px', borderRadius: '999px' }}>Saved</span>}
        {submitting && <span style={{ fontSize: '11px', color: 'var(--warning)', fontWeight: 500, background: 'var(--warning-soft)', padding: '2px 8px', borderRadius: '999px' }}>Saving…</span>}
      </div>

      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: 1.5 }}>
        Record what you observed in your own words. Include when it happened and what remains uncertain, if known.
      </p>

      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setSavedMessage(null)
          setIdentityError(null)
        }}
        placeholder="Describe what you observed, in your own words…"
        aria-label="Care update"
        disabled={submitting}
        rows={Math.max(2, Math.floor(text.length / 50) + 1)}
        style={{ width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '14px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', color: 'var(--text)', minHeight: '50px', maxHeight: '220px' }}
      />

      <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting || !text.trim()}
          style={{ flex: 1, padding: '10px 20px', borderRadius: '8px', border: 'none', background: submitting || !text.trim() ? 'var(--text-secondary)' : 'var(--trust)', color: 'white', fontSize: '13px', fontWeight: 500, cursor: submitting ? 'default' : 'pointer' }}
        >
          {submitting ? 'Saving…' : 'Save care update'}
        </button>
      </div>

      {savedMessage && <p role="status" style={{ marginTop: '12px', fontSize: '12px', color: 'var(--success)' }}>{savedMessage}</p>}
      {errorMessage && <p role="alert" style={{ marginTop: '12px', fontSize: '12px', color: 'var(--error)' }}>{errorMessage} Your text has not been cleared.</p>}
    </div>
  )
}
