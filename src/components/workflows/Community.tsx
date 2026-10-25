import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { Bookmark, Check, ChevronRight, HeartHandshake, MessageCircle, Search, ShieldCheck, Sparkles, ThumbsUp, Users, X } from 'lucide-react'
import { getJSON, postJSON, getCaregiverId } from '@/api/client'

type AuthorType = 'peer_caregiver' | 'solenos_verified' | 'professional' | 'professional_pending'
type ReactionType = 'like' | 'thank_you' | 'support'
type CareStage = 'early' | 'moderate' | 'late' | 'unspecified'
type Visibility = 'public' | 'circle' | 'anonymous'
type PostType = 'experience' | 'question'

interface CommunityPost {
  id: string
  author_type: AuthorType
  author_label: string
  author_avatar_seed: string
  title: string | null
  body: string
  media: { url: string; mime_type: string; alt: string | null }[]
  visibility: Visibility
  care_stage: CareStage
  tags: string[]
  created_at: string
  updated_at: string | null
  provenance_source: string
  reaction_counts: Record<ReactionType, number>
  comment_count: number
  user_reaction: ReactionType | null
}
interface CommunityPostSummary { identity: string; posts: CommunityPost[] }
interface ExperienceMatch { post_id: string; author_label: string; author_type: string; content: string; tags: string[] }
interface ExperienceResult {
  summary: string | null
  matches: ExperienceMatch[]
  post_ids: string[]
  provider_status: 'connected' | 'not_configured' | 'error' | 'not_needed'
  ai_generated: boolean
  notice: string
}

const STAGES: { value: CareStage | 'all'; label: string }[] = [
  { value: 'all', label: 'All stages' },
  { value: 'early', label: 'Early stage' },
  { value: 'moderate', label: 'Moderate stage' },
  { value: 'late', label: 'Later stage' },
]
const TAGS = ['All topics', 'sundowning', 'wandering', 'sleep', 'communication', 'behavior', 'safety', 'medication', 'nutrition', 'activities', 'routine']
const baseButton: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  minHeight: 42, padding: '10px 15px', borderRadius: 12, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 14, fontWeight: 600,
  cursor: 'pointer', transition: 'background 150ms ease, border-color 150ms ease',
}
const cardStyle: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
  padding: 'clamp(16px, 3vw, 24px)', minWidth: 0,
}
const muted: CSSProperties = { color: 'var(--text-secondary)' }

function timeLabel(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Recently shared'
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  if (minutes < 10080) return `${Math.floor(minutes / 1440)}d ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function authorDetails(type: AuthorType) {
  if (type === 'solenos_verified') return { label: 'SolenOS verified', mark: '✓' }
  if (type === 'professional') return { label: 'Care professional', mark: '✦' }
  if (type === 'professional_pending') return { label: 'Professional profile', mark: '•' }
  return { label: 'Caregiver', mark: '' }
}
function safeCount(value: number | undefined) { return Number.isFinite(value) && value! > 0 ? value : 0 }

export default function Community() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerText, setComposerText] = useState('')
  const [postType, setPostType] = useState<PostType>('experience')
  const [submitting, setSubmitting] = useState(false)
  const [activeTag, setActiveTag] = useState('All topics')
  const [activeStage, setActiveStage] = useState<CareStage | 'all'>('all')
  const [search, setSearch] = useState('')
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set())
  const [savedOnly, setSavedOnly] = useState(false)
  const [wisdomQuery, setWisdomQuery] = useState('')
  const [wisdomMatches, setWisdomMatches] = useState<ExperienceMatch[]>([])
  const [wisdomSummary, setWisdomSummary] = useState<string | null>(null)
  const [wisdomLoading, setWisdomLoading] = useState(false)
  const [wisdomMessage, setWisdomMessage] = useState('')
  const caregiverId = getCaregiverId()

  async function loadPosts(showLoading = true) {
    if (showLoading) setLoading(true)
    setLoadError('')
    try {
      const result = await getJSON('/community') as CommunityPostSummary
      if (!Array.isArray(result?.posts)) throw new Error('Invalid community response')
      setPosts(result.posts)
    } catch {
      setPosts([])
      setLoadError('We couldn’t load community posts right now. Please try again.')
    } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    try {
      const raw = localStorage.getItem('solenos_saved_posts')
      if (raw) {
        const parsed: unknown = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.every((item) => typeof item === 'string')) setSavedPosts(new Set(parsed))
      }
    } catch { /* Ignore invalid local saved-post preferences. */ }
    getJSON('/community')
      .then((value) => {
        const result = value as CommunityPostSummary
        if (!Array.isArray(result?.posts)) throw new Error('Invalid community response')
        if (!cancelled) { setPosts(result.posts); setLoadError('') }
      })
      .catch(() => {
        if (!cancelled) { setPosts([]); setLoadError('We couldn’t load community posts right now. Please try again.') }
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const filteredPosts = useMemo(() => posts.filter((post) => {
    if (activeTag !== 'All topics' && !post.tags?.includes(activeTag)) return false
    if (activeStage !== 'all' && post.care_stage !== activeStage) return false
    if (savedOnly && !savedPosts.has(post.id)) return false
    const query = search.trim().toLocaleLowerCase()
    if (query && ![post.title, post.body, post.author_label, ...(post.tags ?? [])].some((value) => value?.toLocaleLowerCase().includes(query))) return false
    return true
  }), [posts, activeTag, activeStage, savedOnly, savedPosts, search])

  function toggleSave(postId: string) {
    setSavedPosts((previous) => {
      const next = new Set(previous)
      if (next.has(postId)) next.delete(postId)
      else next.add(postId)
      try { localStorage.setItem('solenos_saved_posts', JSON.stringify([...next])) } catch { /* Saving is local to this browser. */ }
      return next
    })
  }

  async function reactTo(postId: string, reactionType: ReactionType) {
    setActionMessage('')
    if (!caregiverId) { setActionMessage('Please reopen SolenOS so your caregiver session can be restored before reacting.'); return }
    try {
      await postJSON(`/community/${encodeURIComponent(postId)}/reactions`, { caregiver_id: caregiverId, reaction_type: reactionType })
      await loadPosts(false)
      setActionMessage('Your response was saved.')
    } catch {
      setActionMessage('We couldn’t confirm that response. Please try again.')
    }
  }

  async function submitPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = composerText.trim()
    if (!content || submitting) return
    if (!caregiverId) { setActionMessage('Please reopen SolenOS so your caregiver session can be restored before sharing. Your draft is still here.'); return }
    setSubmitting(true)
    setActionMessage('')
    try {
      await postJSON('/community', {
        caregiver_id: caregiverId,
        author_type: 'peer_caregiver',
        author_label: 'Anonymous caregiver',
        post_type: postType,
        content,
        visibility: 'public',
      })
      setComposerText('')
      setComposerOpen(false)
      setActionMessage('Your experience was shared.')
      await loadPosts(false)
    } catch {
      setActionMessage('We couldn’t confirm your post. Your draft is still here so you can try again.')
    } finally { setSubmitting(false) }
  }

  async function findExperiences(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = wisdomQuery.trim()
    if (!query || wisdomLoading) return
    setWisdomLoading(true); setWisdomMessage(''); setWisdomMatches([]); setWisdomSummary(null)
    try {
      let result: ExperienceResult
      try {
        result = await postJSON('/community/experience/summary', { observation: query }) as ExperienceResult
      } catch (error) {
        if (!(error instanceof Error) || !/API 404/i.test(error.message)) throw error
        const legacy = await postJSON('/community/experience', { observation: query }) as { matches?: ExperienceMatch[] }
        if (!Array.isArray(legacy?.matches)) throw new Error('No matches')
        setWisdomMatches(legacy.matches.slice(0, 4))
        setWisdomMessage(legacy.matches.length ? 'Related published experiences. No automated summary was available.' : 'No related published experiences were found.')
        return
      }
      if (!Array.isArray(result?.matches)) throw new Error('No matches')
      setWisdomMatches(result.matches.slice(0, 4))
      setWisdomSummary(result.ai_generated && typeof result.summary === 'string' ? result.summary : null)
      setWisdomMessage(result.notice || (result.matches.length ? 'These are personal experiences, not medical instructions.' : 'No related published experiences were found.'))
    } catch {
      setWisdomMessage('Experience search is unavailable right now. You can still browse published posts below.')
    } finally { setWisdomLoading(false) }
  }

  const resetFilters = () => { setActiveTag('All topics'); setActiveStage('all'); setSavedOnly(false); setSearch('') }

  return (
    <section style={{ display: 'grid', gap: 22, color: 'var(--text)', minWidth: 0 }}>
      <header style={{ ...cardStyle, background: 'linear-gradient(135deg, var(--surface) 0%, var(--accent-soft) 100%)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...muted, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          <Users size={16} aria-hidden="true" /> CAREGIVERS, TOGETHER
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', marginTop: 12 }}>
          <div style={{ maxWidth: 650 }}>
            <h2 style={{ fontSize: 'clamp(25px, 4vw, 36px)', lineHeight: 1.15, letterSpacing: '-.035em', margin: '0 0 10px', fontWeight: 750 }}>
              You don’t have to figure it all out alone.
            </h2>
            <p style={{ margin: 0, lineHeight: 1.7, fontSize: 15, ...muted }}>
              Real experiences from people caring for someone with dementia. Find ideas, ask a question, or share what helped your family.
            </p>
          </div>
          <button type="button" onClick={() => setComposerOpen((open) => !open)} style={{ ...baseButton, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', flexShrink: 0 }}>
            {composerOpen ? <X size={17} /> : <Sparkles size={17} />}
            {composerOpen ? 'Close editor' : 'Share an experience'}
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 18 }}>
          <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center', fontSize: 12, borderRadius: 999, padding: '7px 11px', background: 'var(--surface)', border: '1px solid var(--border)' }}><ShieldCheck size={14} /> Respectful peer support</span>
          <span style={{ display: 'inline-flex', gap: 7, alignItems: 'center', fontSize: 12, borderRadius: 999, padding: '7px 11px', background: 'var(--surface)', border: '1px solid var(--border)' }}><HeartHandshake size={14} /> Lived experience, shared carefully</span>
        </div>
      </header>

      {composerOpen && <form onSubmit={submitPost} style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <div>
          <h3 style={{ margin: '0 0 5px', fontSize: 19 }}>What would you like to share?</h3>
          <p style={{ ...muted, margin: 0, fontSize: 13, lineHeight: 1.6 }}>Share only what you’re comfortable making public. Leave out names, addresses, and identifying details.</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {([{ value: 'experience', label: 'Something that helped' }, { value: 'question', label: 'A question for caregivers' }] as const).map((option) => (
            <button key={option.value} type="button" onClick={() => setPostType(option.value)} aria-pressed={postType === option.value} style={{ ...baseButton, background: postType === option.value ? 'var(--accent-soft)' : 'var(--surface)', borderColor: postType === option.value ? 'var(--accent)' : 'var(--border)' }}>{postType === option.value && <Check size={15} />}{option.label}</button>
          ))}
        </div>
        <label htmlFor="community-post" style={{ display: 'grid', gap: 7, fontSize: 13, fontWeight: 650 }}>
          {postType === 'question' ? 'Your question' : 'Your experience'}
          <textarea id="community-post" required maxLength={5000} value={composerText} onChange={(event) => setComposerText(event.target.value)} placeholder={postType === 'question' ? 'What has been difficult lately? What have you already tried?' : 'What happened, what did you try, and what seemed to help?'} style={{ width: '100%', minHeight: 130, resize: 'vertical', border: '1px solid var(--border)', borderRadius: 12, padding: 14, background: 'var(--bg)', color: 'var(--text)', font: 'inherit', fontSize: 14, lineHeight: 1.65 }} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ ...muted, fontSize: 12 }}>{composerText.length}/5000 · Peer experiences are not medical advice.</span>
          <button type="submit" disabled={submitting || !composerText.trim()} style={{ ...baseButton, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', opacity: submitting || !composerText.trim() ? .55 : 1 }}>{submitting ? 'Sharing…' : 'Publish to community'} <ChevronRight size={16} /></button>
        </div>
      </form>}

      <section style={{ ...cardStyle, display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 12, background: 'var(--accent-soft)', color: 'var(--accent)' }}><Search size={18} /></div>
          <div><h3 style={{ margin: 0, fontSize: 17 }}>Find experiences like yours</h3><p style={{ margin: '3px 0 0', ...muted, fontSize: 13 }}>Search published peer stories by what’s happening today.</p></div>
        </div>
        <form onSubmit={findExperiences} style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
          <input aria-label="Search community experiences" value={wisdomQuery} onChange={(event) => setWisdomQuery(event.target.value)} placeholder="e.g. evening restlessness, sleep, wandering" style={{ flex: '1 1 240px', minWidth: 0, minHeight: 44, padding: '10px 13px', borderRadius: 11, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', font: 'inherit', fontSize: 14 }} />
          <button type="submit" disabled={wisdomLoading || !wisdomQuery.trim()} style={{ ...baseButton, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)', opacity: wisdomLoading || !wisdomQuery.trim() ? .55 : 1 }}>{wisdomLoading ? 'Searching…' : 'Find experiences'}</button>
        </form>
        {wisdomMessage && <p role="status" style={{ ...muted, margin: 0, fontSize: 13 }}>{wisdomMessage}</p>}
        {wisdomSummary && <div style={{ borderRadius: 12, background: 'var(--accent-soft)', padding: 14, lineHeight: 1.7, fontSize: 14 }}><strong style={{ display: 'block', marginBottom: 5 }}>A summary of shared experiences</strong>{wisdomSummary}</div>}
        {wisdomMatches.map((match) => <article key={match.post_id} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 13 }}>
          <strong style={{ fontSize: 13 }}>{match.author_label || 'Community member'}</strong>
          <p style={{ margin: '5px 0 8px', lineHeight: 1.65, fontSize: 14 }}>{match.content}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{match.tags?.map((tag) => <span key={tag} style={{ ...muted, border: '1px solid var(--border)', borderRadius: 999, padding: '3px 8px', fontSize: 11 }}>{tag}</span>)}</div>
        </article>)}
      </section>

      <section style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div><h3 style={{ margin: '0 0 4px', fontSize: 21, letterSpacing: '-.02em' }}>Community stories</h3><p style={{ margin: 0, ...muted, fontSize: 13 }}>{loading ? 'Loading shared experiences…' : `${filteredPosts.length} ${filteredPosts.length === 1 ? 'story' : 'stories'} to explore`}</p></div>
          <button type="button" onClick={() => setSavedOnly((value) => !value)} aria-pressed={savedOnly} style={{ ...baseButton, background: savedOnly ? 'var(--accent-soft)' : 'var(--surface)' }}><Bookmark size={16} /> {savedOnly ? 'Saved stories' : 'Show saved'}</button>
        </div>
        <label style={{ position: 'relative', display: 'block' }}>
          <Search size={17} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', ...muted }} />
          <input aria-label="Search community posts" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search stories, topics, or keywords" style={{ width: '100%', minHeight: 46, padding: '11px 14px 11px 42px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', font: 'inherit', fontSize: 14 }} />
        </label>
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }} aria-label="Filter by topic">
            {TAGS.map((tag) => <button key={tag} type="button" onClick={() => setActiveTag(tag)} aria-pressed={activeTag === tag} style={{ ...baseButton, minHeight: 35, padding: '6px 11px', borderRadius: 999, fontSize: 12, background: activeTag === tag ? 'var(--accent-soft)' : 'var(--surface)', borderColor: activeTag === tag ? 'var(--accent)' : 'var(--border)' }}>{tag}</button>)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }} aria-label="Filter by care stage">
            {STAGES.map((stage) => <button key={stage.value} type="button" onClick={() => setActiveStage(stage.value)} aria-pressed={activeStage === stage.value} style={{ ...baseButton, minHeight: 35, padding: '6px 11px', borderRadius: 10, fontSize: 12, background: activeStage === stage.value ? 'var(--accent-soft)' : 'var(--surface)', borderColor: activeStage === stage.value ? 'var(--accent)' : 'var(--border)' }}>{stage.label}</button>)}
          </div>
        </div>

        {(activeTag !== 'All topics' || activeStage !== 'all' || savedOnly || search) && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><span style={{ ...muted, fontSize: 12 }}>Filters are on</span><button type="button" onClick={resetFilters} style={{ ...baseButton, minHeight: 34, padding: '5px 10px', fontSize: 12 }}><X size={14} /> Clear filters</button></div>}

        {loadError && <div role="alert" style={{ ...cardStyle, display: 'grid', gap: 10 }}><p style={{ margin: 0 }}>{loadError}</p><button type="button" onClick={loadPosts} style={{ ...baseButton, justifySelf: 'start' }}>Try again</button></div>}
        {loading && <div aria-live="polite" style={{ ...cardStyle, textAlign: 'center', padding: 34 }}><div style={{ fontWeight: 650 }}>Loading community stories</div><p style={{ ...muted, marginBottom: 0, fontSize: 13 }}>Bringing the latest published experiences together.</p></div>}
        {!loading && !loadError && filteredPosts.length === 0 && <div style={{ ...cardStyle, textAlign: 'center', padding: 'clamp(24px, 5vw, 44px)' }}>
          <div style={{ width: 54, height: 54, margin: '0 auto 14px', borderRadius: 18, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)' }}><HeartHandshake size={25} /></div>
          <h4 style={{ margin: '0 0 8px', fontSize: 18 }}>{posts.length === 0 && !savedOnly && activeTag === 'All topics' && activeStage === 'all' && !search ? 'Your community starts here' : 'No stories match these filters'}</h4>
          <p style={{ ...muted, maxWidth: 430, margin: '0 auto 18px', lineHeight: 1.7, fontSize: 14 }}>{posts.length === 0 ? 'There are no published posts to show yet. You can be the first to share a helpful moment or ask a question.' : 'Try a different topic or clear your filters to see more shared experiences.'}</p>
          {posts.length === 0 ? <button type="button" onClick={() => setComposerOpen(true)} style={{ ...baseButton, background: 'var(--accent)', color: '#fff', borderColor: 'var(--accent)' }}>Share the first experience <ChevronRight size={16} /></button> : <button type="button" onClick={resetFilters} style={baseButton}>Clear filters</button>}
        </div>}

        {!loading && !loadError && filteredPosts.map((post) => {
          const author = authorDetails(post.author_type)
          const saved = savedPosts.has(post.id)
          return <article key={post.id} style={{ ...cardStyle, display: 'grid', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ display: 'flex', gap: 11, minWidth: 0, alignItems: 'center' }}>
                <div aria-hidden="true" style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 15, display: 'grid', placeItems: 'center', background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 750 }}>{(post.author_avatar_seed || post.author_label || 'C').slice(0, 1).toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}><strong style={{ fontSize: 14 }}>{post.author_label || 'Community member'}</strong><span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, borderRadius: 999, padding: '3px 8px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>{author.mark && <span aria-hidden="true">{author.mark}</span>}{author.label}</span></div>
                  <div style={{ ...muted, fontSize: 12, marginTop: 3 }}>{timeLabel(post.created_at)}{post.care_stage && post.care_stage !== 'unspecified' ? ` · ${STAGES.find((stage) => stage.value === post.care_stage)?.label || ''}` : ''}</div>
                </div>
              </div>
              <button type="button" onClick={() => toggleSave(post.id)} aria-label={saved ? 'Remove saved story' : 'Save story'} aria-pressed={saved} title={saved ? 'Saved' : 'Save story'} style={{ ...baseButton, minHeight: 38, width: 38, padding: 0, borderRadius: 11, color: saved ? 'var(--accent)' : 'var(--text-secondary)' }}>{saved ? <Check size={17} /> : <Bookmark size={17} />}</button>
            </div>
            {post.title && <h4 style={{ margin: 0, fontSize: 18, lineHeight: 1.4 }}>{post.title}</h4>}
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{post.body}</p>
            {!!post.tags?.length && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{post.tags.map((tag) => <button key={tag} type="button" onClick={() => setActiveTag(tag)} style={{ ...muted, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 999, padding: '5px 9px', fontSize: 11, cursor: 'pointer' }}>#{tag}</button>)}</div>}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 7 }}>
              <button type="button" onClick={() => reactTo(post.id, 'like')} aria-pressed={post.user_reaction === 'like'} style={{ ...baseButton, minHeight: 36, padding: '6px 10px', fontSize: 12, background: post.user_reaction === 'like' ? 'var(--accent-soft)' : 'transparent' }}><ThumbsUp size={15} /> Helpful {safeCount(post.reaction_counts?.like) > 0 && safeCount(post.reaction_counts?.like)}</button>
              <button type="button" onClick={() => reactTo(post.id, 'thank_you')} aria-pressed={post.user_reaction === 'thank_you'} style={{ ...baseButton, minHeight: 36, padding: '6px 10px', fontSize: 12, background: post.user_reaction === 'thank_you' ? 'var(--accent-soft)' : 'transparent' }}>Thank you {safeCount(post.reaction_counts?.thank_you) > 0 && safeCount(post.reaction_counts?.thank_you)}</button>
              <button type="button" onClick={() => reactTo(post.id, 'support')} aria-pressed={post.user_reaction === 'support'} style={{ ...baseButton, minHeight: 36, padding: '6px 10px', fontSize: 12, background: post.user_reaction === 'support' ? 'var(--accent-soft)' : 'transparent' }}><HeartHandshake size={15} /> Support {safeCount(post.reaction_counts?.support) > 0 && safeCount(post.reaction_counts?.support)}</button>
              <span style={{ ...muted, display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 'auto', fontSize: 12 }}><MessageCircle size={15} /> {safeCount(post.comment_count)} responses</span>
            </div>
          </article>
        })}
      </section>

      {actionMessage && <div role="status" aria-live="polite" style={{ ...cardStyle, padding: '12px 15px', fontSize: 13, display: 'flex', gap: 9, alignItems: 'center' }}><ShieldCheck size={17} style={{ color: 'var(--accent)', flexShrink: 0 }} />{actionMessage}<button type="button" aria-label="Dismiss message" onClick={() => setActionMessage('')} style={{ ...baseButton, marginLeft: 'auto', minHeight: 30, width: 30, padding: 0 }}><X size={14} /></button></div>}
      <footer style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '4px 2px 12px', ...muted }}>
        <ShieldCheck size={17} style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.7 }}>Community stories describe personal experiences, not medical advice. Do not post identifying information. Confirm care decisions and medication changes with a qualified clinician. Community posts never update your Living Care Record automatically.</p>
      </footer>
    </section>
  )
}
