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
  timestamp: Date
}

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
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])
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

  const compareMessageWithRecord = (message: string) => {
    const nextToken = deltaToken + 1
    setDeltaToken(nextToken)
    setDeltaAutoInput({
      personId,
      content: message,
      source: 'AI Companion caregiver message (explicitly selected for LCR reconciliation)',
      eventDate: new Date().toISOString(),
      token: nextToken,
    })
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const startNewSession = () => {
    setMessages([])
    setSessionId(null)
    setEmergency(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Companion chat</h1>
        <button
          onClick={startNewSession}
          style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'none', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer' }}
        >
          New conversation
        </button>
      </div>

      {requestError && <p role="alert" style={{ color: 'var(--error)', fontSize: '13px', marginBottom: '12px' }}>{requestError}</p>}

      {emergency && (
        <div style={{
          background: '#fef2f2', border: '2px solid #dc2626',
          borderRadius: '12px', padding: '16px 20px', marginBottom: '16px'
        }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626' }}>⚠️ Attention requested</span>
          <p style={{ fontSize: '12px', color: '#7f1d1d', marginTop: '4px' }}>
            The safety engine flagged this exchange. Review the conversation and check on the person.
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
            Ask a question or share what is happening. Replies may be unavailable sometimes; your care record is only updated when you choose to save information.
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '70%',
          }}>
            <div style={{
              padding: '12px 16px', borderRadius: '16px',
              background: msg.role === 'user' ? 'var(--accent-soft)' : 'var(--surface)',
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
              {msg.safety_note && (
                <p style={{ fontSize: '11px', color: '#dc2626', marginTop: '6px', fontStyle: 'italic' }}>
                  Safety: {msg.safety_note}
                </p>
              )}
              {msg.guard_verdict && msg.guard_verdict !== 'passed' && (
                <p style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                  Guard: {msg.guard_verdict}
                </p>
              )}
              {msg.confidence !== undefined && msg.confidence !== null && (
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Confidence: {Math.round(msg.confidence * 100)}%
                </p>
              )}
              {msg.evidence_ids && msg.evidence_ids.length > 0 && (
                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Evidence: {msg.evidence_ids.slice(0, 3).join(', ')}{msg.evidence_ids.length > 3 && ' ...'}
                </p>
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: msg.role === 'user' ? 'right' : 'left', marginTop: '4px' }}>
              {msg.role === 'user' ? 'You' : 'SolenOS'} · {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {msg.role === 'user' && <button
              type="button"
              onClick={() => compareMessageWithRecord(msg.text)}
              style={{ marginTop: 5, fontSize: 11, color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 8px', cursor: 'pointer' }}
            >Compare this report with the Living Care Record</button>}
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
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Write your message…"
          disabled={loading}
          rows={Math.max(1, Math.floor(input.length / 50) + 1)}
          style={{
            flex: '1 1 auto', width: '0', minWidth: 0, boxSizing: 'border-box',
            padding: '10px 14px', borderRadius: '14px', border: '1px solid var(--border)',
            background: 'var(--surface)', color: 'var(--text)', fontSize: '14px', resize: 'none', outline: 'none',
            minHeight: '44px', maxHeight: '120px',
          }}
        />
        <button
          type="submit"
          aria-label="Send message"
          disabled={loading || !input.trim()}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            flex: '0 0 auto', minHeight: '44px', padding: '10px 16px', borderRadius: '14px',
            border: '1px solid var(--trust)', background: 'var(--trust)', color: '#fff',
            fontSize: '14px', fontWeight: 700, whiteSpace: 'nowrap',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.65 : 1,
          }}
        >
          <Send size={16} aria-hidden="true" />
          {loading ? 'Sending…' : 'Send'}
        </button>
      </form>
      <CareDeltaPanel key={personId} personId={personId} autoInput={deltaAutoInput} />
    </div>
  )
}
