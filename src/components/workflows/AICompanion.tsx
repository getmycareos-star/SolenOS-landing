
'use client'

import { useState, useRef, useEffect } from 'react'
import { ArrowUp, CheckCircle2, Clock3, FileText, Lightbulb, MessageCircle, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { ensureAnonymousSession, postJSON, getPersonId } from '@/api/client'
import { isEmergencyCompanionResponse } from '@/lib/companion-safety'

const CASUAL_GREETING = /^(?:hi|hello|hey|hiya|howdy|how are you(?: doing| today)?|how'?s it going|what'?s up|good morning|good afternoon|good evening|good night|thanks|thank you(?: so much)?|bye|goodbye|see you)[.!?,;:]*$/i

interface ClaimSourceReference {
  record_type: string
  record_id: string
  label: string
  matched_passage?: string
  source_excerpt?: string
  occurred_at?: string | null
  recorded_at?: string | null
  reported_by?: string | null
  entered_by?: string | null
  record_status?: string | null
  source_independence_status?: string | null
  exact_wording_duplicate_count?: number
  source_state_label?: string | null
  correction_note?: string | null
  correction_rationale?: string | null
  previous_source_excerpt?: string | null
  related_evidence_ids?: string[]
  related_evidence?: Array<{
    label: string
    record_id: string
    source_excerpt: string
    occurred_at?: string | null
    recorded_at?: string | null
    reported_by?: string | null
    entered_by?: string | null
    record_status?: string | null
    source_independence_status?: string | null
    exact_wording_duplicate_count?: number
    observations?: Array<{
      label?: string
      attribute?: string
      value?: string | null
      occurred_at?: string | null
      recorded_at?: string | null
      reported_by?: string | null
      source_excerpt?: string | null
    }>
  }>
}

interface ClaimProvenance {
  coverage: string
  matching_limit?: string
  claims: Array<{
    claim_id: string
    text: string
    support_status: string
    validation_basis?: string
    aggregate?: { topic?: string; window_label?: string; count?: number; candidate_count?: number } | null
    aggregate_review?: { status?: string; count?: number | null; interpretation_limit?: string } | null
    source_references: ClaimSourceReference[]
  }>
}

const SOURCE_REFERENCE_LABELS: Record<string, string> = {
  document_extractions: 'Extracted document text',
  care_evidence: 'Original uploaded source',
  events: 'Recorded care event',
  care_events: 'Recorded care event',
  assertions: 'Care record assertion',
  care_assertions: 'Care record assertion',
  conversation_messages: 'Prior Companion message',
  companion_messages: 'Prior Companion message',
}

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
  source_assertion_ids?: string[]
  source_lcr_context_ids?: string[]
  source_freshness_assessment_ids?: string[]
  freshness_source_status?: string
  source_record_refs?: Array<{ record_type: string; record_id: string }>
  claim_provenance?: ClaimProvenance
  ai_generated?: boolean
  written_to_lcr?: boolean
  persistence?: string
  timestamp: Date
}

const STARTER_PROMPTS = [
  { icon: MessageCircle, title: 'I need to talk it through', description: 'One thing at a time. No need to organise it first.', prompt: "I'm overwhelmed. Help me work through one thing at a time." },
  { icon: Clock3, title: 'Something has changed', description: 'Sort what is known from what is still unclear.', prompt: 'Something has changed in care. Help me work out what we know and what is unclear.' },
  { icon: FileText, title: 'Help me get ready', description: 'Prepare a few questions for a visit or handover.', prompt: 'Help me prepare for an upcoming care appointment or handover.' },
]

export default function Companion({ home = false, initialPrompt = null }: { home?: boolean; initialPrompt?: string | null }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [emergency, setEmergency] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingTurnId = useRef<string | null>(null)
  const pendingTurnText = useRef<string | null>(null)
  const autoDraftSent = useRef(false)
  const personId = getPersonId()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const sendMessage = async (textOverride?: string) => {
    const submittedText = (textOverride ?? input).trim()
      if (!submittedText || loading) return
    setRequestError(null)
    setLoading(true)
    setEmergency(false)
    if (!pendingTurnId.current || pendingTurnText.current !== submittedText) {
      pendingTurnId.current = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'turn-' + Date.now() + '-' + Math.random().toString(36).slice(2)
      pendingTurnText.current = submittedText
    }
    const clientTurnId = pendingTurnId.current
    const userMsg: Message = { role: 'user', text: submittedText, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])

    try {
      const session = await ensureAnonymousSession()
      const response = await postJSON('/conversation/message', {
        person_id: session.person.id,
        text: submittedText,
        session_id: sessionId,
        client_turn_id: clientTurnId,
      }) as any
      if (typeof response?.reply !== 'string' || !response.reply.trim()) throw new Error('The conversation response was incomplete.')

      setInput('')
      pendingTurnId.current = null
      pendingTurnText.current = null
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      if (!sessionId && response.session_id) setSessionId(response.session_id)
      const isEmergency = isEmergencyCompanionResponse(response)
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
        source_assertion_ids: response.source_assertion_ids,
        source_lcr_context_ids: response.source_lcr_context_ids,
        source_freshness_assessment_ids: response.source_freshness_assessment_ids,
        freshness_source_status: response.freshness_source_status,
        source_record_refs: response.source_record_refs,
        claim_provenance: response.claim_provenance,
        ai_generated: response.ai_generated,
        written_to_lcr: response.written_to_lcr,
        persistence: response.persistence,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, assistantMsg])


    } catch {
      setMessages(prev => prev.filter(message => message !== userMsg))
      setInput(submittedText)
      setRequestError('Your message could not be sent. It remains in the box below. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }


  useEffect(() => {
    const prompt = initialPrompt?.trim()
    if (!prompt) return
    setInput(prompt)
    setRequestError(null)
    const params = new URLSearchParams(window.location.search)
    params.delete('prompt')
    const remainingQuery = params.toString()
    const nextUrl = window.location.pathname + (remainingQuery ? '?' + remainingQuery : '') + window.location.hash
    window.history.replaceState({}, '', nextUrl)
  }, [initialPrompt])

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
    if (pendingTurnText.current !== null && value.trim() !== pendingTurnText.current) { pendingTurnId.current = null; pendingTurnText.current = null }
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
    pendingTurnId.current = null
    pendingTurnText.current = null
    setEmergency(false)
    setRequestError(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    textareaRef.current?.focus()
  }

  return (
    <section className={`companion-shell${home ? " is-home" : ""}`} aria-label="SolenOS AI Companion">
      <header className="companion-topbar">
        <div className="companion-brand">
          <div className="companion-mark" aria-hidden="true"><Sparkles size={21} strokeWidth={1.8} /></div>
          <div><div className="companion-eyebrow">HERE WHEN YOU NEED A HAND</div><h2>Your care companion</h2></div>
        </div>
        {messages.length > 0 && <button className="companion-new" type="button" onClick={startNewSession} disabled={loading}><Plus size={17} aria-hidden="true" /><span>New conversation</span></button>}
      </header>

      {requestError && <div className="companion-error" role="alert"><span>{requestError}</span><button type="button" onClick={() => void sendMessage()} disabled={loading}>Try again</button></div>}
      {emergency && <div className="companion-emergency" role="alert"><strong>Please check on the person now.</strong><p>If anyone may be in immediate danger, contact local emergency services. This conversation cannot provide emergency response.</p></div>}

      <div className="companion-workspace">
        <main className="companion-conversation" aria-label="Conversation">
          {messages.length === 0 ? (
            <div className="companion-empty">
              <div className="companion-empty-icon"><MessageCircle size={23} strokeWidth={1.7} aria-hidden="true" /></div>
              <div className="companion-empty-heading"><span>A PLACE TO START</span><h3>You don’t have to figure it all out right now.</h3><p>Tell me one small thing about today. A few words are enough. We can take it one step at a time.</p></div>
              <div className="companion-starters">
                {STARTER_PROMPTS.map(item => {
                  const Icon = item.icon
                  return <button className="companion-starter" type="button" key={item.title} onClick={() => { void sendMessage(item.prompt) }}>
                    <span className="companion-starter-icon"><Icon size={18} aria-hidden="true" /></span>
                    <span className="companion-starter-copy"><strong>{item.title}</strong><span>{item.description}</span></span>
                    <span className="companion-starter-arrow" aria-hidden="true">↗</span>
                  </button>
                })}
              </div>
              <p className="companion-empty-footnote"><CheckCircle2 size={15} aria-hidden="true" /> You do not need all the details. I’ll help keep facts and unknowns separate.</p>
            </div>
          ) : (
            <div className="companion-message-list">
              <div className="companion-thread-label"><span>YOUR CONVERSATION</span><span>{messages.length} {messages.length === 1 ? 'message' : 'messages'}</span></div>

              {messages.map((msg, index) => {
                const isUser = msg.role === 'user'
                return <article className={'companion-message ' + (isUser ? 'is-user' : 'is-assistant')} key={index}>
                  {!isUser && <div className="companion-avatar" aria-hidden="true"><Sparkles size={16} /></div>}
                  <div className="companion-message-body">
                    <div className="companion-message-meta"><strong>{isUser ? 'You' : 'SolenOS Companion'}</strong><time>{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time></div>
                    <div className="companion-bubble"><p>{msg.text}</p></div>
                    {!isUser && msg.ai_generated && (msg.source_record_refs?.length ?? 0) > 0 && <section className="companion-provenance" aria-label="Selected saved sources">
                      <strong>Selected saved sources</strong>
                      {msg.source_record_refs?.map((reference, referenceIndex) => (
                        <div key={reference.record_type + ':' + reference.record_id + ':' + referenceIndex}>
                          <strong>{SOURCE_REFERENCE_LABELS[reference.record_type] || reference.record_type.replaceAll('_', ' ')}</strong>
                          {reference.record_type === 'document_extractions' && <p>Extracted document text is context only, not yet an LCR assertion. Review and accept a candidate in Documents before it becomes a caregiver-reviewed LCR assertion.</p>}
                          {(reference.record_type === 'conversation_messages' || reference.record_type === 'companion_messages') && <p>Prior Companion message — conversation context only. It is not care evidence.</p>}
                        </div>
                      ))}
                    </section>}
                    {!isUser && msg.ai_generated && msg.claim_provenance && <section className="companion-provenance" aria-label="Sources for this answer">
                      <strong>What this answer is based on</strong>
                      <p>Each statement is checked against the wording in saved records. A match does not prove that a report is true or that two records came from different people.</p>
                      <p><strong>Supporting source details</strong></p>
                      {msg.claim_provenance.claims.map(claim => (
                        <article key={claim.claim_id} className="companion-provenance-details">
                          <p><strong>{claim.text}</strong></p>
                          {claim.support_status === 'aggregate_count_mismatch' && <p role="note">The saved care updates do not support this number. The count check found {claim.aggregate_review?.count ?? 'an unconfirmed number'} distinct updates in the requested time window.</p>}
                          {claim.support_status === 'aggregate_not_validated' && <p role="note">{claim.aggregate_review?.interpretation_limit || 'This total could not be confirmed from the saved care updates. Check the reports before relying on a number.'}</p>}
                          {(claim.support_status === 'matched_saved_wording' || claim.support_status === 'matched_historical_only' || claim.support_status === 'matched_validated_aggregate') ? (
                            <div>
                              <p> <ShieldCheck size={14} aria-hidden="true" /> {claim.support_status === 'matched_historical_only' ? 'This wording appears in an earlier or corrected record. It is not treated as current information.' : claim.support_status === 'matched_validated_aggregate' ? 'This count was checked against distinct, dated care updates.' : 'This wording appears in a saved record.'}</p>
                              {claim.support_status === 'matched_validated_aggregate' && <p>Counted {claim.aggregate?.count ?? claim.source_references.length} distinct care updates{claim.aggregate?.window_label ? ' during ' + claim.aggregate.window_label : ''}. Repeated records were not counted twice.</p>}
                              {claim.source_references.map((source, sourceIndex) => (
                                <div key={source.record_type + ':' + source.record_id + ':' + sourceIndex}>
                                  <strong>{source.label}</strong>
                                  {source.occurred_at && <p>When it happened: {new Date(source.occurred_at).toLocaleString()}</p>}
                                  {source.recorded_at && <p>When it was added: {new Date(source.recorded_at).toLocaleString()}</p>}
                                  {source.reported_by && <p>Reported by: {source.reported_by}</p>}
                                  {source.entered_by && <p>{source.entered_by}</p>}
                                  {source.source_state_label && <p>{source.source_state_label}</p>}
                                  {source.correction_note && <p>{source.correction_note}</p>}
                                  {source.correction_rationale && <p>Why it was corrected: {source.correction_rationale}</p>}
                                  {source.previous_source_excerpt && <blockquote>Earlier wording: {source.previous_source_excerpt}</blockquote>}
                                  {source.source_independence_status === 'shared_origin' && <p>This source shares its original with another saved record. It is not a separate report.</p>}
                                  {source.source_independence_status === 'independent' && <p>A caregiver review marks this as a separate report.</p>}
                                  {source.source_independence_status === 'not_assessed' && <p>Whether this source is separate from other reports has not been checked.</p>}
                                  {(source.exact_wording_duplicate_count ?? 0) > 0 && <p>The same wording appears in {source.exact_wording_duplicate_count} other saved record(s). Do not count these as separate reports.</p>}
                                  {source.source_excerpt && <blockquote>{source.source_excerpt}</blockquote>}
                                  {(source.related_evidence?.length ?? 0) > 0 && <div>
                                    <strong>Supporting note or document</strong>
                                    {source.related_evidence?.map((item, itemIndex) => <div key={item.record_id + ':' + itemIndex}>
                                      <p>{item.label}</p>
                                      {item.reported_by && <p>Reported by: {item.reported_by}</p>}
                                      {item.entered_by && <p>Added by: {item.entered_by}</p>}
                                      {item.source_independence_status === 'shared_origin' && <p>This note shares its original with another saved record. It is not a separate report.</p>}
                                      {item.source_independence_status === 'independent' && <p>A caregiver review marks this as a separate report.</p>}
                                      {item.source_independence_status === 'not_assessed' && <p>Whether this note is separate from other reports has not been checked.</p>}
                                      {(item.exact_wording_duplicate_count ?? 0) > 0 && <p>The same wording appears in {item.exact_wording_duplicate_count} other saved record(s). Do not count these as separate reports.</p>}
                                      {item.occurred_at && <p>When it happened: {new Date(item.occurred_at).toLocaleString()}</p>}
                                      {item.recorded_at && <p>When it was added: {new Date(item.recorded_at).toLocaleString()}</p>}
                                      {item.source_excerpt && <blockquote>{item.source_excerpt}</blockquote>}
                                      {item.observations?.map((observation, observationIndex) => <div key={"source-observation-" + observationIndex}>
                                        <p>{observation.label || "Recorded detail"}: {observation.value || observation.attribute || "Details not supplied"}</p>
                                        {observation.reported_by && <p>Reported by: {observation.reported_by}</p>}
                                        {observation.occurred_at && <p>When it happened: {new Date(observation.occurred_at).toLocaleString()}</p>}
                                        {observation.source_excerpt && <blockquote>{observation.source_excerpt}</blockquote>}
                                      </div>)}
                                    </div>)}
                                  </div>}
                                </div>
                              ))}
                            </div>
                          ) : claim.support_status === 'not_matched_to_saved_wording' ? <p role="note">Not matched to the wording in a saved record. Check this statement before relying on it.</p> : null}
                        </article>
                      ))}
                      <p>Conversation only. Nothing in this answer was added to the Living Care Record.</p>
                    </section>}
                    {!isUser && msg.freshness_source_status === 'unavailable_schema' && <p className="companion-provenance" role="status">Freshness assessment storage is unavailable in this schema. A review of how current these records are is not available. Their currentness is unknown.</p>}
                    {!isUser && msg.freshness_source_status === 'no_assessments_returned' && <p className="companion-provenance" role="status">No freshness assessments were returned. No review of how current these records are was returned. This does not mean they are current.</p>}
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
          }} placeholder="What’s happening today? A few words are enough…" disabled={loading} rows={2} />
          <div className="companion-composer-footer">
            <span className="companion-input-hint">Enter to send <span aria-hidden="true">·</span> Shift + Enter for a new line</span><button className="companion-send" type="submit" disabled={loading || !input.trim()}>{loading ? <span className="companion-send-spinner" aria-hidden="true" /> : <ArrowUp size={18} strokeWidth={2.4} aria-hidden="true" />}<span>{loading ? 'Sending' : 'Send'}</span></button></div>
        </form>
        <p className="companion-footer-note">For urgent or worsening symptoms, contact an appropriate healthcare professional or emergency service.</p>
      </div>



      <style jsx>{`
        .companion-handoff { border:1px solid #dfe8e1; border-radius:20px; padding:clamp(18px,2.8vw,26px); background:#fff; }
        .companion-handoff-heading { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
        .companion-handoff-icon { display:grid; place-items:center; flex:0 0 44px; width:44px; height:44px; border:1px solid #d8e5d6; border-radius:14px; background:#edf5ec; color:#456b49; }
        .companion-handoff-copy { flex:1; min-width:190px; }
        .companion-handoff-copy .companion-kicker { margin-bottom:5px; }
        .companion-handoff-copy h3 { margin:0; color:#25372b; font-size:clamp(17px,2vw,21px); line-height:1.3; letter-spacing:-.025em; }
        .companion-handoff-copy p { margin:5px 0 0; color:#6a786e; font-size:13px; line-height:1.55; }
        .companion-handoff-primary,.companion-handoff-close,.companion-handoff-back { display:inline-flex; align-items:center; justify-content:center; gap:7px; min-height:42px; padding:10px 14px; border:1px solid #cbdcc9; border-radius:12px; background:#e7f0e5; color:#203b27; font:inherit; font-size:13px; font-weight:750; cursor:pointer; }
        .companion-handoff-primary:hover { background:#dcebd9; border-color:#a9c7a8; }
        .companion-handoff-close,.companion-handoff-back { background:#fff; color:#526457; }
        .companion-handoff-close:hover,.companion-handoff-back:hover { background:#f5f8f4; }
        .companion-handoff-step { margin-top:22px; padding-top:20px; border-top:1px solid #e8eee7; }
        .companion-handoff-step h4 { margin:0; color:#25372b; font-size:17px; letter-spacing:-.02em; }
        .companion-handoff-step>p,.companion-handoff-step-top p { margin:5px 0 0; color:#6a786e; font-size:13px; line-height:1.55; }
        .companion-handoff-options { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; margin-top:16px; }
        .companion-handoff-option { display:flex; align-items:center; gap:12px; min-width:0; padding:16px; text-align:left; border:1px solid #e0e9df; border-radius:15px; background:#fff; color:#25372b; font:inherit; cursor:pointer; transition:background .15s ease,border-color .15s ease; }
        .companion-handoff-option:hover { background:#f6faf5; border-color:#b9d1b8; }
        .companion-handoff-option-icon,.companion-handoff-purpose-icon { display:grid; place-items:center; flex:0 0 38px; width:38px; height:38px; border-radius:11px; background:#edf5ec; color:#527657; }
        .companion-handoff-option>span:nth-child(2) { flex:1; min-width:0; }
        .companion-handoff-option strong,.companion-handoff-purpose strong { display:block; color:#25372b; font-size:13px; line-height:1.45; }
        .companion-handoff-option small,.companion-handoff-purpose small { display:block; margin-top:4px; color:#718075; font-size:11px; line-height:1.55; font-weight:450; }
        .companion-handoff-arrow { color:#789079; font-size:19px; }
        .companion-handoff-recipient { display:block; margin-bottom:5px; color:#7b8a7d; font-size:9px; font-weight:850; letter-spacing:.13em; }
        .companion-handoff-step-top { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .companion-handoff-purpose-options { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:16px; }
        .companion-handoff-purpose { display:flex; flex-direction:column; align-items:flex-start; gap:7px; min-width:0; min-height:158px; padding:15px; text-align:left; border:1px solid #e0e9df; border-radius:15px; background:#fff; color:#25372b; font:inherit; cursor:pointer; transition:background .15s ease,border-color .15s ease,box-shadow .15s ease; }
        .companion-handoff-purpose:hover { background:#f7faf6; border-color:#b9d1b8; }
        .companion-handoff-purpose.is-selected { border-color:#7ea47d; background:#f0f7ee; box-shadow:0 0 0 2px rgba(111,151,109,.12); }
        .companion-handoff-selection { margin-top:14px !important; padding:11px 13px; border-radius:11px; background:#f3f7f1; color:#4c674e !important; font-size:12px !important; }
        .companion-handoff-prepare { display:flex; align-items:flex-start; flex-direction:column; gap:10px; margin-top:12px; }
        .companion-handoff-error { color:#9b2c2c !important; font-size:13px !important; }
        .companion-handoff-draft { display:flex; flex-direction:column; gap:14px; margin-top:20px; padding:16px; border:1px solid #dce7dc; border-radius:16px; background:#fbfdfb; }
        .companion-handoff-draft-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .companion-handoff-draft-heading h4 { margin:0; font-size:18px; color:#24372a; }
        .companion-handoff-draft-heading p { margin:5px 0 0; font-size:12px; color:#6a786e; }
        .companion-handoff-draft-warning { margin:0; padding:12px; border-radius:10px; background:#f4f7f1; color:#4e6250; font-size:12px; line-height:1.65; }
        .companion-handoff-draft-boundary { display:flex; align-items:flex-start; gap:8px; color:#426849; font-size:12px; line-height:1.5; }
        .companion-handoff-draft-boundary svg { flex:0 0 auto; }
        .companion-handoff-empty-source { margin:0; color:#6b786e; font-size:13px; line-height:1.6; }
        .companion-handoff-source-section { display:flex; flex-direction:column; gap:8px; padding-top:12px; border-top:1px solid #e5ece4; }
        .companion-handoff-source-section h5 { margin:0; color:#293b2e; font-size:13px; }
        .companion-handoff-section-note { margin:0; color:#6a786e; font-size:11px; line-height:1.5; }
        .companion-handoff-source-item { padding:12px; border:1px solid #e4ebe2; border-radius:11px; background:#fff; }
        .companion-handoff-source-item p { margin:0; color:#34463a; font-size:13px; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }
        .companion-handoff-source-meta { display:flex; flex-wrap:wrap; gap:6px 12px; margin-top:8px; color:#748075; font-size:10px; line-height:1.5; overflow-wrap:anywhere; }
        .companion-handoff-source-meta strong { color:#8b5c1c; }
        .companion-handoff-template-section { padding:8px 0; border-bottom:1px solid #edf1eb; }
        .companion-handoff-template-section .companion-handoff-coverage-row { border-bottom:0; }
        .companion-handoff-coverage-row { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:9px 0; border-bottom:1px solid #edf1eb; }
        .companion-handoff-coverage-row>span:first-child { min-width:0; }
        .companion-handoff-coverage-row strong,.companion-handoff-coverage-row small { display:block; overflow-wrap:anywhere; }
        .companion-handoff-coverage-row strong { color:#34463a; font-size:12px; }
        .companion-handoff-coverage-row small { margin-top:3px; color:#748075; font-size:10px; }
        .companion-handoff-status { flex:0 0 auto; padding:4px 7px; border-radius:8px; background:#edf2ec; color:#4d654f; font-size:10px; text-transform:capitalize; }
        .companion-handoff-status.status-unavailable,.companion-handoff-status.status-not_authorized { background:#f8eee5; color:#87552c; }
        .companion-handoff-status.status-empty { background:#f2f3ef; color:#687368; }
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
        .companion-provenance { display:flex; align-items:flex-start; gap:6px; max-width:600px; margin:7px 2px 0; color:#7b887e; font-size:10px; line-height:1.55; } .companion-provenance svg { flex:0 0 auto; margin-top:1px; color:#7c9a7c; } .companion-provenance-details { margin:5px 2px 0; max-width:600px; color:var(--text-secondary); font-size:11px; } .companion-provenance-details summary { cursor:pointer; } .companion-provenance-details ul { margin:5px 0 0; padding-left:18px; } .companion-provenance-details li { margin:4px 0; overflow-wrap:anywhere; } .companion-provenance-details code { font-size:10px; }
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
        @media (max-width:760px) { .companion-handoff-options { grid-template-columns:1fr; } .companion-handoff-purpose-options { grid-template-columns:1fr; } .companion-handoff-purpose { min-height:0; } .companion-handoff-primary { width:100%; } }
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

         .companion-shell.is-home { width:100%; max-width:860px; height:100%; min-height:0; gap:0; padding:0 0 10px; }
        .companion-shell.is-home .companion-topbar { flex:0 0 auto; padding:10px 4px 16px; border-bottom:1px solid #edf1ed; }
        .companion-shell.is-home .companion-mark { width:34px; height:34px; flex-basis:34px; border-radius:11px; }
        .companion-shell.is-home .companion-brand h2 { font-size:18px; font-weight:650; letter-spacing:-.02em; }
        .companion-shell.is-home .companion-eyebrow { font-size:9px; letter-spacing:.09em; }
        .companion-shell.is-home .companion-new { min-height:38px; padding:8px 11px; border-radius:999px; background:#f7faf6; }
        .companion-shell.is-home .companion-workspace { display:block; flex:1 1 auto; min-height:0; margin:0; }
        .companion-shell.is-home .companion-conversation { height:100%; min-height:0; border:0; border-radius:0; background:transparent; overflow-y:auto; }
         .companion-shell.is-home .companion-empty { max-width:840px; margin:0 auto; padding:clamp(32px,7vh,72px) 22px 30px; }
        .companion-shell.is-home .companion-empty-icon { width:42px; height:42px; border-radius:50%; }
        .companion-shell.is-home .companion-empty-heading { margin-top:18px; }
        .companion-shell.is-home .companion-empty-heading h3 { max-width:700px; font-size:clamp(26px,3.5vw,34px); font-weight:600; letter-spacing:-.035em; line-height:1.16; }
        .companion-shell.is-home .companion-empty-heading p { max-width:650px; font-size:16px; line-height:1.7; }
        .companion-shell.is-home .companion-starters { grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:24px; }
        .companion-shell.is-home .companion-starter { min-height:104px; padding:16px; border-radius:14px; box-shadow:none; }
        .companion-shell.is-home .companion-starter-copy strong { font-size:14px; line-height:1.4; }
        .companion-shell.is-home .companion-starter-copy>span { font-size:13px; line-height:1.55; }
        .companion-shell.is-home .companion-starter:focus-visible { outline:3px solid #8caf8d; outline-offset:3px; }
         .companion-shell.is-home .companion-message-list { max-width:760px; margin:0 auto; padding:30px 22px 42px; }
        .companion-shell.is-home .companion-message { margin-bottom:25px; }
         .companion-shell.is-home .companion-message.is-assistant .companion-bubble { border:0; border-radius:0; background:transparent; padding:2px 0; }
        .companion-shell.is-home .companion-message.is-user .companion-bubble { border:0; border-radius:18px; background:#f1f2ef; padding:12px 16px; }
        .companion-shell.is-home .companion-composer-wrap { flex:0 0 auto; width:min(100%,860px); margin:0 auto; padding:0 12px; }
        .companion-shell.is-home .companion-composer { border:1px solid #d7dfd6; border-radius:24px; padding:10px 12px 10px 16px; box-shadow:0 3px 18px rgba(30,50,35,.055); }
        .companion-shell.is-home .companion-composer textarea { min-height:52px; max-height:190px; font-size:16px; }
        .companion-shell.is-home .companion-composer-footer { border-top:0; padding-top:3px; }
        .companion-shell.is-home .companion-send { min-width:42px; width:42px; height:42px; min-height:42px; padding:0; border-radius:50%; }
        .companion-shell.is-home .companion-send span:last-child { display:none; }
        .companion-shell.is-home .companion-footer-note { margin:9px 0 0; font-size:11px; line-height:1.55; }
        .companion-shell.is-home .companion-empty { min-height:100%; display:flex; flex-direction:column; justify-content:center; padding-top:clamp(22px,5vh,54px); padding-bottom:clamp(22px,5vh,54px); }
        .companion-shell.is-home .companion-empty-heading h3 { max-width:660px; color:#24352a; }
        .companion-shell.is-home .companion-empty-heading p { max-width:590px; color:#647267; }
        .companion-shell.is-home .companion-starter { min-height:116px; border:1px solid #e0e8de; background:#fff; box-shadow:0 3px 14px rgba(35,55,39,.035); transition:border-color .16s ease,background .16s ease,transform .16s ease; }
        .companion-shell.is-home .companion-starter:hover { border-color:#b9cfb5; background:#fbfdf9; transform:translateY(-1px); }
        .companion-shell.is-home .companion-starter-copy strong { color:#2c4031; font-size:14px; }
        .companion-shell.is-home .companion-starter-copy>span { color:#718074; }
        .companion-shell.is-home .companion-composer { border:1px solid #d5e0d3; border-radius:22px; padding:12px 14px 11px 17px; box-shadow:0 8px 28px rgba(36,57,39,.07); }
        .companion-shell.is-home .companion-composer:focus-within { border-color:#a5c2a1; box-shadow:0 0 0 4px rgba(166,194,161,.16),0 8px 28px rgba(36,57,39,.06); }
        .companion-shell.is-home .companion-composer textarea { min-height:58px; font-size:16px; line-height:1.65; }
        .companion-shell.is-home .companion-send { background:#c7dfc4; border-color:#a9c7a6; color:#203927; }
        .companion-shell.is-home .companion-input-hint { font-size:11px; color:#7c897d; }
        .companion-add-wrap { position:relative; }
        .companion-add-button { display:grid; place-items:center; width:38px; height:38px; border:1px solid #dce5da; border-radius:50%; background:#f7faf6; color:#314d36; cursor:pointer; }
        .companion-add-button:hover { background:#edf5eb; }
        .companion-add-menu { position:absolute; z-index:40; left:0; bottom:calc(100% + 10px); width:min(320px,calc(100vw - 48px)); padding:7px; border:1px solid #e0e7df; border-radius:16px; background:#fff; box-shadow:0 14px 40px rgba(25,45,30,.14); }
        .companion-add-menu button { display:flex; align-items:center; gap:11px; width:100%; padding:11px 10px; border:0; border-radius:10px; background:transparent; text-align:left; color:#25372b; cursor:pointer; }
        .companion-add-menu button:hover { background:#f4f8f3; }
        .companion-add-icon { display:grid; place-items:center; flex:0 0 34px; width:34px; height:34px; border-radius:10px; background:#edf5ec; color:#547657; }
        .companion-add-menu strong { display:block; font-size:13px; font-weight:700; }
        .companion-add-menu small { display:block; margin-top:3px; color:#748077; font-size:11px; line-height:1.4; }
        @media(max-width:600px) {
          .companion-shell.is-home .companion-topbar { padding:6px 2px 12px; }
          .companion-shell.is-home .companion-empty { padding:26px 10px 18px; }
          .companion-shell.is-home .companion-starters { grid-template-columns:1fr; gap:9px; margin-top:18px; }
          .companion-shell.is-home .companion-starter { min-height:76px; padding:13px 14px; }
          .companion-shell.is-home .companion-empty-heading h3 { font-size:26px; }
          .companion-shell.is-home .companion-empty-heading p { font-size:15px; }
          .companion-shell.is-home .companion-composer-wrap { padding:0 2px; }
        }
      `}</style>
    </section>
  )
}
