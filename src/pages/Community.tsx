import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getJSON, postJSON, getCaregiverId } from '../api/client'

type AuthorType = 'peer_caregiver' | 'solenos_verified' | 'professional' | 'professional_pending'
type ReactionType = 'support' | 'helpful' | 'relate' | 'heart'
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

interface ApiCommunityPost {
  id: string
  author_type: string
  author_label: string
  post_type?: string
  content: string
  care_stage?: string | null
  tags?: string[]
  visibility?: string
  moderation_status?: string
  created_at?: string | null
  reaction_counts?: Record<string, number>
  user_reaction?: string | null
}

interface CommunityPostSummary {
  count: number
  posts: ApiCommunityPost[]
}

interface ExperienceMatch {
  post_id: string
  author_label: string
  author_type: string
  content: string
  tags: string[]
}

interface ExperienceResult {
  matches: { post: ApiCommunityPost; matched_terms?: string[]; match_type?: string }[]
}

function normalizeCommunityPost(post: ApiCommunityPost): CommunityPost {
  const validStage = post.care_stage === 'early' || post.care_stage === 'moderate' || post.care_stage === 'late'
    ? post.care_stage
    : 'unspecified'
  const validAuthor: AuthorType = post.author_type === 'solenos_verified'
    || post.author_type === 'professional'
    || post.author_type === 'professional_pending'
    ? post.author_type
    : 'peer_caregiver'
  const counts = post.reaction_counts || {}
  const userReaction = post.user_reaction === 'support' || post.user_reaction === 'helpful'
    || post.user_reaction === 'relate' || post.user_reaction === 'heart'
    ? post.user_reaction
    : null
  return {
    id: post.id,
    author_type: validAuthor,
    author_label: post.author_label || 'Anonymous caregiver',
    author_avatar_seed: '🧑',
    title: post.post_type === 'question' ? 'Community question' : null,
    body: post.content,
    media: [],
    visibility: post.visibility === 'private' ? 'circle' : 'public',
    care_stage: validStage,
    tags: Array.isArray(post.tags) ? post.tags : [],
    created_at: post.created_at || '',
    updated_at: null,
    provenance_source: 'caregiver-submitted',
    reaction_counts: {
      support: counts.support || 0,
      helpful: counts.helpful || 0,
      relate: counts.relate || 0,
      heart: counts.heart || 0,
    },
    comment_count: 0,
    user_reaction: userReaction,
  }
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

export default function Community() {
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
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

  const caregiverId = getCaregiverId() || ''
  const [notice, setNotice] = useState<string | null>(null)

  async function loadPosts() {
    if (!caregiverId) {
      setPosts([])
      setLoadError('Sign in with a caregiver account to access the community.')
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const response = await getJSON<CommunityPostSummary>(
        '/community?caregiver_id=' + encodeURIComponent(caregiverId),
      )
      if (!response || !Array.isArray(response.posts)) {
        throw new Error('The backend returned an unexpected community-feed response.')
      }
      setPosts(response.posts.map(normalizeCommunityPost))
    } catch (error) {
      setPosts([])
      setLoadError(error instanceof Error ? error.message : 'Community posts could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem('solenos_saved_posts')
    if (saved) {
      try {
        setSavedPosts(new Set(JSON.parse(saved)))
      } catch {}
    }
  }, [])

  useEffect(() => {
    void loadPosts()
  }, [caregiverId])

  async function handleReaction(postId: string, reactionType: ReactionType) {
    setActionError(null)
    try {
      await postJSON(`/community/${postId}/reactions`, {
        caregiver_id: caregiverId,
        reaction_type: reactionType,
      })
      // Refresh server-confirmed counts; repeated clicks replace the reaction.
      await loadPosts()
    } catch (e) {
      console.error(e)
      setActionError(e instanceof Error ? e.message : 'Your reaction was not saved.')
    }
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
    setActionError(null)
    setLoadingWisdom(true)
    try {
      const data = await postJSON('/community/experience', { observation: wisdomQuery.trim() }) as ExperienceResult
      if (data?.matches) {
        setWisdomMatches(data.matches.slice(0, 4))
      }
    } catch (e) {
      setWisdomMatches([])
      setActionError(e instanceof Error ? e.message : 'Shared experiences could not be retrieved.')
    } finally {
      setLoadingWisdom(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const content = composerText.trim()
    if (!content || submitting) return
    setActionError(null)
    setSubmitting(true)
    try {
      await postJSON('/community', {
        caregiver_id: personId,
        author_type: 'peer_caregiver',
        author_label: 'Anonymous caregiver',
        post_type: postType,
        content,
        visibility: 'public',
      })
    } catch (e) {
      // A timeout can leave the server outcome unknown. Preserve the draft and
      // tell the caregiver to check the feed before attempting another create.
      console.error(e)
      setActionError(e instanceof Error
        ? 'The server did not confirm the post. Refresh the feed to check whether it was saved before retrying. Details: ' + e.message
        : 'The server did not confirm the post. Refresh the feed to check whether it was saved before retrying.')
      setSubmitting(false)
      return
    }

    // Clear the draft only after the create request returns success.
    setComposerText('')
    setComposerOpen(false)
    try {
      const response = await getJSON('/community?caregiver_id=' + encodeURIComponent(personId)) as CommunityPostSummary
      setPosts(Array.isArray(response?.posts) ? response.posts : [])
      setLoadError(null)
    } catch (e) {
      console.error(e)
      setActionError('The post request succeeded, but the feed could not be refreshed. Refresh the page to verify the saved post.')
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
            disabled={loadingWisdom || !wisdomQuery.trim() || Boolean(loadError)}
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
          disabled={Boolean(loadError)}
          title={loadError ? 'Community backend is unavailable; posting is disabled until the connection is restored.' : undefined}
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
              disabled={submitting || !composerText.trim() || Boolean(loadError)}
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

      {actionError && <p role="alert" style={{ color: 'var(--error)', fontSize: '13px', marginBottom: '12px' }}>{actionError}</p>}

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

          {!loading && loadError && (
            <div role="alert" style={{ color: 'var(--error)', fontSize: '14px' }}>
              Community posts could not be loaded: {loadError}. No sample posts are being shown. Community posting and experience matching are disabled until the backend is reachable.
              <button onClick={() => window.location.reload()} style={{ marginLeft: '8px' }}>Retry</button>
            </div>
          )}

          {!loading && !loadError && filteredPosts.length === 0 && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {activeTag || activeStage
                ? 'No posts match your filters. Try clearing them.'
                : 'No community posts yet. Be the first to share.'}
            </p>
          )}

          {!loading && !loadError && filteredPosts.map(post => {
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
