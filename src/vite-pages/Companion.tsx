import { useState, useRef, useEffect } from 'react'
import { postJSON, getPersonId } from '../api/client'

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
  const bottomRef = useRef<HTMLDivElement>(null)
  const personId = getPersonId()

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim()) return
    setLoading(true)
    setEmergency(false)

    const userMsg: Message = {
      role: 'user',
      text: input,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])

    try {
      const response = await postJSON('/conversation/message', {
        person_id: personId,
        text: input,
        session_id: sessionId,
      }) as any

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
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Error: ${e.message}`,
        timestamp: new Date(),
      }])
    } finally {
      setInput('')
      setLoading(false)
    }
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
            Ask SolenOS anything about care needs, behavior patterns, or to surface a concern.
            Responses are backed by local evidence and reasoning.
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
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginTop: '12px' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a message (Enter to send, Shift+Enter for new line)..."
          disabled={loading}
          rows={Math.max(1, Math.floor(input.length / 50) + 1)}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: '16px', border: '1px solid var(--border)',
            background: 'var(--surface)', fontSize: '14px', resize: 'none', outline: 'none',
            minHeight: '40px', maxHeight: '120px',
          }}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 20px', borderRadius: '16px', border: 'none',
            background: loading || !input.trim() ? 'var(--text-secondary)' : 'var(--trust)',
            color: 'white', fontSize: '13px', cursor: loading || !input.trim() ? 'default' : 'pointer',
          }}
        >
          {loading ? '...' : 'Send'}
        </button>
      </div>
    </div>
  )
}
