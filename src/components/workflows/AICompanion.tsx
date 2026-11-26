
'use client'

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { ArrowUp, CheckCircle2, Clock3, FileText, Lightbulb, MessageCircle, Plus, ShieldCheck, Sparkles } from 'lucide-react'
import { ApiResponseError, ensureAnonymousSession, getJSON, postJSON } from '@/api/client'
import { isEmergencyCompanionResponse } from '@/lib/companion-safety'
import { caregiverFieldLabel, caregiverSourceText, caregiverSafeAssistantText, caregiverSafeGeneratedText, caregiverStatusLabel } from '@/lib/caregiver-language'
import { RecordState } from '@/components/ui/RecordState'

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
  evidence_reviews_status?: string
  evidence_reviews_has_more?: boolean
  evidence_reviews?: Array<{
    review_type: string
    outcome: string
    rationale: string
    created_at?: string | null
    interpretation_limit: string
  }>
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
    evidence_reviews_status?: string
    evidence_reviews_has_more?: boolean
    evidence_reviews?: Array<{
      review_type: string
      outcome: string
      rationale: string
      created_at?: string | null
      interpretation_limit: string
    }>
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
  document_extractions: 'Text from a document',
  care_evidence: 'Uploaded note or document',
  events: 'Care update',
  care_events: 'Care update',
  assertions: 'Caregiver report',
  care_assertions: 'Caregiver report',
  handoffs: 'Care summary shared with another caregiver',
  decisions: 'Care decision',
  decision_outcomes: 'What happened after a decision',
  corrections: 'Correction to saved information',
  open_loop_records: 'Follow-up',
  open_questions: 'Question still to answer',
  missing_information: 'Information not recorded',
  conflicts: 'Reports that do not match',
  reconciliations: 'Information checked against other reports',
  appointments: ''ppointment',
  appointment_workspace: ''ppointment notes',
  appointment_workspace_stale: ''ppointment notes to review',
  appointment_workspace_currentness_unknown: ''ppointment notes — currentness not checked',
  appointment_workspace_revision: 'Earlier appointment notes',
  caregiver_observations: 'What a caregiver noticed',
  caregiver_perspectives: 'Caregiver view',
  conversation_messages: 'Earlier conversation message',
  companion_messages: 'Earlier conversation message',
}

interface LcrContextCoverage {
  schema_status?: string
  history_coverage?: string
  retrieval_scan_complete?: boolean
  retrieval_projection_complete?: boolean
  pages_fetched?: number
  page_limit_reached?: boolean
  prompt_context_complete?: boolean
  prompt_context_chars?: number
  prompt_context_budget_chars?: number
  missing_required_sources?: string[]
  missing_optional_sources?: string[]
  sources?: Record<string, {
    status?: string
    candidate_count?: number | null
    returned_count?: number
    candidate_scan_complete?: boolean
    has_more?: boolean
    selection_truncated?: boolean
  }>
}

interface PendingCareUpdate {
  id: string
  status: string
  proposed_change: { asserted_value?: string; source_quote?: string; event_time_text?: string | null }
  created_at?: string | null
}

interface CareUpdateReviewHistoryItem {
  id: string
  decision: string
  reviewer_caregiver_id: string
  rationale: string
  correction_context?: string | null
  resulting_lcr_revision_id?: string | null
  created_at?: string | null
}

interface Message {
  id?: string
  role: 'user' | 'assistant'
  text: string
  source_message_id?: string | null
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
  lcr_context_coverage?: LcrContextCoverage
  ai_generated?: boolean
  response_mode?: string
  written_to_lcr?: boolean
  persistence?: string
  timestamp: Date
}

function companionConversationStorageKey(personId: string, caregiverId: string): string {
  return `solenos_companion_session:${encodeURIComponent(personId)}:${encodeURIComponent(caregiverId)}`
}

function activeCompanionConversationStorageKey(): string | null {
  if (typeof window === 'undefined') return null
  const personId = window.localStorage.getItem('solenos_backend_person_id')
  const caregiverId = window.localStorage.getItem('solenos_backend_caregiver_id')
  return personId && caregiverId ? companionConversationStorageKey(personId, caregiverId) : null
}

const STARTER_PROMPTS = [
  { icon: MessageCircle, title: 'I need to talk it through', description: 'One thing at a time. No need to organise it first.', prompt: "I'm overwhelmed. Help me work through one thing at a time." },
  { icon: Clock3, title: 'Something has changed', description: 'Sort what is known from what is still unclear.', prompt: 'Something has changed in care. Help me work out what we know and what is unclear.' },
  { icon: FileText, title: 'Help me get ready', description: 'Prepare a few questions for a visit or handover.', prompt: 'Help me prepare for an upcoming care appointment or handover.' },
]


type ConversationHistoryCursor = { before: string; before_id: string }
type SavedConversation = { session_id: string; title?: string | null; last_message_at?: string | null; message_count?: number; person_id?: string }

function formatConversationTimestamp(timestamp: Date): string {
  if (Number.isNaN(timestamp.getTime())) return "Time not available"
  const now = new Date()
  if (timestamp.toDateString() === now.toDateString()) {
    return timestamp.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }
  return timestamp.toLocaleString([], {
    month: "short",
    day: "numeric",
    year: timestamp.getFullYear() === now.getFullYear() ? undefined : "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function mapStoredConversationMessage(message: any): Message {
  return {
    id: message.id,
    role: message.role,
    text: message.role === 'assistant' ? caregiverSafeGeneratedText(message.text) ?? 'I could not safely display part of that earlier response. Your Care Record has not changed. You can ask again using your saved care information.' : message.text,
    source_message_id: message.role === 'user' ? (message.source_message_id || message.id || null) : null,
    guard_verdict: message.guard_verdict, safety_note: message.safety_note,
    evidence_ids: message.evidence_ids || [], source_event_ids: message.source_event_ids || [],
    source_evidence_ids: message.source_evidence_ids || [], source_appointment_ids: message.source_appointment_ids || [],
    source_assertion_ids: message.source_assertion_ids || [], source_lcr_context_ids: message.source_lcr_context_ids || [],
    source_freshness_assessment_ids: message.source_freshness_assessment_ids || [],
    freshness_source_status: message.freshness_source_status, lcr_context_coverage: message.lcr_context_coverage,
    source_record_refs: message.source_record_refs || [], claim_provenance: message.claim_provenance,
    ai_generated: message.ai_generated, response_mode: message.response_mode,
    timestamp: message.created_at ? new Date(message.created_at) : new Date(),
  }
}

export default function Companion({ home = false, initialPrompt = null }: { home?: boolean; initialPrompt?: string | null }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [olderHistoryCursor, setOlderHistoryCursor] = useState<ConversationHistoryCursor | null>(null)
  const [hasOlderMessages, setHasOlderMessages] = useState(false)
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false)
  const [historyLoadError, setHistoryLoadError] = useState<string | null>(null)
  const [savedConversations, setSavedConversations] = useState<SavedConversation[]>([])
  const [savedConversationOffset, setSavedConversationOffset] = useState(0)
  const [hasMoreSavedConversations, setHasMoreSavedConversations] = useState(false)
  const [loadingMoreSavedConversations, setLoadingMoreSavedConversations] = useState(false)
  const [showConversationHistory, setShowConversationHistory] = useState(false)
  const [loadingConversationHistory, setLoadingConversationHistory] = useState(false)
  const [conversationHistoryError, setConversationHistoryError] = useState<string | null>(null)
  const [emergency, setEmergency] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)
  const [conversationRestoreError, setConversationRestoreError] = useState<string | null>(null)
  const [availability, setAvailability] = useState<'checking' | 'available' | 'unavailable' | 'unverified' | 'unknown'>('checking')
  const [pendingCareUpdates, setPendingCareUpdates] = useState<PendingCareUpdate[]>([])
  const [careUpdateLoading, setCareUpdateLoading] = useState(false)
  const [careUpdateLoadFailed, setCareUpdateLoadFailed] = useState(false)
  const careUpdateLoadSequenceRef = useRef(0)
  const [reviewingCareUpdateId, setReviewingCareUpdateId] = useState<string | null>(null)
  const [confirmingCareReportId, setConfirmingCareReportId] = useState<string | null>(null)
  const [savingCareReportId, setSavingCareReportId] = useState<string | null>(null)
  const [careUpdateError, setCareUpdateError] = useState<string | null>(null)
  const [careUpdateNotice, setCareUpdateNotice] = useState<string | null>(null)
  const [correctingCareUpdateId, setCorrectingCareUpdateId] = useState<string | null>(null)
  const [correctedCareUpdateText, setCorrectedCareUpdateText] = useState('')
  const [careUpdateCorrectionContext, setCareUpdateCorrectionContext] = useState('')
  const [careUpdateHistory, setCareUpdateHistory] = useState<Record<string, CareUpdateReviewHistoryItem[]>>({})
  const [loadingCareUpdateHistoryId, setLoadingCareUpdateHistoryId] = useState<string | null>(null)
  const [showReviewedCareUpdates, setShowReviewedCareUpdates] = useState(false)
  const [reviewedCareUpdates, setReviewedCareUpdates] = useState<PendingCareUpdate[]>([])
  const [reviewedCareUpdatesLoading, setReviewedCareUpdatesLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const conversationScrollRef = useRef<HTMLElement>(null)
  const suppressBottomScrollRef = useRef(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const pendingTurnId = useRef<string | null>(null)
  const sendingRef = useRef(false)
  const pendingTurnText = useRef<string | null>(null)
  const userInteractedRef = useRef(false)
  const conversationScopeRef = useRef<string | null>(null)
  const conversationScopeSequenceRef = useRef(0)
  const lastObservedScopeKeyRef = useRef<string | null>(activeCompanionConversationStorageKey())
  const captureCareScope = () => {
    const sequence = conversationScopeSequenceRef.current
    const scopeKey = activeCompanionConversationStorageKey()
    return () => sequence === conversationScopeSequenceRef.current
      && scopeKey === activeCompanionConversationStorageKey()
  }

  const checkAvailability = useCallback(async () => {
    setAvailability('checking')
    try {
      await ensureAnonymousSession()
      const status = await getJSON('/assistant/status') as {
        available?: boolean
        operational?: boolean
        runtime_available?: boolean
        model_installed?: boolean
      }
      if (status.operational === true && status.available === true) {
        setAvailability('available')
        setRequestError(null)
      } else if (status.runtime_available === true && status.model_installed === true) {
        // The model is installed, but only a real response can verify inference.
        // Allow the caregiver's first request to perform that verification.
        setAvailability('unverified')
      } else if (
        status.runtime_available === false ||
        status.model_installed === false ||
        status.available === false
      ) {
        setAvailability('unavailable')
      } else {
        setAvailability('unknown')
      }
    } catch {
      setAvailability('unknown')
    }
  }, [])

  useLayoutEffect(() => {
    if (suppressBottomScrollRef.current) {
      suppressBottomScrollRef.current = false
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  useEffect(() => {
    let cancelled = false
    let storageKey: string | null = null
    const initialScopeKey = activeCompanionConversationStorageKey()
    const requestScopeSequence = conversationScopeSequenceRef.current
    const isCurrentRestore = () =>
      !cancelled
      && requestScopeSequence === conversationScopeSequenceRef.current
      && (!storageKey || activeCompanionConversationStorageKey() === storageKey)
    const restoreConversation = async () => {
      try {
        const session = await ensureAnonymousSession()
        const nextStorageKey = companionConversationStorageKey(session.person.id, session.caregiver.id)
        if (
          !isCurrentRestore()
          || (initialScopeKey !== null && initialScopeKey !== nextStorageKey)
          || activeCompanionConversationStorageKey() !== nextStorageKey
        ) return
        storageKey = nextStorageKey
        conversationScopeRef.current = storageKey
        let savedSessionId: string | null = null
        try {
          savedSessionId = window.localStorage.getItem(storageKey)
        } catch {
          // The authenticated server list remains authoritative when browser storage is unavailable.
        }
        if (!savedSessionId) {
          // Browser storage is only a fast pointer. The authenticated server
          // list is the durable source, so a new device can restore the latest
          // conversation without the previous device's localStorage key.
          const listing = await getJSON('/conversations?limit=1') as {
            person_id?: string
            items?: Array<{ session_id?: string; person_id?: string }>
          }
          if (!isCurrentRestore()) return
          if (listing.person_id !== session.person.id) {
            throw new Error('The conversation list did not match the active care record.')
          }
          const latest = listing.items?.[0]
          if (!latest) return
          if (!latest.session_id || latest.person_id !== session.person.id) {
            throw new Error('The latest conversation did not match the active care record.')
          }
          savedSessionId = latest.session_id
          try {
            window.localStorage.setItem(storageKey, savedSessionId)
          } catch {
            // Server-backed listing and history remain usable without a local cache.
          }
        }
        const response = await getJSON('/conversation/' + encodeURIComponent(savedSessionId)) as {
          session_id?: string
          person_id?: string
          has_more?: boolean
          next_before?: string | null
          next_before_id?: string | null
          messages?: Array<{
            id?: string
            source_message_id?: string | null
            role: 'user' | 'assistant'
            text: string
            created_at?: string | null
            guard_verdict?: string | null
            safety_note?: string | null
            evidence_ids?: string[]
            source_event_ids?: string[]
            source_evidence_ids?: string[]
            source_appointment_ids?: string[]
            source_assertion_ids?: string[]
            source_lcr_context_ids?: string[]
            source_freshness_assessment_ids?: string[]
            freshness_source_status?: string
            lcr_context_coverage?: LcrContextCoverage
            source_record_refs?: Array<{ record_type: string; record_id: string }>
            claim_provenance?: ClaimProvenance
            ai_generated?: boolean
            response_mode?: string
          }>
        }
        if (!isCurrentRestore() || userInteractedRef.current) return
        if (
          response.session_id !== savedSessionId
          || response.person_id !== session.person.id
          || !Array.isArray(response.messages)
        ) {
          throw new Error('The saved conversation history did not match the active care session.')
        }
        setConversationRestoreError(null)
        setSessionId(savedSessionId)
        setMessages(response.messages.map(mapStoredConversationMessage))
        setHasOlderMessages(response.has_more === true)
        setOlderHistoryCursor(response.has_more === true && response.next_before && response.next_before_id
          ? { before: response.next_before, before_id: response.next_before_id } : null)

      } catch (error) {
        if (error instanceof ApiResponseError && error.status === 404 && storageKey && isCurrentRestore()) {
          try {
            window.localStorage.removeItem(storageKey)
          } catch {
            // A missing local pointer must not prevent server-backed recovery.
          }
        } else if (isCurrentRestore() && !userInteractedRef.current) {
          setConversationRestoreError('We could not restore the earlier conversation. Your saved Care Record has not changed. Reload this page to try again, or start a new conversation.')
        }
      }
    }
    void restoreConversation()
    return () => { cancelled = true }
  }, [])



  const loadConversationHistory = async () => {
    const requestScopeSequence = conversationScopeSequenceRef.current
    const initialScopeKey = activeCompanionConversationStorageKey()
    const isCurrentScope = () => requestScopeSequence === conversationScopeSequenceRef.current
      && initialScopeKey === activeCompanionConversationStorageKey()
    setLoadingConversationHistory(true)
    setConversationHistoryError(null)
    try {
      const session = await ensureAnonymousSession()
      const expectedScopeKey = companionConversationStorageKey(session.person.id, session.caregiver.id)
      if (!isCurrentScope() || initialScopeKey !== expectedScopeKey) return
      const response = await getJSON('/conversations?limit=30&offset=0') as {
        person_id?: string
        items?: SavedConversation[]
        has_more?: boolean
        next_offset?: number | null
      }
      if (!isCurrentScope()) return
      if (response.person_id !== session.person.id || !Array.isArray(response.items)) {
        throw new Error('Conversation history did not match the active Care Record.')
      }
      const items = response.items.filter(item => item.person_id === session.person.id && typeof item.session_id === 'string')
      setSavedConversations(items)
      setHasMoreSavedConversations(response.has_more === true)
      setSavedConversationOffset(response.next_offset ?? items.length)
    } catch {
      if (isCurrentScope()) setConversationHistoryError('Conversation history could not be loaded. Your saved conversations have not changed. Try again.')
    } finally {
      if (isCurrentScope()) setLoadingConversationHistory(false)
    }
  }


  const loadMoreSavedConversations = async () => {
    if (!hasMoreSavedConversations || loadingMoreSavedConversations || loadingConversationHistory) return
    const requestScopeSequence = conversationScopeSequenceRef.current
    const initialScopeKey = activeCompanionConversationStorageKey()
    const offset = savedConversationOffset
    const isCurrentScope = () => requestScopeSequence === conversationScopeSequenceRef.current
      && initialScopeKey === activeCompanionConversationStorageKey()
    setLoadingMoreSavedConversations(true)
    setConversationHistoryError(null)
    try {
      const session = await ensureAnonymousSession()
      const expectedScopeKey = companionConversationStorageKey(session.person.id, session.caregiver.id)
      if (!isCurrentScope() || initialScopeKey !== expectedScopeKey) return
      const response = await getJSON('/conversations?limit=30&offset=' + String(offset)) as {
        person_id?: string
        items?: SavedConversation[]
        has_more?: boolean
        next_offset?: number | null
      }
      if (!isCurrentScope()) return
      if (response.person_id !== session.person.id || !Array.isArray(response.items)) {
        throw new Error('Conversation history did not match the active Care Record.')
      }
      const items = response.items.filter(item => item.person_id === session.person.id && typeof item.session_id === 'string')
      setSavedConversations(previous => {
        const existing = new Set(previous.map(item => item.session_id))
        return [...previous, ...items.filter(item => !existing.has(item.session_id))]
      })
      setHasMoreSavedConversations(response.has_more === true)
      setSavedConversationOffset(response.next_offset ?? offset + items.length)
    } catch {
      if (isCurrentScope()) setConversationHistoryError('More conversations could not be loaded. Your saved conversations have not changed. Try again.')
    } finally {
      if (isCurrentScope()) setLoadingMoreSavedConversations(false)
    }
  }

  const openSavedConversation = async (savedSessionId: string) => {
    if (loading || loadingOlderMessages || loadingConversationHistory) return
    const requestScopeSequence = conversationScopeSequenceRef.current
    const initialScopeKey = activeCompanionConversationStorageKey()
    const isCurrentScope = () => requestScopeSequence === conversationScopeSequenceRef.current
      && initialScopeKey === activeCompanionConversationStorageKey()
    setLoadingConversationHistory(true)
    setConversationHistoryError(null)
    try {
      const session = await ensureAnonymousSession()
      const expectedScopeKey = companionConversationStorageKey(session.person.id, session.caregiver.id)
      if (!isCurrentScope() || initialScopeKey !== expectedScopeKey) return
      const response = await getJSON('/conversation/' + encodeURIComponent(savedSessionId) + '?limit=100') as {
        session_id?: string
        person_id?: string
        messages?: any[]
        has_more?: boolean
        next_before?: string | null
        next_before_id?: string | null
      }
      if (!isCurrentScope()) return
      if (response.session_id !== savedSessionId || response.person_id !== session.person.id || !Array.isArray(response.messages)) {
        throw new Error('The selected conversation did not match the active Care Record.')
      }
      userInteractedRef.current = true
      pendingTurnId.current = null
      pendingTurnText.current = null
      setEmergency(false)
      conversationScopeRef.current = expectedScopeKey
      setSessionId(savedSessionId)
      setMessages(response.messages.map(mapStoredConversationMessage))
      setHasOlderMessages(response.has_more === true)
      setOlderHistoryCursor(response.has_more === true && response.next_before && response.next_before_id
        ? { before: response.next_before, before_id: response.next_before_id } : null)
      setHistoryLoadError(null)
      setRequestError(null)
      setConversationRestoreError(null)
      setShowConversationHistory(false)
      setInput('')
      try {
        window.localStorage.setItem(expectedScopeKey, savedSessionId)
      } catch {
        // Server-backed history remains authoritative without a browser pointer.
      }
    } catch {
      if (isCurrentScope()) setConversationHistoryError('That conversation could not be opened. Your saved conversations have not changed. Try again.')
    } finally {
      if (isCurrentScope()) setLoadingConversationHistory(false)
    }
  }

  const loadOlderMessages = async () => {
    const currentSessionId = sessionId
    const cursor = olderHistoryCursor
    const activeScopeKey = activeCompanionConversationStorageKey()
    const requestScopeSequence = conversationScopeSequenceRef.current
    if (!currentSessionId || !cursor || !hasOlderMessages || loadingOlderMessages || loadingConversationHistory) return
    const isCurrentRequest = () => requestScopeSequence === conversationScopeSequenceRef.current
      && activeScopeKey === activeCompanionConversationStorageKey()
      && conversationScopeRef.current === activeScopeKey
    const container = conversationScrollRef.current
    const previousHeight = container?.scrollHeight ?? 0
    const previousTop = container?.scrollTop ?? 0
    setLoadingOlderMessages(true)
    setHistoryLoadError(null)
    try {
      const query = new URLSearchParams({ limit: '100', before: cursor.before, before_id: cursor.before_id })
      const response = await getJSON('/conversation/' + encodeURIComponent(currentSessionId) + '?' + query.toString()) as {
        session_id?: string; messages?: any[]; has_more?: boolean
        next_before?: string | null; next_before_id?: string | null
      }
      if (!isCurrentRequest()) return
      if (response.session_id !== currentSessionId || !Array.isArray(response.messages)) throw new Error('Conversation history did not match.')
      suppressBottomScrollRef.current = true
      setMessages(previous => [...response.messages!.map(mapStoredConversationMessage), ...previous])
      setHasOlderMessages(response.has_more === true)
      setOlderHistoryCursor(response.has_more === true && response.next_before && response.next_before_id
        ? { before: response.next_before, before_id: response.next_before_id } : null)
      requestAnimationFrame(() => {
        const current = conversationScrollRef.current
        if (current && isCurrentRequest()) current.scrollTop = previousTop + current.scrollHeight - previousHeight
      })
    } catch {
      if (isCurrentRequest()) setHistoryLoadError('Earlier messages could not be loaded. Your saved conversation is unchanged. Try again.')
    } finally {
      if (isCurrentRequest()) setLoadingOlderMessages(false)
    }
  }

  useEffect(() => {
    const clearPreviousCareScope = () => {
      const activeScopeKey = activeCompanionConversationStorageKey()
      const previousScopeKey = lastObservedScopeKeyRef.current
      lastObservedScopeKeyRef.current = activeScopeKey
      if (previousScopeKey === null || activeScopeKey === previousScopeKey) return
      conversationScopeSequenceRef.current += 1
      conversationScopeRef.current = null
      setMessages([])
      setSessionId(null)
      setOlderHistoryCursor(null)
      setHasOlderMessages(false)
      setHistoryLoadError(null)
      setSavedConversations([])
      setSavedConversationOffset(0)
      setHasMoreSavedConversations(false)
      setLoadingMoreSavedConversations(false)
      setShowConversationHistory(false)
      setConversationHistoryError(null)
      setLoadingConversationHistory(false)
      setPendingCareUpdates([])
      setLoadingOlderMessages(false)
      setCareUpdateLoading(false)
      setCareUpdateLoadFailed(false)
      careUpdateLoadSequenceRef.current += 1
      setReviewedCareUpdates([])
      setReviewedCareUpdatesLoading(false)
      setShowReviewedCareUpdates(false)
      setCareUpdateHistory({})
      setLoadingCareUpdateHistoryId(null)
      setReviewingCareUpdateId(null)
      setConfirmingCareReportId(null)
      setSavingCareReportId(null)
      setCorrectingCareUpdateId(null)
      setCorrectedCareUpdateText('')
      setCareUpdateCorrectionContext('')
      setCareUpdateError(null)
      setCareUpdateNotice(null)
      setEmergency(false)
      setRequestError(null)
      setInput('')
      setLoading(false)
      setAvailability('unknown')
      setConversationRestoreError('Your active care record changed. Reload this page to restore the conversation for the current caregiver.')
      pendingTurnId.current = null
      pendingTurnText.current = null
    }
    window.addEventListener('personIdChanged', clearPreviousCareScope)
    return () => window.removeEventListener('personIdChanged', clearPreviousCareScope)
  }, [])

  const sendMessage = async (textOverride?: string) => {
    const submittedText = (textOverride ?? input).trim()
    // React state updates are asynchronous. A ref closes the same-tick
    // double-submit window before the loading state reaches the next render.
    if (!submittedText || loading || loadingOlderMessages || loadingConversationHistory || sendingRef.current) return
    sendingRef.current = true
    const requestScopeSequence = conversationScopeSequenceRef.current
    const initialScopeKey = activeCompanionConversationStorageKey()
    const isCurrentScopeRequest = () => requestScopeSequence === conversationScopeSequenceRef.current
    userInteractedRef.current = true
    setRequestError(null)
    setConversationRestoreError(null)
    setLoading(true)
    setEmergency(false)
    if (!pendingTurnId.current || pendingTurnText.current !== submittedText) {
      pendingTurnId.current = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : 'turn-' + Date.now() + '-' + Math.random().toString(36).slice(2)
      pendingTurnText.current = submittedText
    }
    const clientTurnId = pendingTurnId.current
    const userMsg: Message = { id: clientTurnId + ':user', role: 'user', text: submittedText, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])

    try {
      const session = await ensureAnonymousSession()
      const activeScopeKey = companionConversationStorageKey(session.person.id, session.caregiver.id)
      if (
        !isCurrentScopeRequest()
        || (initialScopeKey !== null && initialScopeKey !== activeScopeKey)
        || activeCompanionConversationStorageKey() !== activeScopeKey
      ) {
        setMessages(previous => previous.filter(message => message !== userMsg))
        return
      }
      const scopeChanged = conversationScopeRef.current !== null && conversationScopeRef.current !== activeScopeKey
      if (scopeChanged) {
        setMessages([userMsg])
        setSessionId(null)
        setPendingCareUpdates([])
        setCareUpdateLoadFailed(false)
        careUpdateLoadSequenceRef.current += 1
      }
      conversationScopeRef.current = activeScopeKey
      const activeSessionId = scopeChanged ? null : sessionId
      // Every Companion turn, including greetings and thanks, uses the same
      // authenticated conversation pipeline so it can restore prior turns,
      // persist the exchange, and retain one consistent response contract.
      const response = await postJSON('/conversation/message', {
        person_id: session.person.id,
        text: submittedText,
        session_id: activeSessionId,
        client_turn_id: clientTurnId,
      }) as any
      if (!isCurrentScopeRequest() || activeCompanionConversationStorageKey() !== activeScopeKey) {
        setMessages(previous => previous.filter(message => message !== userMsg))
        return
      }
      if (typeof response?.reply !== 'string' || !response.reply.trim()) throw new Error('The conversation response was incomplete.')
      const caregiverReply = caregiverSafeGeneratedText(response.reply) ?? 'I could not safely display part of that response. Your care information has not been changed. Please try again.'

      // A successful HTTP response may be a deterministic support fallback.
      // Only the explicit AI-generated flag proves that Qwen produced this answer.
      setAvailability(response.ai_generated === true ? 'available' : 'unverified')
      setInput('')
      pendingTurnId.current = null
      pendingTurnText.current = null
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      if (response.session_id) {
        setSessionId(response.session_id)
        try {
          // The server is the durable source of conversation history. This
          // browser pointer is only a convenience and must never turn a
          // successful, persisted reply into a failed send.
          window.localStorage.setItem(
            companionConversationStorageKey(session.person.id, session.caregiver.id),
            response.session_id,
          )
        } catch {
          // Server-backed conversation listing restores history without this pointer.
        }
      }
      const isEmergency = isEmergencyCompanionResponse(response)
      if (isEmergency) setEmergency(true)

      const assistantMsg: Message = {
        id: clientTurnId + ':assistant',
        role: 'assistant',
        text: caregiverReply,
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
        lcr_context_coverage: response.lcr_context_coverage,
        ai_generated: response.ai_generated,
        response_mode: response.response_mode,
        written_to_lcr: response.written_to_lcr,
        persistence: response.persistence,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev.map(message => message === userMsg ? { ...message, id: response.source_message_id || message.id, source_message_id: response.source_message_id || null } : message), assistantMsg])
      void loadPendingCareUpdates()


    } catch (error) {
      if (!isCurrentScopeRequest()) {
        setMessages(previous => previous.filter(message => message !== userMsg))
        return
      }
      setMessages(prev => prev.filter(message => message !== userMsg))
      setInput(submittedText)
      const inferenceUnavailable =
        error instanceof ApiResponseError && [502, 503, 504].includes(error.status)
      setAvailability(inferenceUnavailable ? 'unavailable' : 'unknown')
      setRequestError(
        inferenceUnavailable
          ? 'SolenOS is temporarily unavailable. Your message is still in the box, and your Care Record has not changed. Check again shortly.'
          : 'SolenOS could not respond. Your message is still in the box, and your Care Record has not changed. Check your connection or try again.'
      )
    } finally {
      sendingRef.current = false
      if (isCurrentScopeRequest()) setLoading(false)
    }
  }


  const loadPendingCareUpdates = async () => {
    const requestSequence = ++careUpdateLoadSequenceRef.current
    const isCurrentRequest = () => careUpdateLoadSequenceRef.current === requestSequence
    setCareUpdateLoading(true)
    setCareUpdateError(null)
    try {
      const response = await getJSON('/companion/care-updates') as { items?: PendingCareUpdate[] }
      if (!Array.isArray(response?.items)) throw new Error('The saved care suggestions response was incomplete.')
      if (isCurrentRequest()) {
        setPendingCareUpdates(response.items)
        setCareUpdateLoadFailed(false)
      }
    } catch {
      if (isCurrentRequest()) {
        setCareUpdateLoadFailed(true)
        setCareUpdateError('Care suggestions could not be refreshed. Your conversation is still saved. Try again before reviewing these suggestions.')
      }
    } finally {
      if (isCurrentRequest()) setCareUpdateLoading(false)
    }
  }

  const createCareReport = async (messageId: string) => {
    const isCurrentCareScope = captureCareScope()
    if (savingCareReportId) return
    setSavingCareReportId(messageId)
    setCareUpdateError(null)
    setCareUpdateNotice(null)
    try {
      const response = await postJSON('/companion/care-updates/from-message/' + encodeURIComponent(messageId), { confirm_care_report: true }) as { proposal?: { status?: string } }
      if (!isCurrentCareScope()) return
      setConfirmingCareReportId(null)
      setCareUpdateNotice(response?.proposal?.status === 'accepted'
        ? 'This report is already in your Care Record.'
        : response?.proposal?.status === 'rejected'
          ? 'This report was previously declined and was not added to your Care Record.'
          : 'Saved for review. It will not enter your Care Record unless you accept it below.')
      await loadPendingCareUpdates()
    } catch {
      if (isCurrentCareScope()) setCareUpdateError('This message could not be saved for review. It has not been added to your Care Record.')
    } finally {
      if (isCurrentCareScope()) setSavingCareReportId(null)
    }
  }

  const reviewCareUpdate = async (proposalId: string, decision: 'accept' | 'reject') => {
    const isCurrentCareScope = captureCareScope()
    if (reviewingCareUpdateId) return
    setReviewingCareUpdateId(proposalId)
    setCareUpdateError(null)
    setCareUpdateNotice(null)
    try {
      const response = await postJSON('/companion/care-updates/' + encodeURIComponent(proposalId) + '/review', { decision }) as {
        status?: string
        decision?: string
        written_to_lcr?: boolean
        idempotent_replay?: boolean
      }
      if (!isCurrentCareScope()) return
      const expectedStatus = decision === 'accept' ? 'accepted' : 'rejected'
      if (response?.status !== expectedStatus || response?.decision !== decision) {
        throw new Error('The server did not confirm the requested review decision.')
      }
      if (decision === 'accept' && response?.written_to_lcr !== true) {
        throw new Error('The server did not confirm the Care Record update.')
      }
      if (decision === 'reject' && response?.written_to_lcr !== false) {
        throw new Error('The server did not confirm that nothing was added to the Care Record.')
      }
      setPendingCareUpdates(current => current.filter(item => item.id !== proposalId))
      if (decision === 'accept') {
        window.dispatchEvent(new Event('careRecordUpdated'))
      }
      setCareUpdateNotice(decision === 'accept'
        ? 'Your report was added to the Care Record. A healthcare professional has not confirmed it.'
        : 'This suggestion was declined. Nothing was added to the Care Record.')
      if (showReviewedCareUpdates) await loadReviewedCareUpdates()
    } catch {
      if (isCurrentCareScope()) setCareUpdateError('We couldn’t confirm whether this review was saved. Refresh the suggestions and Care Record before trying again.')
    } finally {
      if (isCurrentCareScope()) setReviewingCareUpdateId(null)
    }
  }

  const correctCareUpdate = async (proposalId: string) => {
    const isCurrentCareScope = captureCareScope()
    const correctedText = correctedCareUpdateText.trim()
    if (!correctedText || reviewingCareUpdateId) return
    setReviewingCareUpdateId(proposalId)
    setCareUpdateError(null)
    setCareUpdateNotice(null)
    try {
      const response = await postJSON('/companion/care-updates/' + encodeURIComponent(proposalId) + '/review', {
        decision: 'correct',
        corrected_text: correctedText,
        correction_context: careUpdateCorrectionContext.trim() || null,
      }) as {
        decision?: string
        proposal?: { status?: string }
        corrected_proposal?: { id?: string; status?: string }
      }
      if (!isCurrentCareScope()) return
      if (
        response?.decision !== 'correct'
        || response?.proposal?.status !== 'corrected'
        || response?.corrected_proposal?.status !== 'pending_authorization'
        || !response?.corrected_proposal?.id
      ) {
        throw new Error('The server did not confirm a separately reviewable corrected proposal.')
      }
      setCorrectingCareUpdateId(null)
      setCorrectedCareUpdateText('')
      setCareUpdateCorrectionContext('')
      setCareUpdateNotice('Correction saved as a new review item. Nothing has been added to your Care Record yet.')
      await loadPendingCareUpdates()
      if (showReviewedCareUpdates) await loadReviewedCareUpdates()
    } catch {
      if (isCurrentCareScope()) setCareUpdateError('The correction could not be confirmed. The original report remains unchanged; refresh the suggestions before trying again.')
    } finally {
      if (isCurrentCareScope()) setReviewingCareUpdateId(null)
    }
  }

  const loadReviewedCareUpdates = async () => {
    const isCurrentCareScope = captureCareScope()
    setReviewedCareUpdatesLoading(true)
    setCareUpdateError(null)
    try {
      const response = await getJSON('/companion/care-updates?include_reviewed=true') as {
        items?: PendingCareUpdate[]
        ordering?: string
        limit?: number
      }
      if (!isCurrentCareScope()) return
      if (!Array.isArray(response?.items) || response.ordering !== 'newest_first') {
        throw new Error('The reviewed care update list was incomplete.')
      }
      setReviewedCareUpdates(response.items.filter(item => item.status !== 'pending_authorization'))
    } catch {
      if (isCurrentCareScope()) setCareUpdateError('Previous care update decisions could not be loaded. Your saved Care Record has not changed.')
    } finally {
      if (isCurrentCareScope()) setReviewedCareUpdatesLoading(false)
    }
  }

  const loadCareUpdateHistory = async (proposalId: string) => {
    const isCurrentCareScope = captureCareScope()
    setLoadingCareUpdateHistoryId(proposalId)
    setCareUpdateError(null)
    try {
      const response = await getJSON('/companion/care-updates/' + encodeURIComponent(proposalId) + '/history') as {
        items?: CareUpdateReviewHistoryItem[]
        append_only?: boolean
      }
      if (!isCurrentCareScope()) return
      if (response?.append_only !== true || !Array.isArray(response.items)) {
        throw new Error('Review history response was incomplete.')
      }
      setCareUpdateHistory(current => ({ ...current, [proposalId]: response.items || [] }))
    } catch {
      if (isCurrentCareScope()) setCareUpdateError('Review history could not be loaded. The saved care suggestion has not been changed.')
    } finally {
      if (isCurrentCareScope()) setLoadingCareUpdateHistoryId(null)
    }
  }

  useEffect(() => {
    void checkAvailability().then(() => loadPendingCareUpdates())
  }, [checkAvailability])

  useEffect(() => {
    const prompt = initialPrompt?.trim().slice(0, 4000)
    if (!prompt) return
    setInput(prompt)
    setRequestError(null)
    const params = new URLSearchParams(window.location.search)
    params.delete('prompt')
    const remainingQuery = params.toString()
    const nextUrl = window.location.pathname + (remainingQuery ? '?' + remainingQuery : '') + window.location.hash
    window.history.replaceState(window.history.state, '', nextUrl)
  }, [initialPrompt])


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
    if (loading || loadingOlderMessages || loadingConversationHistory) return
    userInteractedRef.current = true
    const storageKey = activeCompanionConversationStorageKey()
    if (storageKey) window.localStorage.removeItem(storageKey)
    setMessages([])
    setInput('')
    setSessionId(null)
    setOlderHistoryCursor(null)
    setHasOlderMessages(false)
    setLoadingOlderMessages(false)
    setHistoryLoadError(null)
    setShowConversationHistory(false)
    setConversationHistoryError(null)
    pendingTurnId.current = null
    pendingTurnText.current = null
    setEmergency(false)
    setRequestError(null)
    setConversationRestoreError(null)
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    textareaRef.current?.focus()
  }

  return (
    <section className={`companion-shell${home ? " is-home" : ""}`} aria-label="Ask SolenOS conversation">
      <header className="companion-topbar">
        <div className="companion-brand">
          <div className="companion-mark" aria-hidden="true"><Sparkles size={21} strokeWidth={1.8} /></div>
          <div><div className="companion-eyebrow">HERE WHEN YOU NEED A HAND</div><h1 className="companion-page-title">Ask SolenOS</h1></div>
        </div>
        {(messages.length > 0 || sessionId) && <button className="companion-history-toggle" type="button" onClick={() => { const next = !showConversationHistory; setShowConversationHistory(next); if (next) void loadConversationHistory() }} disabled={loading || loadingOlderMessages || loadingConversationHistory}>Conversation history</button>}
        {messages.length > 0 && <button className="companion-new" type="button" onClick={startNewSession} disabled={loading || loadingOlderMessages || loadingConversationHistory}><Plus size={17} aria-hidden="true" /><span>New conversation</span></button>}
      </header>

      {showConversationHistory && <section className="companion-history-panel" aria-label="Saved conversations">
        <div className="companion-history-panel-heading"><strong>Saved conversations</strong><button type="button" onClick={() => setShowConversationHistory(false)} aria-label="Close conversation history">Close</button></div>
        {loadingConversationHistory && <p role="status">Loading conversations…</p>}
        {conversationHistoryError && <p className="companion-history-error" role="alert">{conversationHistoryError}</p>}
        {!loadingConversationHistory && !conversationHistoryError && savedConversations.length === 0 && <p>No saved conversations yet.</p>}
        <div className="companion-history-items">
          {savedConversations.map(item => <button key={item.session_id} type="button" onClick={() => void openSavedConversation(item.session_id)} disabled={loading || loadingOlderMessages || loadingConversationHistory || loadingMoreSavedConversations}>
            <strong>{item.title?.trim() || 'Care conversation'}</strong>
            <span>{item.last_message_at ? new Date(item.last_message_at).toLocaleString() : 'Saved conversation'} · {item.message_count ?? 0} messages</span>
          </button>)}
        </div>
        {hasMoreSavedConversations && <button className="companion-history-more" type="button" onClick={() => void loadMoreSavedConversations()} disabled={loadingMoreSavedConversations || loadingConversationHistory}>{loadingMoreSavedConversations ? 'Loading more…' : 'Load more conversations'}</button>}
      </section>}
      {requestError && messages.length > 0 && <div className="companion-error" role="alert"><span>{requestError}</span><button type="button" onClick={() => void sendMessage()} disabled={loading || loadingOlderMessages || loadingConversationHistory}>Try again</button></div>}
      {conversationRestoreError && <div className="companion-error" role="alert"><span>{conversationRestoreError}</span></div>}
      {emergency && <div className="companion-emergency" role="alert"><strong>Please check on the person now.</strong><p>If anyone may be in immediate danger, contact local emergency services. This conversation cannot provide emergency response.</p></div>}

      <div className="companion-workspace">
        <section ref={conversationScrollRef} className="companion-conversation" aria-label="Conversation">
          {messages.length === 0 ? (
            availability === 'checking' ? (
              <RecordState kind="loading" title="Checking whether SolenOS is available" />
            ) : (availability === 'available' || availability === 'unverified') && !requestError ? (
              <div className="companion-empty">
                <div className="companion-empty-icon"><MessageCircle size={23} strokeWidth={1.7} aria-hidden="true" /></div>
                <div className="companion-empty-heading"><span>A PLACE TO START</span><h3>You don’t have to figure it all out right now.</h3><p>Ask about saved care history, recent changes, appointments or information that is still unclear. A few words are enough. I’ll help explain what the record says and what remains unknown.</p><p>Conversations are saved here. Nothing is added to your Care Record unless you choose to save a message as a care note and approve it. Use <a href="/workspace/daily-care">Daily Care</a> or <a href="/workspace/documents">Documents</a> to record care information directly.</p></div>
                {availability === 'unverified' && <p className="companion-empty-footnote" role="status">SolenOS has not completed a response yet. Send your first question to check that it is working.</p>}
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
            ) : availability === 'unavailable' ? (
              <RecordState kind="unavailable" title="SolenOS is temporarily unavailable" description="Responses are not available right now. Your Care Record, Daily Care and Documents remain available." actionLabel="Check again" onAction={() => void checkAvailability()} />
            ) : (
              <RecordState kind="error" title="We couldn't check SolenOS" description={requestError || "We couldn't confirm whether responses are available. Please check again."} actionLabel="Check again" onAction={() => void checkAvailability()} />
            )
          ) : (
            <div className="companion-message-list">
              {hasOlderMessages && <div className="companion-history-older"><button type="button" onClick={() => void loadOlderMessages()} disabled={loadingOlderMessages}>{loadingOlderMessages ? "Loading earlier messages…" : "Load earlier messages"}</button></div>}
              {historyLoadError && <p className="companion-history-error" role="status">{historyLoadError}</p>}
              <div className="companion-thread-label"><span>YOUR CONVERSATION</span><span>{messages.length} {messages.length === 1 ? 'message' : 'messages'}</span></div>

              {messages.map((msg, index) => {
                const isUser = msg.role === 'user'
                const coverage = msg.lcr_context_coverage
                const hasUnreturnedMatches = Object.values(coverage?.sources || {}).some(source => source.has_more === true)
                const hasUnselectedMatches = Object.values(coverage?.sources || {}).some(source => source.selection_truncated === true)
                const coverageIsPartial = Boolean(coverage && (
                  coverage.retrieval_scan_complete !== true
                  || coverage.retrieval_projection_complete !== true
                  || coverage.prompt_context_complete === false
                  || coverage.page_limit_reached === true
                  || hasUnreturnedMatches
                  || hasUnselectedMatches
                  || !['query_scanned_ranked_subset', 'complete_history_scan_ranked_subset'].includes(coverage.history_coverage || '')
                ))
                return <article className={'companion-message ' + (isUser ? 'is-user' : 'is-assistant')} key={msg.id || msg.source_message_id || `${msg.role}-${msg.timestamp.getTime()}`}>
                  {!isUser && <div className="companion-avatar" aria-hidden="true"><Sparkles size={16} /></div>}
                  <div className="companion-message-body">
                    <div className="companion-message-meta"><strong>{isUser ? 'You' : 'SolenOS'}</strong><time dateTime={msg.timestamp.toISOString()}>{formatConversationTimestamp(msg.timestamp)}</time></div>
                    <div className="companion-bubble"><p>{msg.text}</p></div>
                    {isUser && msg.source_message_id && <div className="companion-care-report-action">
                      {confirmingCareReportId === msg.source_message_id ? <div className="companion-care-report-confirm" role="group" aria-label="Confirm this care report">
                        <p>Only continue if this describes something that happened or something you were told — not a question, possibility or guess.</p>
                        <button type="button" onClick={() => void createCareReport(msg.source_message_id!)} disabled={savingCareReportId === msg.source_message_id}>{savingCareReportId === msg.source_message_id ? 'Saving…' : 'Yes, save for review'}</button>
                        <button type="button" className="is-secondary" onClick={() => setConfirmingCareReportId(null)} disabled={Boolean(savingCareReportId)}>Cancel</button>
                      </div> : <button type="button" onClick={() => setConfirmingCareReportId(msg.source_message_id || null)} disabled={Boolean(savingCareReportId)}>Save as a care note</button>}
                    </div>}
                    {!isUser && msg.ai_generated === false && <section className="companion-provenance" role="status" aria-label="Response note">
                      <p>{msg.response_mode === 'deterministic_product_identity'
                        ? "This answer is about SolenOS, not the person's Care Record."
                        : msg.response_mode === 'deterministic_low_capacity_support_fallback'
                          ? caregiverSafeGeneratedText(msg.safety_note) || "I couldn't find enough information in your Care Record to give a reliable answer, so this is only a brief supportive reply. Nothing was changed in your Care Record."
                          : `This is a brief support message, not an answer based on your Care Record. ${caregiverSafeGeneratedText(msg.safety_note) || "It uses a safety check or information already saved. Nothing was changed in your Care Record."}`}</p>
                    </section>}
                    {!isUser && coverage && msg.response_mode !== 'deterministic_product_identity' && <section className="companion-provenance" role="status" aria-label="What care information was checked">
                      <strong>What care information was checked</strong>
                      <p>{coverageIsPartial
                        ? 'We couldn’t check every saved note or document, so this answer may miss important details.'
                        : 'We checked the saved notes and documents available for this question. If something is missing from your Care Record, we may not know about it.'}</p>
                    </section>}
                    {!isUser && msg.ai_generated && (msg.source_record_refs?.length ?? 0) > 0 && <section className="companion-provenance" aria-label="What this answer is based on">
                      <strong>What this answer is based on</strong>
                      {msg.source_record_refs?.map((reference, referenceIndex) => (
                        <div key={reference.record_type + ':' + reference.record_id + ':' + referenceIndex}>
                          <strong>{SOURCE_REFERENCE_LABELS[reference.record_type] || 'Saved care information'}</strong>
                          {reference.record_type === 'document_extractions' && <p>Text read from a document is only a suggestion. Review it in Documents before it is added to your care record.</p>}
                          {(reference.record_type === 'conversation_messages' || reference.record_type === 'companion_messages') && <p>Earlier conversation message — this is conversation history, not a care update.</p>}
                        </div>
                      ))}
                    </section>}
                    {!isUser && msg.ai_generated && msg.claim_provenance && <section className="companion-provenance" aria-label="Saved information behind this answer">
                      <strong>Where this answer came from</strong>
                      <p>Each statement is checked against the wording in saved records. A match does not prove that a report is true or that two records came from different people.</p>
                      <p><strong>Details from your Care Record</strong></p>
                      {msg.claim_provenance.claims.map(claim => (
                        <article key={claim.claim_id} className="companion-provenance-details">
                          <p><strong>{caregiverSafeGeneratedText(claim.text) || "A possible care detail needs your review."}</strong></p>
                          {claim.support_status === 'aggregate_count_mismatch' && <p role="note">The saved care updates do not support this number. The saved information shows {claim.aggregate_review?.count ?? 'an unconfirmed number'} separate updates in the time period you asked about.</p>}
                          {claim.support_status === 'aggregate_not_validated' && <p role="note">{caregiverSafeGeneratedText(claim.aggregate_review?.interpretation_limit) || 'This total could not be confirmed from the saved care updates. Check the reports before relying on a number.'}</p>}
                          {(claim.support_status === 'matched_saved_wording' || claim.support_status === 'matched_historical_only' || claim.support_status === 'matched_validated_aggregate') ? (
                            <div>
                              <p> <ShieldCheck size={14} aria-hidden="true" /> {claim.support_status === 'matched_historical_only' ? 'This wording appears in an earlier or corrected record. It is not treated as current information.' : claim.support_status === 'matched_validated_aggregate' ? 'We checked this count against separate care updates and their dates.' : 'This wording appears in your Care Record.'}</p>
                              {claim.support_status === 'matched_validated_aggregate' && <p>This count includes {claim.aggregate?.count ?? claim.source_references.length} separate care updates{claim.aggregate?.window_label ? " during " + (caregiverSafeAssistantText(claim.aggregate?.window_label) || "the selected time period") : ""}. Repeated records were not counted twice.</p>}
                              {claim.source_references.map((source, sourceIndex) => (
                                <div key={source.record_type + ':' + source.record_id + ':' + sourceIndex}>
                                  <strong>{caregiverSafeGeneratedText(source.label) || 'Saved care information'}</strong>
                                  {source.occurred_at && <p>When it happened: {new Date(source.occurred_at).toLocaleString()}</p>}
                                  {source.recorded_at && <p>When it was added: {new Date(source.recorded_at).toLocaleString()}</p>}
                                  {source.reported_by && <p>Reported by: {caregiverSafeAssistantText(source.reported_by) || "Not recorded"}</p>}
                                  {source.entered_by && <p>{caregiverSafeAssistantText(source.entered_by) || "Who added this was not recorded"}</p>}
                                  {source.source_state_label && <p>{caregiverSafeGeneratedText(source.source_state_label) || 'Status not available'}</p>}
                                  {source.correction_note && <p>{caregiverSourceText(source.correction_note)}</p>}
                                  {source.correction_rationale && <p>Why it was corrected: {caregiverSourceText(source.correction_rationale)}</p>}
                                  {source.previous_source_excerpt && <blockquote>Earlier wording: {caregiverSourceText(source.previous_source_excerpt)}</blockquote>}
                                  {source.source_independence_status === 'shared_origin' && <p>This note or document came from the same original as another saved note or document. It is not a separate report.</p>}
                                  {source.source_independence_status === 'independent' && <p>A caregiver marked this as a separate report.</p>}
                                  {source.source_independence_status === 'not_assessed' && <p>We have not checked whether this note or document is separate from other reports.</p>}
                                  {(source.exact_wording_duplicate_count ?? 0) > 0 && <p>The same words appear in {source.exact_wording_duplicate_count} other saved notes or documents. Do not count them as separate reports.</p>}
                                  {source.source_excerpt && <blockquote>{caregiverSourceText(source.source_excerpt)}</blockquote>}
                                  {source.evidence_reviews?.map((review, reviewIndex) => <div key={"source-review-" + reviewIndex}>
                                    <p><strong>Review of this note or document: {caregiverStatusLabel(review.outcome) || "Needs checking"}</strong></p>
                                    <p>{caregiverSafeGeneratedText(review.rationale) || "No review explanation was recorded."}</p>
                                    <small>{caregiverSafeGeneratedText(review.interpretation_limit) || "Reviewing a note or document does not by itself confirm that a care detail is true."}</small>
                                  </div>)}
                                  {(!source.evidence_reviews_status || source.evidence_reviews_status === "unavailable" || source.evidence_reviews_status === "failed") && <p>We couldn’t load earlier reviews of this note or document.</p>}
                                  {source.evidence_reviews_status === "partial" && <p>We couldn’t check all reviews. The history shown here may be incomplete.</p>}
                                  {source.evidence_reviews_status === "empty" && <p>No review of this note or document has been recorded.</p>}
                                  {source.evidence_reviews_has_more && <p>Only the latest reviews are shown here. Earlier reviews remain in your care history.</p>}
                                  {(source.related_evidence?.length ?? 0) > 0 && <div>
                                    <strong>Related note or document</strong>
                                    {source.related_evidence?.map((item, itemIndex) => <div key={item.record_id + ':' + itemIndex}>
                                      <p>{caregiverSafeGeneratedText(item.label) || 'Related care information'}</p>
                                      {item.reported_by && <p>Reported by: {caregiverSafeAssistantText(item.reported_by) || "Not recorded"}</p>}
                                      {item.entered_by && <p>Added by: {caregiverSafeAssistantText(item.entered_by) || "Who added this was not recorded"}</p>}
                                      {item.source_independence_status === 'shared_origin' && <p>This note came from the same original as another saved note or document. It is not a separate report.</p>}
                                      {item.source_independence_status === 'independent' && <p>A caregiver marked this as a separate report.</p>}
                                      {item.source_independence_status === 'not_assessed' && <p>We have not checked whether this note is separate from other reports.</p>}
                                      {(item.exact_wording_duplicate_count ?? 0) > 0 && <p>The same words appear in {item.exact_wording_duplicate_count} other saved notes or documents. Do not count them as separate reports.</p>}
                                      {item.occurred_at && <p>When it happened: {new Date(item.occurred_at).toLocaleString()}</p>}
                                      {item.recorded_at && <p>When it was added: {new Date(item.recorded_at).toLocaleString()}</p>}
                                      {item.source_excerpt && <blockquote>{caregiverSourceText(item.source_excerpt)}</blockquote>}
                                      {item.evidence_reviews?.map((review, reviewIndex) => <div key={"related-source-review-" + item.record_id + "-" + reviewIndex}>
                                        <p><strong>Review of this note or document: {caregiverStatusLabel(review.outcome) || "Needs checking"}</strong></p>
                                        <p>{caregiverSafeGeneratedText(review.rationale) || "No review explanation was recorded."}</p>
                                        <small>{caregiverSafeGeneratedText(review.interpretation_limit) || "Reviewing a note or document does not by itself confirm that a care detail is true."}</small>
                                      </div>)}
                                      {(!item.evidence_reviews_status || item.evidence_reviews_status === "unavailable" || item.evidence_reviews_status === "failed") && <p>We couldn’t load earlier reviews of this note or document.</p>}
                                      {item.evidence_reviews_status === "partial" && <p>We couldn’t check all reviews. The history shown here may be incomplete.</p>}
                                      {item.evidence_reviews_status === "empty" && <p>No review of this note or document has been recorded.</p>}
                                      {item.evidence_reviews_has_more && <p>Only the latest reviews are shown here. Earlier reviews remain in your care history.</p>}
                                      {item.observations?.map((observation, observationIndex) => <div key={"source-observation-" + observationIndex}>
                                        <p>{caregiverSafeGeneratedText(observation.label) || caregiverFieldLabel(observation.attribute) || "Recorded detail"}: {(typeof observation.value === "number" && Number.isFinite(observation.value) ? String(observation.value) : caregiverSafeAssistantText(observation.value)) || "Saved care detail"}</p>
                                        {observation.reported_by && <p>Reported by: {caregiverSafeAssistantText(observation.reported_by) || "Not recorded"}</p>}
                                        {observation.occurred_at && <p>When it happened: {new Date(observation.occurred_at).toLocaleString()}</p>}
                                        {observation.source_excerpt && <blockquote>{caregiverSourceText(observation.source_excerpt)}</blockquote>}
                                      </div>)}
                                    </div>)}
                                  </div>}
                                </div>
                              ))}
                            </div>
                          ) : claim.support_status === 'not_matched_to_saved_wording' ? <p role="note">This statement does not match the wording in a saved record. Check it before relying on it.</p> : null}
                        </article>
                      ))}
                      <p>This conversation has not been added to your Care Record.</p>
                    </section>}
                    {!isUser && msg.freshness_source_status === 'unavailable_schema' && <p className="companion-provenance" role="status">We couldn’t check how recent these care details are. Their current status is unknown.</p>}
                    {!isUser && msg.freshness_source_status === 'no_assessments_returned' && <p className="companion-provenance" role="status">We couldn’t find a review of how recent these care details are. This does not mean they are current.</p>}
                  </div>
                </article>
              })}
              {loading && <div className="companion-message is-assistant" aria-live="polite"><div className="companion-avatar" aria-hidden="true"><Sparkles size={16} /></div><div className="companion-message-body"><div className="companion-message-meta"><strong>SolenOS</strong><span>Working on a response…</span></div><div className="companion-typing" aria-label="SolenOS is responding"><i /><i /><i /></div></div></div>}
              <div ref={bottomRef} />
            </div>
          )}
        </section>
        <aside className="companion-side-note" aria-label="SolenOS guidance"><div className="companion-side-note-icon"><ShieldCheck size={18} aria-hidden="true" /></div><div><strong>Based on saved information</strong><p>SolenOS can help organise notes and questions. It does not diagnose or replace a healthcare professional. You decide whether a suggested care report is added to your Care Record.</p></div></aside>
      </div>

      {(pendingCareUpdates.length > 0 || careUpdateLoading || careUpdateError || careUpdateNotice || showReviewedCareUpdates || availability === 'available' || availability === 'unverified') && <section className="companion-care-updates" aria-label="Care suggestions to review">
        <div className="companion-care-updates-heading">
          <div><span className="companion-kicker">YOUR CARE RECORD</span><h3>Care updates to review</h3><p>These are exact words from your message that may be useful to save. Nothing is added unless you choose to accept it.</p></div>
          <div className="companion-care-updates-tools">
            <button type="button" className="companion-care-refresh" onClick={() => void loadPendingCareUpdates()} disabled={careUpdateLoading || Boolean(reviewingCareUpdateId)}>{careUpdateLoading ? 'Checking…' : 'Refresh'}</button>
            <button type="button" className="companion-care-refresh" onClick={() => {
              const next = !showReviewedCareUpdates
              setShowReviewedCareUpdates(next)
              if (next && reviewedCareUpdates.length === 0) void loadReviewedCareUpdates()
            }} disabled={reviewedCareUpdatesLoading}>{showReviewedCareUpdates ? 'Hide previous decisions' : 'Previous decisions'}</button>
          </div>
        </div>
        {careUpdateError && <p className="companion-care-update-message is-error" role="alert">{careUpdateError}</p>}
        {careUpdateLoadFailed && pendingCareUpdates.length > 0 && <p className="companion-care-update-message" role="status">These are the last suggestions we could load. They may be out of date; refresh before making a decision.</p>}
        {careUpdateNotice && <p className="companion-care-update-message" role="status">{careUpdateNotice}</p>}
        {showReviewedCareUpdates && <section className="companion-reviewed-care-updates" aria-label="Previous care update decisions">
          <h4>Previous decisions</h4>
          <p>Up to 100 of your most recent reviewed reports. A correction is kept as a separate version.</p>
          {reviewedCareUpdatesLoading && <small>Loading previous decisions…</small>}
          {!reviewedCareUpdatesLoading && reviewedCareUpdates.length === 0 && <small>No reviewed care reports were found.</small>}
          {reviewedCareUpdates.map(item => <article className="companion-care-update" key={item.id}>
            <div><strong>{caregiverStatusLabel(item.status) || 'Reviewed'}</strong><p>{caregiverSafeGeneratedText(item.proposed_change?.asserted_value) || item.proposed_change?.source_quote || "The original wording could not be displayed."}</p></div>
            <div className="companion-care-update-actions">
              <button type="button" className="is-secondary" onClick={() => void loadCareUpdateHistory(item.id)} disabled={loadingCareUpdateHistoryId === item.id}>{loadingCareUpdateHistoryId === item.id ? 'Loading history…' : 'Review history'}</button>
            </div>
            {careUpdateHistory[item.id] && <div className="companion-care-update-history">
              {careUpdateHistory[item.id].length === 0 ? <small>No review decisions have been recorded for this version.</small> : careUpdateHistory[item.id].map(entry => <div key={entry.id}>
                <strong>{caregiverStatusLabel(entry.decision) || 'Reviewed'}</strong>
                {entry.rationale && <p>{caregiverSafeGeneratedText(entry.rationale) || 'No further explanation was recorded.'}</p>}
                {entry.correction_context && <small>Correction context: {entry.correction_context}</small>}
                {entry.created_at && <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time>}
              </div>)}
            </div>}
          </article>)}
        </section>}
        {pendingCareUpdates.map(item => <article className="companion-care-update" key={item.id}>
          <div><strong>Possible care update</strong><p>{caregiverSafeGeneratedText(item.proposed_change?.asserted_value) || item.proposed_change?.source_quote || "The original wording could not be displayed."}</p>
            {item.proposed_change?.event_time_text && <small>When you said it happened: {item.proposed_change.event_time_text}</small>}
            <small>This is your report, not a medical conclusion. Adding it records that you checked the wording; it does not mean a healthcare professional has confirmed it.</small>
          </div>
          {correctingCareUpdateId === item.id && <div className="companion-care-update-correction">
            <label htmlFor={'care-update-correction-' + item.id}>Corrected wording</label>
            <textarea id={'care-update-correction-' + item.id} value={correctedCareUpdateText} onChange={event => setCorrectedCareUpdateText(event.target.value)} rows={3} maxLength={4000} />
            <label htmlFor={'care-update-correction-context-' + item.id}>Additional context (optional)</label>
            <textarea id={'care-update-correction-context-' + item.id} value={careUpdateCorrectionContext} onChange={event => setCareUpdateCorrectionContext(event.target.value)} rows={2} maxLength={4000} />
            <small>The correction is saved as a separate version. It still needs its own approval before entering the Care Record.</small>
          </div>}
          <div className="companion-care-update-actions">
            {correctingCareUpdateId === item.id ? <>
              <button type="button" onClick={() => void correctCareUpdate(item.id)} disabled={careUpdateLoading || careUpdateLoadFailed || Boolean(reviewingCareUpdateId) || !correctedCareUpdateText.trim()}>{reviewingCareUpdateId === item.id ? 'Saving correction…' : 'Save correction for review'}</button>
              <button type="button" className="is-secondary" onClick={() => { setCorrectingCareUpdateId(null); setCorrectedCareUpdateText(''); setCareUpdateCorrectionContext('') }} disabled={Boolean(reviewingCareUpdateId)}>Cancel</button>
            </> : <>
              <button type="button" onClick={() => void reviewCareUpdate(item.id, 'accept')} disabled={careUpdateLoading || careUpdateLoadFailed || Boolean(reviewingCareUpdateId)}>{reviewingCareUpdateId === item.id ? 'Saving…' : ''dd to Care Record'}</button>
              <button type="button" className="is-secondary" onClick={() => void reviewCareUpdate(item.id, 'reject')} disabled={careUpdateLoading || careUpdateLoadFailed || Boolean(reviewingCareUpdateId)}>Don’t add</button>
              <button type="button" className="is-secondary" onClick={() => { setCorrectingCareUpdateId(item.id); setCorrectedCareUpdateText(item.proposed_change?.asserted_value || item.proposed_change?.source_quote || '') }} disabled={careUpdateLoading || careUpdateLoadFailed || Boolean(reviewingCareUpdateId)}>Correct wording</button>
            </>}
            <button type="button" className="is-secondary" onClick={() => void loadCareUpdateHistory(item.id)} disabled={loadingCareUpdateHistoryId === item.id}>{loadingCareUpdateHistoryId === item.id ? 'Loading history…' : 'Review history'}</button>
          </div>
          {careUpdateHistory[item.id] && <div className="companion-care-update-history" aria-label="Care update review history">
            {careUpdateHistory[item.id].length === 0 ? <small>No review decisions have been recorded for this version.</small> : careUpdateHistory[item.id].map(entry => <div key={entry.id}>
              <strong>{caregiverStatusLabel(entry.decision) || 'Reviewed'}</strong>
              {entry.rationale && <p>{caregiverSafeGeneratedText(entry.rationale) || 'No further explanation was recorded.'}</p>}
              {entry.correction_context && <small>Correction context: {entry.correction_context}</small>}
              {entry.created_at && <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time>}
            </div>)}
          </div>}
        </article>)}
      </section>}

      <div className="companion-composer-wrap">
        <form className="companion-composer" aria-label="Send a message to SolenOS" onSubmit={event => { event.preventDefault(); void sendMessage() }}>
          <label className="sr-only" htmlFor="companion-message-input">Your message</label>
          <textarea id="companion-message-input" ref={textareaRef} value={input} onChange={event => handleInput(event.target.value)} onKeyDown={event => {
            if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage() }
          }} placeholder="Ask about saved care information, a recent change, or something that is unclear…" disabled={loading || loadingOlderMessages || loadingConversationHistory || (availability !== "available" && availability !== "unverified")} rows={2} />
          <div className="companion-composer-footer">
            <span className="companion-input-hint">Enter to send <span aria-hidden="true">·</span> Shift + Enter for a new line</span><button className="companion-send" type="submit" aria-label={loading ? "Sending" : "Send"} disabled={loading || loadingOlderMessages || loadingConversationHistory || (availability !== "available" && availability !== "unverified") || !input.trim()}>{loading ? <span className="companion-send-spinner" aria-hidden="true" /> : <'rrowUp size={18} strokeWidth={2.4} aria-hidden="true" />}<span>{loading ? ASending' : 'Send'}</span></button></div>
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
        .companion-care-report-action { margin:7px 2px 0; }
        .companion-care-report-action>button,.companion-care-report-confirm button { min-height:34px; padding:7px 10px; border:1px solid #d6e2d5; border-radius:9px; background:#fff; color:#49634c; font:inherit; font-size:10px; font-weight:700; cursor:pointer; }
        .companion-care-report-confirm { display:flex; align-items:center; flex-wrap:wrap; gap:7px; max-width:520px; padding:10px; border:1px solid #e0e9df; border-radius:11px; background:#fbfdfb; }
        .companion-care-report-confirm p { flex:1 1 100%; margin:0; color:#66756a; font-size:11px; line-height:1.5; }
        .companion-care-report-confirm button:first-of-type { background:#e7f0e5; color:#203b27; border-color:#cbdcc9; }
        .companion-care-report-confirm button.is-secondary { background:#fff; color:#526457; }
        .companion-care-report-action button:disabled { opacity:.55; cursor:not-allowed; }
        .companion-care-updates { padding:16px; border:1px solid #dfe8e1; border-radius:16px; background:#fbfdfb; }
        .companion-care-updates-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
        .companion-care-updates-heading h3 { margin:0; color:#25372b; font-size:17px; }
        .companion-care-updates-heading p { margin:5px 0 0; color:#68776e; font-size:12px; line-height:1.55; }
        .companion-care-refresh { min-height:38px; padding:8px 12px; border:1px solid #cfdbd0; border-radius:10px; background:#fff; color:#344b39; font:inherit; font-size:12px; font-weight:700; cursor:pointer; }
        .companion-care-update { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; margin-top:13px; padding:13px; border:1px solid #e2e9e1; border-radius:12px; background:#fff; }
        .companion-care-update>div:first-child { min-width:0; }
        .companion-care-update strong { color:#34463a; font-size:12px; }
        .companion-care-update p { margin:6px 0; color:#26392c; font-size:13px; line-height:1.6; white-space:pre-wrap; overflow-wrap:anywhere; }
        .companion-care-update small { display:block; margin-top:5px; color:#718075; font-size:10px; line-height:1.5; }
.companion-care-updates-tools { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .companion-reviewed-care-updates { display:grid; gap:10px; margin-top:16px; padding-top:16px; border-top:1px solid #e5ece4; }
        .companion-reviewed-care-updates h4 { margin:0; color:#3b5140; font-size:14px; }
        .companion-reviewed-care-updates>p { margin:0; color:#718075; font-size:11px; line-height:1.5; }
        .companion-care-update-correction { display:grid; gap:7px; margin-top:12px; }
        .companion-care-update-correction label { color:#415446; font-size:12px; font-weight:750; }
        .companion-care-update-correction textarea { width:100%; min-width:0; padding:10px 11px; border:1px solid #cfdccf; border-radius:10px; background:#fff; color:#26392c; font:inherit; font-size:13px; line-height:1.55; resize:vertical; }
        .companion-care-update-history { display:grid; gap:9px; margin-top:12px; padding:12px; border:1px solid #e2e9e1; border-radius:12px; background:#f8faf7; }
        .companion-care-update-history>div { padding-bottom:8px; border-bottom:1px solid #e5ece4; }
        .companion-care-update-history>div:last-child { padding-bottom:0; border-bottom:0; }
        .companion-care-update-history strong { text-transform:capitalize; color:#3f5945; font-size:12px; }
        .companion-care-update-history p,.companion-care-update-history small,.companion-care-update-history time { display:block; margin:4px 0 0; color:#68776b; font-size:11px; line-height:1.55; }
        .companion-care-update-actions { display:flex; flex:0 0 auto; flex-wrap:wrap; gap:7px; }
        .companion-care-update-actions button { min-height:38px; padding:8px 11px; border:1px solid #cbdcc9; border-radius:10px; background:#e7f0e5; color:#203b27; font:inherit; font-size:11px; font-weight:750; cursor:pointer; }
        .companion-care-update-actions button.is-secondary { background:#fff; color:#526457; border-color:#dfe8e1; }
        .companion-care-update-actions button:disabled,.companion-care-refresh:disabled { opacity:.55; cursor:not-allowed; }
        .companion-care-update-message { margin:10px 0 0; color:#426849; font-size:12px; line-height:1.5; }
        .companion-care-update-message.is-error { color:#9b2c2c; }
        @media (max-width:650px) { .companion-care-update { flex-direction:column; } .companion-care-update-actions { width:100%; } .companion-care-update-actions button { flex:1; } }
        .companion-shell { --cc-ink:#1d3028; --cc-muted:#68776e; --cc-line:#dfe8e1; width:100%; max-width:1180px; min-width:0; margin:0 auto; display:flex; flex-direction:column; gap:20px; color:var(--cc-ink); font-family:inherit; }
        .companion-topbar { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:4px 0 16px; border-bottom:1px solid var(--cc-line); }
        .companion-brand { display:flex; align-items:center; gap:12px; min-width:0; }
        .companion-mark { display:grid; place-items:center; flex:0 0 46px; width:46px; height:46px; border:1px solid #cbdccb; border-radius:15px; background:#edf5ed; color:#365a40; }
        .companion-eyebrow { font-size:10px; letter-spacing:.14em; font-weight:800; color:#718075; margin-bottom:3px; }
        .companion-brand .companion-page-title { margin:0; font-size:clamp(20px,2.4vw,25px); letter-spacing:-.035em; line-height:1.2; font-weight:750; }
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
        .companion-message-list { padding:24px clamp(16px,3vw,30px); }
        .companion-history-panel { width:100%; padding:14px 16px; border:1px solid #dfe8e1; border-radius:14px; background:#fff; }
        .companion-history-panel-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px; color:#334c38; font-size:13px; }
        .companion-history-panel-heading button { border:0; background:transparent; color:#607066; font:inherit; cursor:pointer; }
        .companion-history-items { display:grid; gap:7px; max-height:240px; overflow:auto; }
        .companion-history-items button { display:flex; flex-direction:column; align-items:flex-start; gap:4px; padding:10px 12px; border:1px solid #e6ece5; border-radius:10px; background:#fafcf9; text-align:left; cursor:pointer; }
        .companion-history-items button:disabled { opacity:.6; cursor:wait; }
        .companion-history-items strong { color:#334c38; font-size:12px; }
        .companion-history-items span { color:#7a877c; font-size:10px; }
        .companion-history-more { margin-top:10px; min-height:36px; padding:7px 12px; border:1px solid #dce6da; border-radius:999px; background:#f8faf7; color:#47634a; font:inherit; font-size:11px; font-weight:700; cursor:pointer; }
        .companion-history-more:disabled { opacity:.6; cursor:wait; }
        .companion-history-toggle { min-height:40px; padding:8px 12px; border:1px solid #dce6da; border-radius:999px; background:#f8faf7; color:#47634a; font:inherit; font-size:12px; font-weight:700; cursor:pointer; }
        .companion-history-toggle:disabled { opacity:.6; cursor:wait; }
        @media(max-width:560px) { .companion-history-toggle { min-height:38px; padding:7px 9px; font-size:10px; } }
        .companion-history-older { display:flex; justify-content:center; padding:0 0 18px; }
        .companion-history-older button { min-height:38px; padding:8px 13px; border:1px solid #dce6da; border-radius:999px; background:#f8faf7; color:#47634a; font:inherit; font-size:12px; font-weight:700; cursor:pointer; }
        .companion-history-older button:disabled { opacity:.6; cursor:wait; }
        .companion-history-error { margin:0 0 14px; color:#8b493f; text-align:center; font-size:12px; } .companion-thread-label { display:flex; justify-content:space-between; gap:12px; padding-bottom:14px; margin-bottom:22px; border-bottom:1px solid #edf1ed; color:#849087; font-size:10px; font-weight:800; letter-spacing:.1em; }
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
          .companion-eyebrow { font-size:9px; } .companion-brand .companion-page-title { font-size:21px; } .companion-new { width:42px; min-width:42px; padding:0; gap:0; } .companion-new span { display:none; }
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
        .companion-shell.is-home .companion-brand .companion-page-title { font-size:18px; font-weight:650; letter-spacing:-.02em; }
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
