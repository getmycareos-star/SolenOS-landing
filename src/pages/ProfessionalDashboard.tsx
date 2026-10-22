import { useEffect, useState } from 'react'
import { getJSON, getPersonId } from '../api/client'

interface ProfessionalDashboardAlert {
  person_id: string
  person_name: string
  alert_type: string
  title: string
  description: string
  severity: string
  timestamp: string
  action_required: boolean
  suggested_action: string | null
}

interface ProfessionalDashboardPersonSummary {
  person_id: string
  person_name: string
  primary_condition: string | null
  last_updated: string
  alert_count: number
  alerts: string[]
  care_team_size: number
  has_recent_updates: boolean
  next_appointment: string | null
  compliance_score: number | null
}

interface ProfessionalDashboard {
  total_patients: number
  active_patients_today: number
  patients_with_alerts: number
  total_alerts: number
  alerts: ProfessionalDashboardAlertItem[]
  patients: ProfessionalDashboardPersonSummary[]
  professional_name: string
  professional_role: string
  specialty: string | null
  generated_at: string
  timeframe_days: number
}

interface ProfessionalDashboardAlertItem {
  person_id: string
  person_name: string
  alert_type: string
  title: string
  description: string
  severity: string
  timestamp: string
  action_required: boolean
  suggested_action: string | null
}

export default function ProfessionalDashboard() {
  const [dashboard, setDashboard] = useState<ProfessionalDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeframeDays, setTimeframeDays] = useState(7)
  const personId = getPersonId()

  useEffect(() => {
    fetchDashboard()
  }, [personId, timeframeDays])

  const fetchDashboard = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getJSON(`/professional-dashboard/?timeframe_days=${timeframeDays}`) as any
      if (
        !data || typeof data !== 'object' || Array.isArray(data) ||
        typeof data.total_patients !== 'number' ||
        typeof data.active_patients_today !== 'number' ||
        !Array.isArray(data.alerts) || !Array.isArray(data.patients)
      ) throw new Error('Professional dashboard response was incomplete.')
      setDashboard(data as ProfessionalDashboard)
    } catch (err: any) {
      console.error('Failed to fetch professional dashboard:', err)
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '24px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Loading professional dashboard...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '24px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', color: 'var(--error)', marginBottom: '16px' }}>
          {error}
        </div>
        <button
          onClick={fetchDashboard}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: 'none',
            background: 'var(--trust)', color: 'white', fontSize: '13px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div style={{ padding: '24px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          No dashboard data available
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600 }}>Professional Dashboard</h1>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ fontSize: '13px', color: 'var(--text-secondary)', marginRight: '8px' }}>
            Timeframe:
          </label>
          <select
            value={timeframeDays}
            onChange={(e) => setTimeframeDays(parseInt(e.target.value))}
            style={{
              padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--border)',
              background: 'var(--surface)', fontSize: '13px'
            }}
          >
            <option value={7}>7 Days</option>
            <option value={14}>14 Days</option>
            <option value={30}>30 Days</option>
          </select>
        </div>
      </div>

      {/* Dashboard Summary */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent)' }}>{dashboard.total_patients}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Patients</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--trust)' }}>{dashboard.active_patients_today}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Active Today</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--warning)' }}>{dashboard.patients_with_alerts}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Patients with Alerts</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--error)' }}>{dashboard.total_alerts}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total Alerts</div>
          </div>
        </div>
      </div>

      {/* Professional Info */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Your Professional Information</h2>
        <div style={{ display: 'flex', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{dashboard.professional_name}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{dashboard.professional_role}</div>
            {dashboard.specialty && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Specialty: {dashboard.specialty}
              </div>
            )}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Last updated: {new Date(dashboard.generated_at).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      {dashboard.alerts.length > 0 && (
        <>
          <div style={{ marginBottom: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Active Alerts</h2>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
              {dashboard.alerts.map((alert, index) => (
                <div key={index} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: index < dashboard.alerts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: alert.severity === 'critical' ? 'var(--error)' :
                                   alert.severity === 'high' ? 'var(--warning)' :
                                   alert.severity === 'medium' ? 'var(--accent)' : 'var(--success)'
                        }}></div>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                          {alert.title}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                        {new Date(alert.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {alert.action_required && (
                      <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'var(--error-soft)', color: 'var(--error)' }}>
                        Action Required
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text)', marginBottom: '8px' }}>
                    {alert.description}
                  </p>
                  {alert.suggested_action && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                      Suggested action: {alert.suggested_action}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Patients Section */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>Patient Summaries</h2>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '20px' }}>
          {dashboard.patients.map((patient, index) => (
            <div key={index} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: index < dashboard.patients.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text)' }}>{patient.person_name}</div>
                  {patient.primary_condition && (
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      {patient.primary_condition}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: patient.alert_count > 0 ? 'var(--warning)' : 'var(--success)' }}></div>
                    <span>{patient.alert_count} alerts</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: patient.has_recent_updates ? 'var(--success)' : 'var(--text-soft)' }}></div>
                    <span>{patient.has_recent_updates ? 'Recent updates' : 'No recent updates'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: patient.next_appointment ? 'var(--accent)' : 'var(--text-soft)' }}></div>
                    <span>{patient.next_appointment ? 'Upcoming appointment' : 'No upcoming appointments'}</span>
                  </div>
                </div>
              </div>
              
              {/* Patient Details */}
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-soft)' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Care Team Size</div>
                    <div style={{ fontSize: '16px', fontWeight: 600 }}>{patient.care_team_size}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Compliance Score</div>
                    <div style={{ fontSize: '16px', fontWeight: 600, color: patient.compliance_score !== null && patient.compliance_score >= 80 ? 'var(--success)' : patient.compliance_score !== null && patient.compliance_score >= 60 ? 'var(--warning)' : 'var(--error)' }}>
                      {patient.compliance_score !== null ? patient.compliance_score.toFixed(0) + '%' : 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}