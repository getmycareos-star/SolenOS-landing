
'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowUp, CheckCircle2, Clock3, FileText, Lightbulb, MessageCircle, Plus, ShieldCheck, Sparkles } from 'lucide-react'
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

const STARTER_PROMPTS = [
  { icon: MessageCircle, title: 'Talk through a difficult moment', description: 'Sort out what happened and what might help next.', prompt: 'Help me think through a difficult moment in care.' },
  { icon: Clock3, title: 'Make sense of a change', description: 'Separate what we know from what is still unclear.', prompt: 'Help me make sense of a recent change without jumping to conclusions.' },
  { icon: FileText, title: 'Prepare for an appointment', description: 'Organise observations and questions to take along.', prompt: 'Help me prepare clear questions for an upcoming care appointment.' },
  { icon: Lightbulb, title: 'Plan a care handoff', description: 'Explain what the next caregiver needs to know.', prompt: 'Help me organise a care handoff for another family caregiver.' },
]

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const autoDraftSent = useRef(false)
  const personId = getPersonId()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const sendMessage = async (textOverride?: string) => {
    const submittedText = (textOverride ?? input).trim()
    if (!submittedText || loading) return

    // Explicit handoff intent goes to the review workflow; do not send it as
    // ordinary chat and do not create/share anything from the Companion.
    const explicitHandoffIntent =
      /\\b(?:prepare|make|draft|organize|organise|put together|plan)\\b[\\s\\S]{0,80}\\b(?:care\\s+)?hand[ -]?off\\b|\\b(?:care\\s+)?hand[ -]?off\\b[\\s\\S]{0,60}\\b(?:for|to|prepare|make|draft)\\b/i.test(submittedText)
    if (explicitHandoffIntent && typeof window !== "undefined") {
      const lower = submittedText.toLowerCase()
      const purpose = /hospital\\s+discharge|discharge\\s+from\\s+hospital/.test(lower)
        ? "hospital_discharge"
        : /appointment|doctor|nurse|clinician|professional/.test(lower)
          ? "professional_appointment"
          : /return\\s+to\\s+care|back\\s+from/.test(lower)
            ? "return_to_care"
            : /summari[sz]e|summary|period review|last month/.test(lower)
              ? "period_summary"
              : "family_transition"
      const twoWeeks = /(?:last|past|previous)\\s+(?:two|2)\\s+weeks?/.test(lower)
      const oneWeek = /(?:last|past|previous)\\s+week/.test(lower)
      const oneMonth = /(?:last|past|previous)\\s+month/.test(lower)
      const windowDays = twoWeeks ? 14 : oneWeek ? 7 : oneMonth ? 30 : 30
      const params = new URLSearchParams({ prepare: "1", purpose, window_days: String(windowDays) })
      window.location.assign(`/workspace/handoffs?${params.toString()}`)
      return
    }

    setRequestError(null)
    setLoading(true)
    setEmergency(false)
    const userMsg: Message = { role: 'user', text: submittedText, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])

    try {
      const session = await ensureAnonymousSession()
      const response = await postJSON('/conversation/message', {
        person_id: session.person.id,
        text: submittedText,
        session_id: sessionId,
      }) as any
      if (typeof response?.reply !== 'string' || !response.reply.trim()) throw new Error('The conversation response was incomplete.')

      setInput('')
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      if (!sessionId && response.session_id) setSessionId(response.session_id)
      const safetyText = String(response.safety_note ?? '').toLowerCase()
      const isEmergency = response.guard_verdict === 'blocked' || safetyText.includes('emergency') || safetyText.includes('immediate')
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
    } catch {
      setMessages(prev => prev.filter(message => message !== userMsg))
      setRequestError('Your message could not be sent. It remains in the box below. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (autoDraftSent.current) return
    const draft = new URLSearchParams(window.location.search).get('draft')?.trim()
    if (!draft) return
    autoDraftSent.current = true
    setInput(draft)
    void sendMessage(draft)
    // One-time handoff from another workflow; not a reactive chat effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleInput = (value: string) => {
    setInput(value)
    setRequestError(null)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px'
    }
  }

  const startNewSession = () => {
    if (loading) return
    setMessages([])
    setInput('')
    setSessionId(null)
    setEmergency(false)
    setRequestError(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    textareaRef.current?.focus()
  }

  return (
    <section className="companion-shell" aria-label="SolenOS AI Companion">
      <header className="companion-topbar">
        <div className="companion-brand">
          <div className="companion-mark" aria-hidden="true"><Sparkles size={21} strokeWidth={1.8} /></div>
          <div><div className="companion-eyebrow">SOLENOS · CARE SUPPORT</div><h2>AI Companion</h2></div>
        </div>
        <button className="companion-new" type="button" onClick={startNewSession} disabled={loading}><Plus size={17} aria-hidden="true" /><span>New conversation</span></button>
      </header>

      <section className="companion-purpose">
        <div className="companion-purpose-copy">
          <span className="companion-kicker">A space to think things through</span>
          <h3>Care can be complicated.<br className="companion-desktop-break" /> You don’t have to organise it all at once.</h3>
          <p>Talk through what’s happening, organise what you know, and prepare the next conversation or handoff.</p>
        </div>
        <div className="companion-boundary"><ShieldCheck size={19} aria-hidden="true" /><div><strong>Your care record stays in your hands</strong><span>Suggestions here do not become Living Care Record facts automatically.</span></div></div>
      </section>

      {requestError && <div className="companion-error" role="alert"><span>{requestError}</span><button type="button" onClick={() => void sendMessage()} disabled={loading}>Try again</button></div>}
      {emergency && <div className="companion-emergency" role="alert"><strong>Please check on the person now.</strong><p>If anyone may be in immediate danger, contact local emergency services. This conversation cannot provide emergency response.</p></div>}

      <div className="companion-workspace">
        <main className="companion-conversation" aria-label="Conversation">
          {messages.length === 0 ? (
            <div className="companion-empty">
              <div className="companion-empty-icon"><MessageCircle size={23} strokeWidth={1.7} aria-hidden="true" /></div>
              <div className="companion-empty-heading"><span>START WHERE YOU ARE</span><h3>What’s on your mind today?</h3><p>Start with a question, a worry, or a few details. We can work through it step by step.</p></div>
              <div className="companion-starters">
                {STARTER_PROMPTS.map(item => {
                  const Icon = item.icon
                  return <button className="companion-starter" type="button" key={item.title} onClick={() => { setInput(item.prompt); setRequestError(null); textareaRef.current?.focus() }}>
                    <span className="companion-starter-icon"><Icon size={18} aria-hidden="true" /></span>
                    <span className="companion-starter-copy"><strong>{item.title}</strong><span>{item.description}</span></span>
                    <span className="companion-starter-arrow" aria-hidden="true">↗</span>
                  </button>
                })}
              </div>
              <p className="companion-empty-footnote"><CheckCircle2 size={15} aria-hidden="true" /> You can start with incomplete information. We’ll keep uncertainty visible.</p>
            </div>
          ) : (
            <div className="companion-message-list">
              <div className="companion-thread-label"><span>YOUR CONVERSATION</span><span>{messages.length} {messages.length === 1 ? 'message' : 'messages'}</span></div>
              {messages.map((msg, index) => {
                const isUser = msg.role === 'user'
                const contextCount = (msg.source_event_ids?.length ?? 0) + (msg.source_evidence_ids?.length ?? 0) + (msg.source_appointment_ids?.length ?? 0)
                return <article className={'companion-message ' + (isUser ? 'is-user' : 'is-assistant')} key={index}>
                  {!isUser && <div className="companion-avatar" aria-hidden="true"><Sparkles size={16} /></div>}
                  <div className="companion-message-body">
                    <div className="companion-message-meta"><strong>{isUser ? 'You' : 'SolenOS Companion'}</strong><time>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
                    <div className="companion-bubble"><p>{msg.text}</p></div>
                    {!isUser && msg.ai_generated && <div className="companion-provenance"><ShieldCheck size={14} aria-hidden="true" /><span>{contextCount > 0
                      ? 'Response used ' + (msg.source_event_ids?.length ?? 0) + ' care entries, ' + (msg.source_evidence_ids?.length ?? 0) + ' evidence items, and ' + (msg.source_appointment_ids?.length ?? 0) + ' appointments.'
                      : 'No matching care context was returned for this response.'} Conversation only; not added to the Living Care Record.</span></div>}
                  </div>
                </article>
              })}
              {loading && <div className="companion-message is-assistant" aria-live="polite"><div className="companion-avatar" aria-hidden="true"><Sparkles size={16} /></div><div className="companion-message-body"><div className="companion-message-meta"><strong>SolenOS Companion</strong><span>Working on a response…</span></div><div className="companion-typing" aria-label="Companion is responding"><i /><i /><i /></div></div></div>}
              <div ref={bottomRef} />
            </div>
          )}
        </main>
        <aside className="companion-side-note" aria-label="Companion guidance"><div className="companion-side-note-icon"><ShieldCheck size={18} aria-hidden="true" /></div><div><strong>Grounded, not guesswork</strong><p>The Companion can help organise observations and questions. It does not diagnose, replace a professional, or decide what becomes part of the care record.</p></div></aside>
      </div>

      <div className="companion-composer-wrap">
        <form className="companion-composer" aria-label="Send a message to Companion" onSubmit={event => { event.preventDefault(); void sendMessage() }}>
          <label className="sr-only" htmlFor="companion-message-input">Your message</label>
          <textarea id="companion-message-input" ref={textareaRef} value={input} onChange={event => handleInput(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() }
          }} placeholder="Tell me what’s happening, or ask a question…" disabled={loading} rows={2} />
          <div className="companion-composer-footer"><span className="companion-input-hint">Enter to send <span aria-hidden="true">·</span> Shift + Enter for a new line</span><button className="companion-send" type="submit" disabled={loading || !input.trim()}>{loading ? <span className="companion-send-spinner" aria-hidden="true" /> : <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />}<span>{loading ? 'Sending' : 'Send'}</span></button></div>
        </form>
        <p className="companion-footer-note">For urgent or worsening symptoms, contact an appropriate healthcare professional or emergency service.</p>
      </div>

      <CareDeltaPanel key={personId} personId={personId} autoInput={deltaAutoInput} showPanel={false} />

      <style jsx>{`
        .companion-shell { --cc-ink:#1d3028; --cc-muted:#68776e; --cc-line:#dfe8e1; width:100%; max-width:1180px; min-width:0; margin:0 auto; display:flex; flex-direction:column; gap:20px; color:var(--cc-ink); font-family:inherit; }
        .companion-topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:4px 0 16px; border-bottom:1px solid var(--cc-line); }
        .companion-brand { display:flex; align-items:center; gap:12px; min-width:0; }
        .companion-mark { display:grid; place-items:center; flex:0 0 46px; width:46px; height:46px; border:1px solid #cbdccb; border-radius:15px; background:#edf5ed; color:#365a40; }
        .companion-eyebrow { font-size:10px; letter-spacing:.14em; font-weight:800; color:#718075; margin-bottom:3px; }
        .companion-brand h2 { margin:0; font-size:clamp(20px,2.4vw,25px); letter-spacing:-.035em; line-height:1.2; font-weight:750; }
        .companion-new { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:44px; padding:10px 14px; border:1px solid #cfdbd0; border-radius:12px; color:#243c2b; background:#fff; font:inherit; font-size:13px; font-weight:700; cursor:pointer; transition:background .15s ease,border-color .15s ease; }
        .companion-new:hover { background:#f3f8f2; border-color:#a9c4aa; } .companion-new:disabled { opacity:.55; cursor:not-allowed; }
        .companion-purpose { display:grid; grid-template-columns:minmax(0,1.45fr) minmax(240px,.8fr); gap:24px; align-items:center; padding:clamp(20px,3.2vw,32px); border:1px solid #e0e9e0; border-radius:22px; background:linear-gradient(115deg,#f7faf6 0%,#f0f6ef 65%,#f5f8f3 100%); }
        .companion-purpose-copy { min-width:0; } .companion-kicker { display:block; margin-bottom:9px; color:#53745a; text-transform:uppercase; letter-spacing:.12em; font-size:10px; font-weight:850; }
        .companion-purpose h3 { margin:0; max-width:650px; font-size:clamp(22px,3vw,32px); letter-spacing:-.045em; line-height:1.18; font-weight:760; color:#20372a; }
        .companion-purpose-copy p { margin:12px 0 0; max-width:620px; font-size:14px; line-height:1.7; color:#607066; }
        .companion-boundary { display:flex; gap:11px; align-items:flex-start; padding:16px; border:1px solid #dbe6d9; border-radius:15px; background:rgba(255,255,255,.8); color:#476a4b; min-width:0; }
        .companion-boundary svg { flex:0 0 auto; margin-top:2px; } .companion-boundary strong { display:block; color:#294b31; font-size:13px; line-height:1.45; } .companion-boundary span { display:block; margin-top:5px; color:#6a796d; font-size:12px; line-height:1.55; }
        .companion-workspace { display:grid; grid-template-columns:minmax(0,1fr) 245px; gap:18px; align-items:start; min-width:0; }
        .companion-conversation { min-width:0; min-height:330px; border:1px solid var(--cc-line); border-radius:20px; background:#fff; overflow:hidden; }
        .companion-empty { padding:clamp(20px,3vw,32px); } .companion-empty-icon { display:grid; place-items:center; width:44px; height:44px; border-radius:14px; background:#eef5ed; color:#486e4b; border:1px solid #e0eade; }
        .companion-empty-heading { margin-top:20px; } .companion-empty-heading>span { color:#7b8a7d; font-size:10px; font-weight:850; letter-spacing:.14em; }
        .companion-empty-heading h3 { margin:7px 0 0; font-size:clamp(20px,2.3vw,25px); letter-spacing:-.035em; line-height:1.25; color:#25372b; }
        .companion-empty-heading p { max-width:570px; margin:8px 0 0; color:#6a786e; font-size:13px; line-height:1.65; }
        .companion-starters { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:22px; }
        .companion-starter { display:flex; align-items:flex-start; gap:11px; text-align:left; min-width:0; padding:14px; border:1px solid #e2e9e1; border-radius:14px; background:#fff; color:var(--cc-ink); cursor:pointer; font:inherit; transition:background .15s ease,border-color .15s ease,transform .15s ease; }
        .companion-starter:hover { background:#f7faf6; border-color:#b9d1b8; transform:translateY(-1px); }
        .companion-starter-icon { display:grid; place-items:center; flex:0 0 34px; width:34px; height:34px; border-radius:10px; background:#edf5ec; color:#527657; }
        .companion-starter-copy { display:block; min-width:0; flex:1; } .companion-starter-copy strong { display:block; font-size:12px; line-height:1.45; font-weight:800; }
        .companion-starter-copy>span { display:block; margin-top:4px; color:#718075; font-size:11px; line-height:1.55; } .companion-starter-arrow { color:#8a9a8a; font-size:15px; }
        .companion-empty-footnote { display:flex; align-items:center; gap:7px; margin:18px 0 0; color:#718075; font-size:11px; line-height:1.5; } .companion-empty-footnote svg { flex:0 0 auto; color:#6b8b6d; }
        .companion-message-list { padding:24px clamp(16px,3vw,30px); } .companion-thread-label { display:flex; justify-content:space-between; gap:12px; padding-bottom:14px; margin-bottom:22px; border-bottom:1px solid #edf1ed; color:#849087; font-size:10px; font-weight:800; letter-spacing:.1em; }
        .companion-thread-label span:last-child { letter-spacing:0; font-weight:600; } .companion-message { display:flex; gap:10px; align-items:flex-start; margin:0 0 22px; min-width:0; } .companion-message.is-user { justify-content:flex-end; }
        .companion-avatar { display:grid; place-items:center; flex:0 0 32px; width:32px; height:32px; border:1px solid #dce8da; border-radius:11px; background:#eef5ec; color:#4d7051; }
        .companion-message-body { min-width:0; max-width:min(88%,720px); } .companion-message.is-user .companion-message-body { max-width:min(88%,680px); }
        .companion-message-meta { display:flex; align-items:center; gap:9px; margin:0 2px 6px; color:#78857b; font-size:10px; } .companion-message-meta strong { color:#415446; font-size:11px; font-weight:800; } .companion-message-meta time { color:#929b94; }
        .companion-message.is-user .companion-message-meta { justify-content:flex-end; } .companion-bubble { padding:13px 15px; border:1px solid #e1e9e0; border-radius:4px 16px 16px 16px; background:#f8faf7; color:#26392c; overflow-wrap:anywhere; }
        .companion-message.is-user .companion-bubble { border-color:#d3e4d1; border-radius:16px 4px 16px 16px; background:#eaf3e8; }
        .companion-bubble p { margin:0; font-size:14px; line-height:1.75; white-space:pre-wrap; overflow-wrap:anywhere; }
        .companion-provenance { display:flex; align-items:flex-start; gap:6px; max-width:600px; margin:7px 2px 0; color:#7b887e; font-size:10px; line-height:1.55; } .companion-provenance svg { flex:0 0 auto; margin-top:1px; color:#7c9a7c; }
        .companion-typing { display:flex; align-items:center; gap:5px; width:max-content; padding:15px 17px; border:1px solid #e1e9e0; border-radius:4px 16px 16px 16px; background:#f8faf7; }
        .companion-typing i { display:block; width:6px; height:6px; border-radius:50%; background:#7f9a80; animation:companionPulse 1.1s ease-in-out infinite; } .companion-typing i:nth-child(2) { animation-delay:.15s; } .companion-typing i:nth-child(3) { animation-delay:.3s; }
        @keyframes companionPulse { 0%,60%,100% { opacity:.35; transform:translateY(0); } 30% { opacity:1; transform:translateY(-3px); } }
        .companion-side-note { display:flex; gap:10px; align-items:flex-start; min-width:0; padding:17px 15px; border:1px solid #e2e9e1; border-radius:17px; background:#f8faf7; }
        .companion-side-note-icon { display:grid; place-items:center; flex:0 0 34px; width:34px; height:34px; border-radius:11px; background:#eaf3e8; color:#547657; }
        .companion-side-note strong { display:block; margin:1px 0 7px; font-size:12px; line-height:1.4; color:#334c38; } .companion-side-note p { margin:0; color:#718075; font-size:11px; line-height:1.7; }
        .companion-composer-wrap { position:relative; width:100%; min-width:0; padding-top:2px; }
        .companion-composer { width:100%; padding:10px 12px 10px 16px; border:1.5px solid #cddccc; border-radius:18px; background:#fff; box-shadow:0 5px 22px rgba(35,61,39,.045); transition:border-color .15s ease,box-shadow .15s ease; }
        .companion-composer:focus-within { border-color:#8caf8d; box-shadow:0 0 0 3px rgba(151,188,151,.16); }
        .companion-composer textarea { display:block; width:100%; min-width:0; min-height:54px; max-height:180px; resize:none; padding:7px 3px 10px; border:0; outline:none; background:transparent; color:#24372a; font:inherit; font-size:15px; line-height:1.6; overflow-y:auto; }
        .companion-composer textarea::placeholder { color:#89958b; opacity:1; } .companion-composer textarea:disabled { opacity:.65; }
        .companion-composer-footer { display:flex; justify-content:space-between; align-items:center; gap:12px; padding-top:8px; border-top:1px solid #eef2ed; }
        .companion-input-hint { color:#8a968c; font-size:10px; line-height:1.4; }
        .companion-send { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-width:88px; min-height:42px; padding:9px 14px; border:1px solid #a8c6a6; border-radius:12px; background:#c7dfc4; color:#213a26; font:inherit; font-size:12px; font-weight:850; cursor:pointer; transition:background .15s ease,transform .15s ease; }
        .companion-send:hover:not(:disabled) { background:#b8d6b5; transform:translateY(-1px); } .companion-send:disabled { background:#edf2eb; border-color:#e0e7dd; color:#89958a; cursor:not-allowed; }
        .companion-send-spinner { display:block; width:14px; height:14px; border:2px solid #8ca58b; border-top-color:transparent; border-radius:50%; animation:companionSpin .7s linear infinite; } @keyframes companionSpin { to { transform:rotate(360deg); } }
        .companion-footer-note { margin:9px 4px 0; color:#89958b; text-align:center; font-size:10px; line-height:1.5; }
        .companion-error { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 14px; border:1px solid #e7c9a7; border-radius:12px; background:#fff8ef; color:#704b2c; font-size:12px; line-height:1.55; }
        .companion-error button { flex:0 0 auto; padding:7px 10px; border:1px solid #e4c5a1; border-radius:8px; background:#fff; color:#704b2c; font:inherit; font-weight:800; cursor:pointer; }
        .companion-emergency { padding:14px 16px; border:1px solid #e8b5ae; border-radius:13px; background:#fff3f1; color:#762f28; } .companion-emergency strong { display:block; font-size:13px; } .companion-emergency p { margin:5px 0 0; font-size:12px; line-height:1.6; }
        @media (max-width:860px) { .companion-purpose { grid-template-columns:minmax(0,1fr); gap:17px; } .companion-workspace { grid-template-columns:minmax(0,1fr); } .companion-side-note { order:2; } .companion-conversation { min-height:280px; } }
        @media (max-width:560px) {
          .companion-shell { gap:14px; } .companion-topbar { align-items:flex-start; gap:10px; padding-bottom:13px; } .companion-mark { flex-basis:40px; width:40px; height:40px; border-radius:13px; }
          .companion-eyebrow { font-size:9px; } .companion-brand h2 { font-size:21px; } .companion-new { width:42px; min-width:42px; padding:0; gap:0; } .companion-new span { display:none; }
          .companion-purpose { padding:19px 17px; border-radius:17px; } .companion-purpose h3 { font-size:24px; } .companion-purpose-copy p { font-size:13px; } .companion-desktop-break { display:none; }
          .companion-boundary { padding:12px; } .companion-workspace { gap:12px; } .companion-conversation { border-radius:16px; min-height:250px; } .companion-empty { padding:20px 15px; }
          .companion-empty-heading { margin-top:15px; } .companion-empty-heading h3 { font-size:21px; } .companion-starters { grid-template-columns:minmax(0,1fr); gap:8px; margin-top:17px; }
          .companion-starter { padding:11px; } .companion-starter-copy strong { font-size:12px; } .companion-starter-copy>span { font-size:11px; } .companion-empty-footnote { align-items:flex-start; font-size:10px; }
          .companion-message-list { padding:18px 12px; } .companion-message { gap:7px; margin-bottom:18px; } .companion-avatar { flex-basis:28px; width:28px; height:28px; border-radius:9px; }
          .companion-message-body,.companion-message.is-user .companion-message-body { max-width:calc(100% - 35px); } .companion-bubble { padding:11px 12px; } .companion-bubble p { font-size:14px; }
          .companion-thread-label { font-size:9px; } .companion-side-note { padding:13px; } .companion-composer { padding:8px 9px 9px 12px; border-radius:15px; }
          .companion-composer textarea { min-height:50px; font-size:16px; } .companion-input-hint { max-width:calc(100% - 98px); font-size:9px; } .companion-send { min-width:82px; min-height:42px; padding:8px 11px; } .companion-footer-note { font-size:9px; }
        }
        @media (prefers-reduced-motion:reduce) { .companion-typing i,.companion-send-spinner { animation:none; } .companion-starter,.companion-send,.companion-new { transition:none; } }
      `}</style>
    </section>
  )
}
