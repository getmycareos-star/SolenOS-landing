import { useState } from 'react'
import { postJSON, getCaregiverId, getPersonId } from '../api/client'
import { useOptimisticMutation } from '../lib/optimistic'

interface SimilarExperience {
  post_id: string
  author_label: string
  author_type: string
  content: string
  tags: string[]
  relevance_score: number
}

interface ExperienceResult {
  trigger_observation: string
  matched_keywords: string[]
  matches: SimilarExperience[]
  community_pattern: string | null
}

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
  const [identityError, setIdentityError] = useState<string | null>(null)
  const [experiences, setExperiences] = useState<ExperienceResult | null>(null)
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
    onSuccess: async (_data, variables, _context) => {
      // On success, fetch the community experience
      try {
        const experienceData = await postJSON('/community/experience', {
          observation: variables.rawInput,
        }) as ExperienceResult
        setExperiences(experienceData)
      } catch (error) {
        // Community matching is optional; a failed community request must not
        // turn a successfully saved care situation into a failed capture.
        console.warn('Community matching is unavailable:', error)
        setExperiences(null)
      }
      onCapture?.(variables.rawInput)
    },
    onError: async (error, _variables, _context) => {
      // On error, we could show a failed state, but for simplicity we'll just let the error propagate
      // The UI will still show the text was processed optimistically
      console.error('Failed to save situation:', error)
    },
    onSettled: () => {
      // Clear the text after submission attempt
      setText('')
    },
    retry: true,
    maxRetries: 3
  })

  const handleSubmit = async () => {
    if (!text.trim()) return
    
    const caregiverId = getCaregiverId()
    if (!caregiverId || !personId || personId === 'demo-person-id') {
      setIdentityError('Sign in and link a caregiver identity before saving a care change.')
      return
    }
    setIdentityError(null)

    await submitSituation({
      caregiverId,
      personId,
      rawInput: text.trim()
    })
  }

  const clearExperiences = () => setExperiences(null)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: '16px', padding: '16px 20px', marginBottom: '24px'
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        marginBottom: experiences ? '12px' : '8px',
      }}>
        <span style={{ fontSize: '20px' }}>📝</span>
        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>
          What changed today?
        </h2>
        {experiences && (
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

      {identityError && <p role="alert" style={{ fontSize: '12px', color: 'var(--error)', marginBottom: '10px' }}>{identityError}</p>}
      <p style={{
        fontSize: '12px', color: 'var(--text-secondary)',
        marginBottom: '12px', lineHeight: 1.5
      }}>
        Capture one thing that changed — a behavior, a symptom, a moment.
        SolenOS will remember it for your next appointment and find similar experiences from other caregivers.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
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

      {experiences && (
        <div style={{
          marginTop: '16px', padding: '12px 16px',
          background: 'var(--accent-soft)', border: '1px solid var(--accent)',
          borderRadius: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <span style={{ fontSize: '14px' }}>💡</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
              Similar caregiver experiences
            </span>
            <span
              onClick={clearExperiences}
              style={{
                marginLeft: 'auto', fontSize: '11px', color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              ✕
            </span>
          </div>

          {experiences.community_pattern && (
            <p style={{ fontSize: '12px', color: 'var(--text)', marginBottom: '8px' }}>
              {experiences.community_pattern}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {experiences.matches.map(m => (
              <div key={m.post_id} style={{
                padding: '8px 12px', background: 'var(--surface)',
                borderRadius: '8px', border: '1px solid var(--border)'
              }}>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 500, color: 'var(--text)' }}>
                    {m.author_label}
                  </span>
                  {m.author_type === 'solenos_verified' && (
                    <span style={{ fontSize: '10px', color: 'var(--trust)', background: 'var(--trust-soft)', padding: '1px 6px', borderRadius: '4px' }}>
                      SolenOS verified
                    </span>
                  )}
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {m.content}
                </p>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {m.tags.map(t => (
                    <span key={t} style={{
                      fontSize: '10px', padding: '1px 6px', borderRadius: '4px',
                      background: 'var(--bg)', color: 'var(--text-secondary)',
                    }}>{t}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}