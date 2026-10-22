import { useState, useEffect } from 'react'
import { getJSON } from '../api/client'

interface CaregiverAtRisk {
  caregiver_id: string
  label: string
  risk_level: 'mild' | 'moderate' | 'high'
  distress_signals: number
  last_active: string
}

interface PostNeedsReview {
  id: string
  content: string
  author_label: string
  reason: string
  tags: string[]
}

interface TrendingTopic {
  tag: string
  count: number
  growth: string
}

interface StateReport {
  total_caregivers: number
  avg_helpfulness: number
  top_concerns: string[]
  trending_tags: TrendingTopic[]
}

interface MetricsData {
  [key: string]: any
}

export default function TeamDashboard() {
  const [riskCaregivers, setRiskCaregivers] = useState<CaregiverAtRisk[]>([])
  const [postsToReview, setPostsToReview] = useState<PostNeedsReview[]>([])
  const [report, setReport] = useState<StateReport | null>(null)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(true)
  const [reportError, setReportError] = useState<string | null>(null)
  const [reportLoading, setReportLoading] = useState(true)
  const [metricsError, setMetricsError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'review' | 'report' | 'monitoring'>('overview')
  const [metricsData, setMetricsData] = useState<MetricsData | null>(null)
  const [metricsLoading, setMetricsLoading] = useState<boolean>(true)

  useEffect(() => {
    fetchDashboard()
    fetchReport()
  }, [])

  useEffect(() => {
    if (activeTab === 'monitoring') {
      fetchMetrics()
    }
  }, [activeTab])

  const fetchDashboard = async () => {
    setDashboardError(null)
    setDashboardLoading(true)
    try {
      const data = await getJSON('/team/dashboard') as any
      if (!Array.isArray(data?.caregivers_at_risk) || !Array.isArray(data?.posts_to_review)) {
        throw new Error('Dashboard response is incomplete.')
      }
      setRiskCaregivers(data.caregivers_at_risk)
      setPostsToReview(data.posts_to_review)
    } catch (error) {
      setRiskCaregivers([])
      setPostsToReview([])
      setDashboardError('Team dashboard data could not be loaded. No demo records are shown.')
    } finally {
      setDashboardLoading(false)
    }
  }

  const fetchReport = async () => {
    setReportError(null)
    setReportLoading(true)
    try {
      const data = await getJSON('/team/state-report') as any
      if (
        !data ||
        typeof data.total_caregivers !== 'number' ||
        typeof data.avg_helpfulness !== 'number' ||
        !Array.isArray(data.top_concerns) ||
        !Array.isArray(data.trending_tags)
      ) throw new Error('Report response is incomplete.')
      setReport({
        total_caregivers: data.total_caregivers,
        avg_helpfulness: data.avg_helpfulness,
        top_concerns: data.top_concerns,
        trending_tags: data.trending_tags,
      })
    } catch (error) {
      setReport(null)
      setReportError('Report data could not be loaded. Metrics are unavailable until a valid server response is received.')
    } finally {
      setReportLoading(false)
    }
  }

  const fetchMetrics = async () => {
    setMetricsLoading(true)
    setMetricsError(null)
    try {
      const data = await getJSON('/metrics') as any
      // The /metrics endpoint returns Prometheus format text, not JSON.
      // We'll need to handle it as text and parse it.
      // For now, we'll assume the backend might return JSON for simplicity.
      // If it's text, we'll store the raw text.
      if (typeof data === 'string') {
        setMetricsData({ raw: data } as MetricsData)
      } else {
        setMetricsData(data)
      }
    } catch (error) {
      console.error('Failed to fetch metrics:', error)
      setMetricsData(null)
      setMetricsError('System metrics could not be loaded.')
    } finally {
      setMetricsLoading(false)
    }
  }

  const approvePost = async (_postId: string) => {
    // No verified team session exists in the current frontend API contract.
    // Never impersonate a moderator with a hard-coded client-side identity.
    setModerationError('Moderation is disabled because a verified team session is not available.')
  }

  const RiskBadge = ({ level }: { level: string }) => {
    const config: Record<string, { bg: string; color: string; label: string }> = {
      high: { bg: 'var(--error-soft)', color: 'var(--error)', label: 'ðŸŸ¥ HIGH RISK' },
      moderate: { bg: 'var(--warning-soft)', color: 'var(--warning)', label: 'ðŸŸ¨ MODERATE' },
      mild: { bg: 'var(--success-soft)', color: 'var(--success)', label: 'ðŸŸ© MILD' },
    }
    const c = config[level] || { bg: 'var(--surface)', color: 'var(--text-secondary)', label: 'UNKNOWN' }
    return (
      <span style={{
        fontSize: '10px', fontWeight: 700, padding: '2px 6px',
        borderRadius: '4px', background: c.bg, color: c.color,
      }}>
        {c.label}
      </span>
    )
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

  // Helper function to parse Prometheus metrics text
  const parsePrometheusMetrics = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'))
    const metrics: { [key: string]: any } = {}
    
    lines.forEach(line => {
      // Simple parser for counter, gauge, histogram
      // Format: metric_name{label1="value1",label2="value2"} value
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(\{.*\})?\s+([0-9.eE+-]+)$/)
      if (match) {
        const [, name, labelsStr, valueStr] = match
        const value = parseFloat(valueStr)
        
        if (labelsStr) {
          // Parse labels
          const labels: { [key: string]: string } = {}
          const labelMatches = labelsStr.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)="([^"]*)"/g)
          for (const labelMatch of labelMatches) {
            labels[labelMatch[1]] = labelMatch[2]
          }
          
          // For simplicity, we'll store as a nested structure
          // In a real app, we might want to organize by metric name and labels
          if (!metrics[name]) {
            metrics[name] = {}
          }
          // Create a key from labels
          const labelKey = Object.entries(labels).sort().map(([k, v]) => `${k}=${v}`).join('|')
          metrics[name][labelKey] = { value, labels }
        } else {
          metrics[name] = value
        }
      }
    })
    
    return metrics
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Mission Control</h1>
        <div style={{ display: 'flex', gap: '4px' }}>
          <TabButton id="overview" label="Caregiver Health" />
          <TabButton id="review" label="Moderation Center" />
          <TabButton id="report" label="State of Dementia Care" />
          <TabButton id="monitoring" label="System Monitoring" />
        </div>
      </div>

      {activeTab === 'overview' && dashboardLoading && <p role="status" style={{ color: 'var(--text-secondary)' }}>Loading team dashboard data…</p>}
      {activeTab === 'overview' && !dashboardLoading && dashboardError && <p role="alert" style={{ color: 'var(--error)' }}>{dashboardError}</p>}
      {activeTab === 'overview' && !dashboardLoading && !dashboardError && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Caregivers Needing Attention</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {riskCaregivers.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No caregiver risk records were returned by the server.</p>
              ) : riskCaregivers.map((c) => (
                <div key={c.caregiver_id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: '8px', background: 'var(--bg)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RiskBadge level={c.risk_level} />
                    <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)' }}>{c.label}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>({c.caregiver_id})</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {c.distress_signals} signals Â· {c.last_active}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Trending Topics</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!report ? <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{reportError || 'Report data is unavailable.'}</p> : report.trending_tags.length === 0 ? <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No trending-topic data was returned.</p> : report.trending_tags.map((t) => (
                <div key={t.tag} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '12px', minWidth: '160px', color: 'var(--text)' }}>{t.tag}</span>
                  <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${Math.min(t.count * 2, 100)}%`, height: '100%',
                      background: 'var(--accent)', borderRadius: '3px',
                    }} />
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', minWidth: '48px', textAlign: 'right' }}>
                    {t.count}
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--success)', }}>{t.growth}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'review' && dashboardLoading && <p role="status" style={{ color: 'var(--text-secondary)' }}>Loading moderation queue…</p>}
      {activeTab === 'review' && !dashboardLoading && dashboardError && <p role="alert" style={{ color: 'var(--error)' }}>{dashboardError}</p>}
      {activeTab === 'review' && !dashboardLoading && !dashboardError && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p role="status" style={{ color: 'var(--warning)', fontSize: '13px' }}>Moderation actions are disabled until verified team authentication and server-side authorization are available.</p>
          {postsToReview.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No posts need moderation right now.</p>
          ) : (
            postsToReview.map((post) => (
              <div key={post.id} style={{
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: '12px', padding: '20px',
              }}>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {post.tags.map(t => (
                    <span key={t} style={{
                      fontSize: '10px', padding: '2px 8px', borderRadius: '10px',
                      background: 'var(--warning-soft)', color: 'var(--warning)'
                    }}>{t}</span>
                  ))}
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                    {post.reason}
                  </span>
                </div>
                <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text)', marginBottom: '8px' }}>{post.content}</p>
                <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>By {post.author_label}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button
                    disabled
                    title="Requires verified team authentication"
                    style={{
                      padding: '6px 16px', borderRadius: '8px', border: 'none',
                      background: 'var(--success)', color: 'white',
                      fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                    }}
                  >
                    Approve
                  </button>
                  <button disabled title="Requires verified team authentication" style={{
                    padding: '6px 16px', borderRadius: '8px', border: '1px solid var(--border)',
                    background: 'var(--surface)', fontSize: '12px', color: 'var(--text-secondary)',
                    cursor: 'pointer',
                  }}>
                    Request Edit
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'report' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Community Snapshot</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)' }}>{report.total_caregivers}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Caregivers</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--success)' }}>{report.avg_helpfulness.toFixed(1)}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Avg Helpfulness</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Top Concerns</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {report.top_concerns.map((concern) => (
                <div key={concern} style={{
                  padding: '8px 12px', borderRadius: '6px',
                  background: 'var(--trust-soft)', fontSize: '13px', color: 'var(--trust)',
                }}>
                  {concern}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'monitoring' && (
        <div style={{ padding: '24px 32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 600 }}>System Monitoring</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Application Metrics</h3>
              {metricsLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  Loading metrics...
                </div>
              ) : metricsError ? (
                <p role="alert" style={{ color: 'var(--error)' }}>{metricsError}</p>
              ) : metricsData ? (
                <div>
                  {/* If we have raw Prometheus text, display it in a pre block */}
                  {(metricsData as any).raw ? (
                    <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '16px', fontFamily: 'monospace', fontSize: '13px', overflowX: 'auto' }}>
                      {(metricsData as any).raw}
                    </div>
                  ) : (
                    <div style={{ background: 'var(--bg)', borderRadius: '8px', padding: '16px' }}>
                      {/* We could parse and format nicely, but for now show JSON */}
                      <pre style={{ fontSize: '13px', overflowX: 'auto' }}>{JSON.stringify(metricsData, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
                  No metrics data available
                </div>
              )}
            </div>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Error Tracking</h3>
              <div style={{ minHeight: '100px' }}>
                <p>View detailed error reports in <a href="#" target="_blank" rel="noopener noreferrer">Sentry Dashboard</a></p>
                <p>Configure Sentry DSN in environment variables to enable error tracking.</p>
                <p>
                  <strong>Note:</strong> For production, ensure Sentry DSN is set in backend environment variables.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}