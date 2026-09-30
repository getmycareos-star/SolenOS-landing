import { useState, useEffect } from 'react'
import { getJSON, postJSON, getPersonId } from '../api/client'

interface HelpRequest {
  question_id: string
  post_id: string
  content: string
  author_label: string
  created_at: string
  tags: string[]
  community_answer: string | null
}

interface ImpactMetrics {
  answers_given: number
  professionals_active: number
  questions_answered: number
  avg_helpfulness: number
  expertise_match_rate: number
}

const DEMO_HELP_REQUESTS: HelpRequest[] = [
  {
    question_id: 'q1',
    post_id: 'post-1',
    content: 'My father with Lewy Body Dementia is having severe hallucinations in the evenings. We tried reducing lights but nothing helps. What has worked for others?',
    author_label: 'Anonymous caregiver',
    created_at: new Date().toISOString(),
    tags: ['hallucinations', 'evening-calling'],
    community_answer: 'Several caregivers found that a small nightlight (not overhead) plus a consistent bedtime routine helped. Melatonin (discuss with doctor) also mentioned frequently.',
  },
  {
    question_id: 'q2',
    post_id: 'post-2',
    content: 'How do you safely help someone with advanced AD take daily medication when they refuse? We\'ve tried pill crushers but they catch on.',
    author_label: 'Anonymous caregiver',
    created_at: new Date().toISOString(),
    tags: ['medication-management', 'resistance'],
    community_answer: null,
  },
]

const DEMO_METRICS: ImpactMetrics = {
  answers_given: 87,
  professionals_active: 3,
  questions_answered: 142,
  avg_helpfulness: 4.2,
  expertise_match_rate: 78,
}

export default function ProfessionalDashboard() {
  const [helpRequests, setHelpRequests] = useState<HelpRequest[]>([])
  const [metrics, setMetrics] = useState<ImpactMetrics>(DEMO_METRICS)
  const [selected, setSelected] = useState<HelpRequest | null>(null)
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'requests' | 'impact' | 'office-hours'>('requests')
  const personId = getPersonId()

  useEffect(() => {
    fetchHelpRequests()
    fetchMetrics()
  }, [])

  const fetchHelpRequests = async () => {
    try {
      const data = await getJSON('/community/help-requests') as any
      if (data?.requests && Array.isArray(data.requests)) {
        setHelpRequests(data.requests)
      } else {
        setHelpRequests(DEMO_HELP_REQUESTS)
      }
    } catch {
      setHelpRequests(DEMO_HELP_REQUESTS)
    }
  }

  const fetchMetrics = async () => {
    try {
      const data = await getJSON('/team/dashboard') as any
      if (data) {
        setMetrics({
          answers_given: data.answers_given || 0,
          professionals_active: data.professionals_active || 0,
          questions_answered: data.questions_answered || 0,
          avg_helpfulness: data.avg_helpfulness || 0,
          expertise_match_rate: data.expertise_match_rate || 0,
        })
      }
    } catch {
      setMetrics(DEMO_METRICS)
    }
  }

  const submitAnswer = async (request: HelpRequest) => {
    if (!answer.trim()) return
    setLoading(true)
    try {
      await postJSON(`/community/${request.post_id}/reactions`, {
        reaction_type: 'caregiver_answer',
        caregiver_id: personId,
        content: answer,
      })
      setHelpRequests(prev => prev.filter(r => r.question_id !== request.question_id))
      if (selected?.question_id === request.question_id) {
        setSelected(null)
      }
      setAnswer('')
      fetchMetrics()
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const markHelpful = async (request: HelpRequest) => {
    try {
      await postJSON(`/community/${request.post_id}/reactions`, {
        reaction_type: 'caregiver_helpful',
        caregiver_id: personId,
      })
      setHelpRequests(prev => prev.filter(r => r.question_id !== request.question_id))
    } catch {
    }
  }

  const TabButton = ({ id, label }: { id: typeof activeTab; label: string }) => (
    <button
      onClick={() => setActiveTab(id)}
      style={{
        padding: '8px 16px', borderRadius: '8px', border: 'none',
        background: activeTab === id ? 'var(--trust-soft)' : 'transparent',
        color: activeTab === id ? 'var(--trust)' : 'var(--text-secondary)',
        fontSize: '13px', fontWeight: activeTab === id ? 600 : 500,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Professional Dashboard</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <TabButton id="requests" label="Help Requests" />
          <TabButton id="impact" label="My Impact" />
          <TabButton id="office-hours" label="Office Hours" />
        </div>
      </div>

      {activeTab === 'requests' && (
        <>
          <div style={{
            display: 'flex', gap: '8px', marginBottom: '16px',
            overflowX: 'auto', paddingBottom: '4px'
          }}>
            {helpRequests.length === 0 ? (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No open requests. Thank you for your service.</p>
            ) : (
              helpRequests.map(req => (
                <div
                  key={req.question_id}
                  onClick={() => setSelected(req)}
                  style={{
                    padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)',
                    background: 'var(--surface)', cursor: 'pointer',
                    flex: 1, minWidth: '200px',
                    borderLeft: `3px solid var(--${req.community_answer ? 'success' : 'warning'})`,
                    maxHeight: '120px', overflow: 'hidden',
                  }}
                >
                  <div style={{
                    fontSize: '12px', fontWeight: 600, color: 'var(--text)',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {req.content.substring(0, 80)}...
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Tags: {req.tags.join(', ')}
                  </div>
                  {req.community_answer && (
                    <div style={{ fontSize: '11px', color: 'var(--success)', marginTop: '4px' }}>
                      Community already answered
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {selected && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {selected.tags.map(t => (
                      <span key={t} style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
                        background: 'var(--accent-soft)', color: 'var(--accent)'
                      }}>
                        {t}
                      </span>
                    ))}
                  </div>
                  <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text)' }}>{selected.content}</p>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                    Asked by: {selected.author_label}
                  </p>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-secondary)',
                    cursor: 'pointer', fontSize: '16px',
                  }}
                >
                  ✕
                </button>
              </div>

              {selected.community_answer && (
                <div style={{
                  background: 'var(--success-soft)', border: '1px solid var(--success)',
                  borderRadius: '8px', padding: '12px 16px', marginTop: '16px'
                }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--success)', marginBottom: '4px' }}>
                    Community answer:
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text)' }}>{selected.community_answer}</div>
                </div>
              )}

              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Your professional guidance to display alongside the community answer..."
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border)',
                  background: 'var(--bg)', fontSize: '14px', outline: 'none', marginTop: '16px',
                  resize: 'vertical', minHeight: '80px',
                }}
              />

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button
                  onClick={() => submitAnswer(selected)}
                  disabled={loading || !answer.trim()}
                  style={{
                    padding: '8px 16px', borderRadius: '8px', border: 'none',
                    background: loading || !answer.trim() ? 'var(--text-secondary)' : 'var(--trust)',
                    color: 'white', fontSize: '13px', fontWeight: 500, cursor: 'default',
                  }}
                >
                  {loading ? '...' : 'Submit Professional Guidance'}
                </button>
                {!selected.community_answer && (
                  <button
                    onClick={() => markHelpful(selected)}
                    style={{
                      padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--border)',
                      background: 'var(--surface)', fontSize: '12px', color: 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                  >
                    Mark as Helpful ✓
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'impact' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)' }}>{metrics.answers_given}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Guidance Provided</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--trust)' }}>{metrics.professionals_active}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Professionals Active</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--success)' }}>{metrics.questions_answered}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Questions Answered</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--warning)' }}>{metrics.avg_helpfulness.toFixed(1)}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Avg Helpfulness</div>
          </div>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)' }}>{metrics.expertise_match_rate}%</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Expertise Match Rate</div>
          </div>
        </div>
      )}

      {activeTab === 'office-hours' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Upcoming Office Hours</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Office hours let professionals host live Q&A sessions. Schedule one from the team dashboard.
          </p>
        </div>
      )}
    </div>
  )
}
