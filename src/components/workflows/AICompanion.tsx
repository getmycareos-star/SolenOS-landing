import { useState, useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { ensureAnonymousSession, postJSON, getPersonId } from '@/api/client'
import CareDeltaPanel from '@/components/CareDeltaPanel'

interface Message {
  role: 'user' | 'assistant'
  text: string
  guard_verdict?: string | null
  safety_note?: string | null
  confidence?: number | null
  evidence_ids?: string[]
  source_event_ids?: string[]
  source_evidence_ids?: string[]
  source_appointment_ids?: string[]
  ai_generated?: boolean
  written_to_lcr?: boolean
  persistence?: string
  timestamp: Date
}

const CARE_REVIEW_SIGNAL = /\b(sleep|slept|awake|wandering|wandered|sundowning|medication|medicine|dose|pill|missed|refused|pain|fall|fell|confused|agitated|agitation|behavio[u]?r|eating|drinking|hydration|appetite|appointment|doctor|nurse|hospital|toilet|continence|breathing|fever|symptom|memory|dementia|caregiver|mood|blood pressure|blood sugar|mobility|injury|rash|swelling|constipation|diarrh?ea|bowel|urine|infection|safety|unsafe|hurt|hit|shout|distress|anxiety|anxious|depressed|depression|weight|temperature)\b/i
const CASUAL_GREETING = /^(hi|hello|hey|good morning|good afternoon|good evening|how are you|thanks|thank you|ok|okay|bye|goodbye)[.!?\s]*$/i

export default function Companion() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [emergency, setEmergency] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [deltaAutoInput, setDeltaAutoInput] = useState<{ personId: string; content: string; source: string; eventDate: string; token: number } | null>(null)
  const [deltaToken, setDeltaToken] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const autoDraftSent = useRef(false)
  const personId = getPersonId()

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async (textOverride?: string) => {
    const submittedText = (textOverride ?? input).trim()
    if (!submittedText) return
    setRequestError(null)
    setLoading(true)
    setEmergency(false)

    const userMsg: Message = {
      role: 'user',
      text: submittedText,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      // Resolve the actual server-issued bearer session at send time. Do not
      // trust a render-time localStorage snapshot as identity authority.
      const session = await ensureAnonymousSession()
      const response = await postJSON('/conversation/message', {
        person_id: session.person.id,
        text: submittedText,
        session_id: sessionId,
      }) as any
      if (typeof response?.reply !== 'string' || !response.reply.trim()) throw new Error('The conversation response was incomplete.')
      setInput('')

      if (!sessionId) setSessionId(response.session_id)

      const isEmergency = response.guard_verdict === 'blocked' || response.safety_note?.includes('emergency') || response.safety_note?.includes('immediate')

      if (isEmergency) setEmergency(true)

      const assistantMsg: Message = {
        role: 'assistant',
        text: response.reply,
        guard_verdict: response.guard_verdict,
        safety_note: response.safety_note,
        confidence: response.confidence,
        evidence_ids: response.evidence_ids,
        source_event_ids: response.source_event_ids,
        source_evidence_ids: response.source_evidence_ids,
        source_appointment_ids: response.source_appointment_ids,
        ai_generated: response.ai_generated,
        written_to_lcr: response.written_to_lcr,
        persistence: response.persistence,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])

      // Automatically run the existing read-only Care Delta review for care-related
      // caregiver messages. This is an internal background action, not a workflow
      // choice exposed to the caregiver. It never promotes output into the LCR.
      if (!isEmergency && !CASUAL_GREETING.test(submittedText) && CARE_REVIEW_SIGNAL.test(submittedText)) {
        const nextToken = deltaToken + 1
        setDeltaToken(nextToken)
        setDeltaAutoInput({
          personId: session.person.id,
          content: submittedText,
          source: 'AI Companion caregiver message (automatic background review)',
          eventDate: new Date().toISOString(),
          token: nextToken,
        })
      }
    } catch (e: unknown) {
      setMessages(prev => prev.filter(message => message !== userMsg))
      setRequestError('Your message couldn’t be sent. It is still in the message box. Please try again. If you are unsure whether it went through, check the conversation before resending.')
    } finally {
      setLoading(false)
    }
  }

  // A greeting-only note is handed off here as a draft. Send it through the
  // real backend Companion/Qwen endpoint; never synthesize a local canned reply.
  useEffect(() => {
    if (autoDraftSent.current) return
    const draft = new URLSearchParams(window.location.search).get('draft')?.trim()
    if (!draft) return
    autoDraftSent.current = true
    setInput(draft)
    void sendMessage(draft)
    // Intentional one-time route handoff, not a reactive chat effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const startNewSession = () => {
    setMessages([])
    setInput('')
    setSessionId(null)
    setEmergency(false)
    setRequestError(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 170px)', minHeight: '420px', maxHeight: '900px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Companion chat</h1>
        <button
          onClick={startNewSession}
          style={{ fontSize: '14px', fontWeight: 700, color: '#172b35', background: '#ffffff', border: '2px solid #718477', borderRadius: '10px', padding: '10px 12px', minHeight: '44px', cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          New conversation
        </button>
      </div>

      {requestError && <p role="alert" style={{ color: '#3b2e11', background: '#fff4dc', border: '1px solid #c8a85d', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', lineHeight: 1.5, marginBottom: '12px' }}>{requestError}</p>}

      {emergency && (
        <div style={{
          background: '#fef2f2', border: '2px solid #dc2626',
          borderRadius: '12px', padding: '16px 20px', marginBottom: '16px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#991b1b' }}>Please check on the person</span>
          <p style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '4px' }}>
            Please check on the person now. If anyone is in immediate danger, contact local emergency services.
          </p>
        </div>
      )}

      <div style={{
        flex: 1, overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '16px',
        padding: '4px 0'
      }}>
        {messages.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
            Ask a question or share what’s happening. Your care record changes only when you choose to save an update.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: 'min(88%, 680px)',
          }}>
            <div style={{
              padding: '12px 16px', borderRadius: '16px',
              background: msg.role === 'user' ? '#e3eee6' : '#ffffff',
              color: '#172b35',
              border: '1px solid #c7d8d2',
              overflowWrap: 'anywhere',
            }}>
              <p style={{ fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.text}</p>

            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: msg.role === 'user' ? 'right' : 'left', marginTop: '4px' }}>
              {msg.role === 'user' ? 'You' : 'SolenOS'} · {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {msg.role === 'assistant' && msg.ai_generated && (
              <div
                aria-label="Response provenance"
                style={{ fontSize: '11px', lineHeight: 1.5, color: 'var(--text-secondary)', marginTop: '3px' }}
              >
                {((msg.source_event_ids?.length ?? 0) + (msg.source_evidence_ids?.length ?? 0) + (msg.source_appointment_ids?.length ?? 0)) > 0
                  ? `Context supplied: ${msg.source_event_ids?.length ?? 0} care entries, ${msg.source_evidence_ids?.length ?? 0} evidence items, ${msg.source_appointment_ids?.length ?? 0} appointments.`
                  : 'No matching care context was returned for this response.'}
                {' '}Conversation only — not added to the Living Care Record.
              </div>
            )}

          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form
        aria-label="Send a message to Companion"
        onSubmit={(event) => { event.preventDefault(); void sendMessage() }}
        style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '12px', width: '100%', minWidth: 0 }}
      >
        <textarea
          aria-label="Your message to Companion"
          value={input}
          onChange={e => {
            setInput(e.target.value)
            setRequestError(null)
          }}
          onKeyDown={handleKey}
          placeholder="Write your message…"
          disabled={loading}
          rows={Math.max(1, Math.floor(input.length / 50) + 1)}
          style={{
            flex: '1 1 auto', width: '0', minWidth: 0, boxSizing: 'border-box',
            padding: '10px 14px', borderRadius: '14px',
            background: '#ffffff', color: '#172b35', caretColor: '#172b35', fontSize: '16px', resize: 'none', outline: 'none',
            minHeight: '48px', maxHeight: '160px', border: '2px solid #718477',
            WebkitTextFillColor: '#172b35',
          }}
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={loading || !input.trim()}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            flex: '0 0 auto', minWidth: '84px', minHeight: '48px', padding: '10px 16px', borderRadius: '14px',
            border: '2px solid #8eae8a', background: loading || !input.trim() ? '#e8eee9' : '#b9d5b5', color: '#17251c',
            fontSize: '14px', fontWeight: 800, whiteSpace: 'nowrap',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: 1,
          }}
        >
          <Send size={16} aria-hidden="true" />
          {loading ? 'Sending…' : 'Send'}
        </button>
      </form>
      <CareDeltaPanel key={personId} personId={personId} autoInput={deltaAutoInput} showPanel={false} />
    </div>
  )
}
