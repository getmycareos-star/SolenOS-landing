import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON, postJSON, getPersonId } from '../api/client'

type AuthorType = 'peer_caregiver' | 'solenos_verified' | 'professional' | 'professional_pending'
type ReactionType = 'like' | 'thank_you' | 'support'
type CareStage = 'early' | 'moderate' | 'late' | 'unspecified'
type Visibility = 'public' | 'circle' | 'anonymous'

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

interface CommunityPostSummary {
  identity: string
  posts: CommunityPost[]
}

interface ExperienceMatch {
  post_id: string
  author_label: string
  author_type: string
  content: string
  tags: string[]
}

interface ExperienceResult {
  matches: ExperienceMatch[]
}

const STAGE_LABELS: Record<CareStage, string> = {
  early: 'Early stage',
  moderate: 'Moderate',
  late: 'Late stage',
  unspecified: 'All stages',
}

const STAGE_COLORS: Record<CareStage, string> = {
  early: 'var(--trust)',
  moderate: 'var(--unknown)',
  late: '#dc2626',
  unspecified: 'var(--text-secondary)',
}

type PostType = 'experience' | 'question'

const POST_TYPE_OPTIONS: { value: PostType; label: string; placeholder: string; emoji: string }[] = [
  { value: 'experience', label: 'Share What Worked', placeholder: 'Share a tip, routine, or moment that helped...', emoji: '💡' },
  { value: 'question', label: 'Ask the Community', placeholder: 'What are you struggling with? Other caregivers may have insight.', emoji: '❓' },
]

const TAG_COLORS: Record<string, { bg: string; text: string }> = {
  sundowning: { bg: 'var(--trust-soft)', text: 'var(--trust)' },
  wandering: { bg: 'var(--unknown-soft)', text: 'var(--unknown)' },
  medication: { bg: '#fef2f2', text: '#dc2626' },
  behavior: { bg: '#ffefed', text: '#ea580c' },
  sleep: { bg: '#f0fdfa', text: '#0d9488' },
  communication: { bg: '#eff6ff', text: '#2563eb' },
  mobility: { bg: '#faf5ff', text: '#7c3aed' },
  nutrition: { bg: '#fff7ed', text: '#ea580c' },
  safety: { bg: '#fff1f2', text: '#db2777' },
  activities: { bg: 'var(--accent-soft)', text: 'var(--accent)' },
  routine: { bg: '#f8faff', text: '#475569' },
  appointments: { bg: '#f1f5f9', text: '#334159' },
  hydration: { bg: '#ecfdf5', text: 'var(--trust)' },
  general: { bg: 'var(--surface)', text: 'var(--text-secondary)' },
}

const DEFAULT_TAG_COLORS = { bg: 'var(--accent-soft)', text: 'var(--text-secondary)' }

function authorBadge(authorType: AuthorType) {
  switch (authorType) {
    case 'solenos_verified':
      return { emoji: '🛡️', label: 'SolenOS verified', bg: 'var(--trust-soft)', text: 'var(--trust)' }
    case 'professional':
      return { emoji: '👩‍⚕️', label: 'Professional', bg: '#eff6ff', text: '#2563eb' }
    case 'professional_pending':
      return { emoji: '👤', label: 'Professional (pending)', bg: 'var(--unknown-soft)', text: 'var(--unknown)' }
    default:
      return { emoji: '🧑', label: 'Peer caregiver', bg: 'var(--accent-soft)', text: 'var(--accent)' }
  }
}

function formatTime(createdAt: string): string {
  const date = new Date(createdAt)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function tagColor(tag: string) {
  return TAG_COLORS[tag] ?? DEFAULT_TAG_COLORS
}

const SAMPLE_POSTS: CommunityPost[] = [
  {
    id: 'sample-1',
    author_type: 'peer_caregiver',
    author_label: 'Sarah M.',
    author_avatar_seed: 'sm',
    title: 'Managing sundowning evenings',
    body: 'Dad starts getting agitated around 5pm — pacing, asking where Mom is. The thing that finally helps is dimming lights 30 minutes before, playing his old jazz playlist, and quietly redirecting with a simple task like folding towels. It\'s not perfect, but the episodes dropped from daily to 2-3 times a week.',
    media: [],
    visibility: 'public',
    care_stage: 'moderate',
    tags: ['sundowning', 'behavior', 'activities', 'sleep'],
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    updated_at: null,
    provenance_source: 'community:peer_caregiver',
    reaction_counts: { like: 34, thank_you: 18, support: 12 },
    comment_count: 5,
    user_reaction: null,
  },
  {
    id: 'sample-2',
    author_type: 'peer_caregiver',
    author_label: 'Robert & Maria',
    author_avatar_seed: 'rm',
    title: 'Medication adherence hack',
    body: 'Mom refused her evening meds for three days straight — we tried pill organizers, reminders, everything. Finally worked: mixing the small pill in a tiny bit of applesauce she loves. Not medical advice, just sharing what got us past this particular hurdle.',
    media: [],
    visibility: 'public',
    care_stage: 'moderate',
    tags: ['medication', 'behavior'],
    created_at: new Date(Date.now() - 5 * 3600000).toISOString(),
    updated_at: null,
    provenance_source: 'community:peer_caregiver',
    reaction_counts: { like: 52, thank_you: 28, support: 7 },
    comment_count: 9,
    user_reaction: null,
  },
  {
    id: 'sample-3',
    author_type: 'solenos_verified',
    author_label: 'SolenOS',
    author_avatar_seed: 'so',
    title: 'Before your next appointment',
    body: 'Based on your care record, here are the top items to discuss with the neurologist: (1) recent weight trend — noted 3 lb loss over 2 weeks, (2) wandering episodes increased to 4x this week, (3) new sleep pattern — waking 2-3 hours earlier. Other dementia caregivers flagged tracking daily weight as important before visits.',
    media: [],
    visibility: 'public',
    care_stage: 'moderate',
    tags: ['medication', 'wandering', 'nutrition', 'appointments'],
    created_at: new Date(Date.now() - 8 * 3600000).toISOString(),
    updated_at: null,
    provenance_source: 'community:solenos_verified',
    reaction_counts: { like: 15, thank_you: 9, support: 3 },
    comment_count: 2,
    user_reaction: null,
  },
  {
    id: 'sample-4',
    author_type: 'peer_caregiver',
    author_label: 'Elena R.',
    author_avatar_seed: 'er',
    title: 'Safe home setup — what worked for wandering',
    body: 'Installed door alarms and removed keys from his pocket (he kept trying to leave). Also put a motion sensor nightlight in the hallway. The alarms are loud but they give me enough time to redirect before he reaches the door. Still not foolproof, but safer.',
    media: [],
    visibility: 'public',
    care_stage: 'late',
    tags: ['wandering', 'safety', 'mobility'],
    created_at: new Date(Date.now() - 22 * 3600000).toISOString(),
    updated_at: null,
    provenance_source: 'community:peer_caregiver',
    reaction_counts: { like: 28, thank_you: 14, support: 19 },
    comment_count: 6,
    user_reaction: null,
  },
  {
    id: 'sample-5',
    author_type: 'peer_caregiver',
    author_label: 'David K.',
    author_avatar_seed: 'dk',
    title: 'Calming techniques for agitation',
    body: 'When Dad gets combative or confused, I\'ve learned NOT to argue or correct him. Instead: validate his emotion ("I can see you\'re upset"), offer physical comfort (hand on shoulder), and redirect to a familiar activity (looking at photo albums). It doesn\'t eliminate agitation but reduces its intensity.',
    media: [],
    visibility: 'public',
    care_stage: 'moderate',
    tags: ['behavior', 'communication', 'activities'],
    created_at: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
    updated_at: null,
    provenance_source: 'community:peer_caregiver',
    reaction_counts: { like: 41, thank_you: 23, support: 16 },
    comment_count: 8,
    user_reaction: null,
  },
]

export default function Community() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  const [composerText, setComposerText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [activeStage, setActiveStage] = useState<CareStage | null>(null)
  const [postType, setPostType] = useState<PostType>('experience')
  const [savedPosts, setSavedPosts] = useState<Set<string>>(new Set())
  const [wisdomQuery, setWisdomQuery] = useState('')
  const [wisdomMatches, setWisdomMatches] = useState<ExperienceMatch[]>([])
  const [loadingWisdom, setLoadingWisdom] = useState(false)

  const personId = getPersonId()

  useEffect(() => {
    const saved = localStorage.getItem('solenos_saved_posts')
    if (saved) {
      try {
        setSavedPosts(new Set(JSON.parse(saved)))
      } catch {}
    }
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const data = await getJSON(`/community?caregiver_id=${personId}`) as CommunityPostSummary
        setPosts(data.posts ?? [])
      } catch (e) {
        console.error(e)
        setPosts(SAMPLE_POSTS)
      } finally {
        setLoading(false)
      }
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId])

  async function handleReaction(postId: string, reactionType: ReactionType) {
    try {
      await postJSON(`/community/${postId}/reactions`, {
        caregiver_id: personId,
        reaction_type: reactionType,
      })
    } catch (e) {
      console.error(e)
    }
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p
      const counts = { ...p.reaction_counts }
      if (p.user_reaction === reactionType) {
        counts[reactionType] = Math.max(0, counts[reactionType] - 1)
        return { ...p, reaction_counts: counts, user_reaction: null }
      }
      if (p.user_reaction) {
        counts[p.user_reaction] = Math.max(0, counts[p.user_reaction] - 1)
      }
      counts[reactionType] = counts[reactionType] + 1
      return { ...p, reaction_counts: counts, user_reaction: reactionType }
    }))
  }

  function toggleSave(postId: string) {
    const newSaved = new Set(savedPosts)
    if (newSaved.has(postId)) {
      newSaved.delete(postId)
    } else {
      newSaved.add(postId)
    }
    setSavedPosts(newSaved)
    localStorage.setItem('solenos_saved_posts', JSON.stringify([...newSaved]))
  }

  async function fetchWisdom() {
    if (!wisdomQuery.trim()) return
    setLoadingWisdom(true)
    try {
      const data = await postJSON('/community/experience', { observation: wisdomQuery.trim() }) as ExperienceResult
      if (data?.matches) {
        setWisdomMatches(data.matches.slice(0, 4))
      }
    } catch {
      setWisdomMatches([])
    } finally {
      setLoadingWisdom(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!composerText.trim()) return
    setSubmitting(true)
    try {
      await postJSON('/community', {
        caregiver_id: personId,
        author_type: 'peer_caregiver',
        author_label: 'Anonymous caregiver',
        post_type: postType,
        content: composerText.trim(),
        visibility: 'public',
      })
      setComposerText('')
      setComposerOpen(false)
      const response = await getJSON(`/community?caregiver_id=${personId}`) as CommunityPostSummary
      setPosts(response.posts ?? [])
    } catch (e) {
      console.error(e)
      setComposerText('')
      setComposerOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  const filteredPosts = posts.filter(p => {
    if (activeTag && !p.tags.includes(activeTag)) return false
    if (activeStage && p.care_stage !== activeStage) return false
    return true
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '4px' }}>Community</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', maxWidth: '500px' }}>
            Shared experiences from caregivers like you. When you capture what changed in "What Matters Today," similar experiences surface here.
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.7, marginTop: '4px' }}>
            Shared experience is not medical advice — always confirm with a clinician.
          </p>
        </div>
        <Link to="/" style={{ fontSize: '12px', color: 'var(--text-secondary)', textDecoration: 'none' }}>
          ← Back to capture
        </Link>
      </div>

      {/* Care-Record Wisdom section — connects community to care context */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '16px 20px', marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '14px' }}>💡</span>
          <h2 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>
            Wisdom from your care record
          </h2>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
          Enter something you're managing today to find how other caregivers handled it.
        </p>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            value={wisdomQuery}
            onChange={(e) => setWisdomQuery(e.target.value)}
            placeholder="e.g. wandering overnight, evening agitation, medication refusal"
            style={{
              flex: 1, padding: '8px 12px', borderRadius: '8px',
              border: '1px solid var(--border)', background: 'var(--bg)',
              fontSize: '13px', outline: 'none',
            }}
          />
          <button
            onClick={fetchWisdom}
            disabled={loadingWisdom || !wisdomQuery.trim()}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: loadingWisdom || !wisdomQuery.trim()
                ? 'var(--text-secondary)' : 'var(--accent)',
              color: 'white', fontSize: '13px', cursor: 'default',
            }}
          >
            {loadingWisdom ? '...' : 'Find wisdom'}
          </button>
        </div>

        {wisdomMatches.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {wisdomMatches.map(m => (
              <div key={m.post_id} style={{
                padding: '10px 14px', background: 'var(--bg)',
                borderRadius: '8px', border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text)' }}>{m.author_label}</div>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{m.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setComposerOpen(!composerOpen)}
          style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '12px 20px', fontSize: '13px',
            cursor: 'pointer', color: 'var(--text)'
          }}
        >
          {composerOpen ? 'Cancel' : '+ Share what worked'}
        </button>
        {activeTag && (
          <button
            onClick={() => setActiveTag(null)}
            style={{
              background: 'var(--accent-soft)', border: '1px solid var(--border)',
              borderRadius: '999px', padding: '6px 14px', fontSize: '12px',
              cursor: 'pointer', color: 'var(--accent)'
            }}
          >
            ✕ Clear filter
          </button>
        )}
      </div>

      {composerOpen && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '16px 20px', marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            {POST_TYPE_OPTIONS.map(opt => {
              const selected = postType === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setPostType(opt.value)}
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: '8px', border: 'none',
                    background: selected ? 'var(--accent-soft)' : 'var(--bg)',
                    color: selected ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '12px', fontWeight: selected ? 600 : 500, cursor: 'pointer',
                  }}
                >
                  {opt.emoji} {opt.label}
                </button>
              )
            })}
          </div>
          <textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder={
              postType === 'question'
                ? 'What are you struggling with? Other caregivers may have insight.'
                : 'Share a tip, routine, or moment that helped...'
            }
            style={{
              width: '100%', border: '1px solid var(--border)', borderRadius: '8px',
              padding: '12px 16px', fontSize: '14px', fontFamily: 'inherit',
              resize: 'vertical', minHeight: '100px', outline: 'none',
              background: 'var(--bg)', color: 'var(--text)'
            }}
          />
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {postType === 'question'
                ? 'This will be posted as a community question. Peer caregivers and professionals will respond.'
                : 'This will be shared as peer experience. Medical advice belongs in notes for your clinician.'}
            </span>
            <button
              onClick={handleSubmit}
              disabled={submitting || !composerText.trim()}
              style={{
                background: 'var(--trust-soft)', border: '1px solid var(--trust)',
                borderRadius: '8px', padding: '8px 16px', fontSize: '13px',
                cursor: 'pointer', color: 'var(--trust)', fontWeight: 500,
                opacity: submitting || !composerText.trim() ? 0.5 : 1
              }}
            >
              {submitting ? 'Sharing...' : 'Share'}
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '24px' }}>
        <aside style={{ minWidth: '200px', flexShrink: 0 }}>
          <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            By tag
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
            {['sundowning', 'wandering', 'medication', 'behavior', 'sleep', 'safety', 'activities', 'nutrition'].map(tag => {
              const active = activeTag === tag
              const colors = tagColor(tag)
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(active ? null : tag)}
                  style={{
                    background: active ? colors.bg : 'transparent',
                    border: `1px solid ${colors.bg}`,
                    borderRadius: '999px', padding: '4px 12px', fontSize: '12px',
                    cursor: 'pointer', textAlign: 'center',
                    color: colors.text, fontWeight: active ? 500 : 400,
                  }}
                >
                  {tag}
                </button>
              )
            })}
          </div>

          <h3 style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: '12px' }}>
            By stage
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(['early', 'moderate', 'late', 'unspecified'] as CareStage[]).map(stage => {
              const active = activeStage === stage
              return (
                <button
                  key={stage}
                  onClick={() => setActiveStage(active ? null : stage)}
                  style={{
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '8px', padding: '8px 12px', fontSize: '12px',
                    cursor: 'pointer', textAlign: 'left',
                    color: active ? 'var(--text)' : 'var(--text-secondary)',
                    fontWeight: active ? 500 : 400,
                  }}
                >
                  {STAGE_LABELS[stage]}
                </button>
              )
            })}
          </div>
        </aside>

        <main style={{ flex: 1 }}>
          {loading && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading community posts...</p>
          )}

          {!loading && filteredPosts.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {activeTag || activeStage
                ? 'No posts match your filters. Try clearing them.'
                : 'No community posts yet. Be the first to share.'}
            </p>
          )}

          {!loading && filteredPosts.map(post => {
            const badge = authorBadge(post.author_type)
            return (
              <div key={post.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '20px', marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: badge.bg, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: '14px'
                  }}>
                    {post.author_avatar_seed}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>{post.author_label}</span>
                      <span style={{
                        fontSize: '10px', padding: '2px 8px', borderRadius: '999px',
                        background: badge.bg, color: badge.text,
                      }}>
                        {badge.emoji} {badge.label}
                      </span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      {formatTime(post.created_at)}
                    </div>
                  </div>
                </div>

                {post.title && (
                  <h2 style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>{post.title}</h2>
                )}

                <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text)', marginBottom: '12px' }}>
                  {post.body}
                </p>

                {post.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {post.tags.map(tag => {
                      const colors = tagColor(tag)
                      return (
                        <span key={tag} style={{
                          fontSize: '11px', padding: '3px 10px', borderRadius: '999px',
                          background: colors.bg, color: colors.text,
                        }}>
                          {tag}
                        </span>
                      )
                    })}
                  </div>
                )}

                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  paddingTop: '8px', borderTop: '1px solid var(--border)'
                }}>
                  <button
                    onClick={() => handleReaction(post.id, 'like')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      border: 'none', background: 'transparent',
                      padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
                      color: post.user_reaction === 'like' ? 'var(--trust)' : 'var(--text-secondary)',
                      fontSize: '13px',
                    }}
                  >
                    👍 {post.reaction_counts.like > 0 && post.reaction_counts.like}
                  </button>
                  <button
                    onClick={() => handleReaction(post.id, 'thank_you')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      border: 'none', background: 'transparent',
                      padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
                      color: post.user_reaction === 'thank_you' ? 'var(--trust)' : 'var(--text-secondary)',
                      fontSize: '13px',
                    }}
                  >
                    🙏 {post.reaction_counts.thank_you > 0 && post.reaction_counts.thank_you}
                  </button>
                  <button
                    onClick={() => handleReaction(post.id, 'support')}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '4px',
                      border: 'none', background: 'transparent',
                      padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
                      color: post.user_reaction === 'support' ? 'var(--trust)' : 'var(--text-secondary)',
                      fontSize: '13px',
                    }}
                  >
                    💙 {post.reaction_counts.support > 0 && post.reaction_counts.support}
                  </button>

                   <span style={{ fontSize: '11px', color: STAGE_COLORS[post.care_stage],
                     background: post.care_stage === 'unspecified' ? 'transparent' : `${STAGE_COLORS[post.care_stage]}10`,
                     padding: '2px 8px', borderRadius: '999px', marginLeft: 'auto'
                   }}>
                     {STAGE_LABELS[post.care_stage]}
                   </span>

                   <button
                     onClick={() => toggleSave(post.id)}
                     style={{
                       border: 'none', background: 'transparent',
                       padding: '4px 8px', borderRadius: '6px', cursor: 'pointer',
                       color: savedPosts.has(post.id) ? 'var(--accent)' : 'var(--text-secondary)',
                       fontSize: '14px',
                     }}
                     title={savedPosts.has(post.id) ? 'Unsave' : 'Save this post'}
                   >
                     {savedPosts.has(post.id) ? '🔖' : '🔖'}
                   </button>
                 </div>
              </div>
            )
          })}
        </main>
      </div>

      <p style={{
        fontSize: '11px', color: 'var(--text-secondary)', marginTop: '24px',
        fontStyle: 'italic', textAlign: 'center'
      }}>
        SolenOS community — shared experience, not medical advice. Always confirm care decisions with your clinician.
      </p>
    </div>
  )
}
