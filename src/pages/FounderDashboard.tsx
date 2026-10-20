import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, RequireAuth } from '../components/AuthProvider';
import { getJSON } from '../api/client';


export default function FounderDashboard() {
  const { t } = useTranslation();
  const { authenticated, sessionInfo, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [founderData, setFounderData] = useState<any>(null);

  useEffect(() => {
    async function loadFounderData() {
      if (authLoading) return;
      
      if (!authenticated || !sessionInfo) {
        setError('Authentication required');
        setLoading(false);
        return;
      }

      try {
        // Check if user is founder
        const profileResponse = await getJSON('/founder/profile');
        if (!profileResponse.data?.isFounder) {
          setError('Access denied: Founder privileges required');
          setLoading(false);
          return;
        }
        
        // Load founder dashboard data
        const overviewResponse = await getJSON('/founder/executive-overview');
        setFounderData(overviewResponse.data);
        setLoading(false);
      } catch (err: any) {
        if (err.message && err.message.includes('403')) {
          setError('Access denied: Founder privileges required');
        } else {
          setError('Failed to load founder dashboard: ' + (err.message || 'Unknown error'));
        }
        setLoading(false);
      }
    }

    loadFounderData();
  }, [authenticated, sessionInfo, authLoading]);

  if (authLoading || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h2 style={{ color: 'var(--error)', marginBottom: '16px' }}>
          {t('founder.access_denied')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          {error}
        </p>
        <button 
          onClick={() => window.location.href = '/login'}
          style={{ 
            background: 'var(--accent)', 
            color: 'white', 
            border: 'none', 
            padding: '12px 24px', 
            borderRadius: '6px', 
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          {t('founder.login')}
        </button>
      </div>
    );
  }

  if (!founderData) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '100vh',
        textAlign: 'center',
        padding: '20px'
      }}>
        <h2 style={{ color: 'var(--error)', marginBottom: '16px' }}>
          {t('founder.access_denied')}
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>
          {t('founder.insufficient_privileges')}
        </p>
        <button 
          onClick={() => window.location.href = '/'}
          style={{ 
            background: 'var(--accent)', 
            color: 'white', 
            border: 'none', 
            padding: '12px 24px', 
            borderRadius: '6px', 
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          {t('founder.go_to_dashboard')}
        </button>
      </div>
    );
  }

  return (
    <RequireAuth>
      <div className='p-6'>
        <header className='flex justify-between items-center mb-6'>
          <h1 className='text-2xl font-bold text-trust'>
            SolenOS Founder Dashboard
          </h1>
          <div className='flex items-center gap-3'>
            <button onClick={() => window.location.href = '/'} className='text-text-secondary hover:text-text'>
              {t('founder.return_to_dashboard')}
            </button>
          </div>
        </header>

        <div className='space-y-6'>
          {/* Executive Overview */}
          <section>
            <h2 className='text-xl font-bold text-founder mb-4'>
              {t('founder.executive_overview')}
            </h2>
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {/* Company Health */}
              <div className='bg-surface border rounded-lg p-4'>
                <h3 className='text-lg font-medium text-founder mb-2'>
                  {t('founder.company_health')}
                </h3>
                <div className='space-y-2'>
                  <div className='flex justify-between'>
                    <span className='text-text-secondary'>{t('founder.product_availability')}</span>
                    <span className='text-founder'>{founderData.productAvailability}%</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-text-secondary'>{t('founder.application_error_rate')}</span>
                    <span className='text-success'>{founderData.applicationErrorRate}%</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-text-secondary'>{t('founder.background_job_failures')}</span>
                    <span className='text-warning'>{founderData.backgroundJobFailures}</span>
                  </div>
                </div>
              </div>
              
              {/* User Insights */}
              <div className='bg-surface border rounded-lg p-4'>
                <h3 className='text-lg font-medium text-founder mb-2'>
                  {t('founder.user_insights')}
                </h3>
                <div className='space-y-2'>
                  <div className='flex justify-between'>
                    <span className='text-text-secondary'>{t('founder.total_registered_accounts')}</span>
                    <span className='text-founder'>{founderData.totalRegisteredAccounts}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-text-secondary'>{t('founder.active_users_30d')}</span>
                    <span className='text-founder'>{founderData.activeUsers30d}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-text-secondary'>{t('founder.activation_rate')}</span>
                    <span className='text-success'>{founderData.activationRate}%</span>
                  </div>
                </div>
              </div>
              
              {/* Operations */}
              <div className='bg-surface border rounded-lg p-4'>
                <h3 className='text-lg font-medium text-founder mb-2'>
                  {t('founder.operations')}
                </h3>
                <div className='space-y-2'>
                  <div className='flex justify-between'>
                    <span className='text-text-secondary'>{t('founder.pending_operational_tasks')}</span>
                    <span className='text-warning'>{founderData.pendingOperationalTasks}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-text-secondary'>{t('founder.overdue_tasks')}</span>
                    <span className='text-error'>{founderData.overdueTasks}</span>
                  </div>
                  <div className='flex justify-between'>
                    <span className='text-text-secondary'>{t('founder.operational_incidents')}</span>
                    <span className='text-founder'>{founderData.operationalIncidents}</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Founder Priorities */}
          <section>
            <h2 className='text-xl font-bold text-founder mb-4'>
              {t('founder.priorities')}
            </h2>
            <div className='bg-surface border rounded-lg p-4'>
              <div className='flex justify-between items-start mb-3'>
                <h3 className='text-lg font-medium text-founder'>
                  {t('founder.critical_alerts')}
                </h3>
                <span className='px-2 py-1 bg-error text-error text-xs rounded-full'>
                  3 Active Alerts
                </span>
              </div>
              <div className='space-y-2'>
                <div className='flex items-start gap-3'>
                  <div className='flex-shrink-0'>
                    <div className='w-2 h-2 bg-error rounded-full'></div>
                  </div>
                  <div>
                    <h4 className='font-medium text-text'>System Performance Alert</h4>
                    <p className='text-text-sm text-text-secondary'>
                      Elevated response times detected
                    </p>
                    <div className='flex items-baseline gap-1 mt-1'>
                      <span className='text-error text-xs'>HIGH</span>
                      <span className='text-text-xs'>5m ago</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Navigation Grid */}
          <section>
            <h2 className='text-xl font-bold text-founder mb-4'>
              {t('founder.navigation')}
            </h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
              <button className='bg-surface border rounded-lg p-4 text-left hover:bg-founder-soft transition-colors'>
                <div className='flex items-center gap-2'>
                  <div className='w-5 h-5 bg-founder-soft rounded flex items-center justify-center'>
                    <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 24 24'>
                      <path d='M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm0 15.75c-3.29 0-5.975-2.685-5.975-5.975s2.685-5.975 5.975-5.975 5.975 2.685 5.975 5.975-2.685 5.975 5.975z'/>
                      <path d='M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9z'/>
                    </svg>
                  </div>
                  <div>
                    <div className='font-medium text-text'>{t('founder.company_overview')}</div>
                    <div className='text-text-sm text-text-secondary'>{t('founder.company_description')}</div>
                  </div>
                </div>
              </button>
              <button className='bg-surface border rounded-lg p-4 text-left hover:bg-founder-soft transition-colors'>
                <div className='flex items-center gap-2'>
                  <div className='w-5 h-5 bg-founder-soft rounded flex items-center justify-center'>
                    <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 24 24'>
                      <path d='M12 4a8 8 0 00-8 8v8a2 2 0 002 2h12a2 2 0 002-2v-8a8 8 0 00-16 0z'/>
                      <path d='M12 14c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4z'/>
                    </svg>
                  </div>
                  <div>
                    <div className='font-medium text-text'>{t('founder.product_engineering')}</div>
                    <div className='text-text-sm text-text-secondary'>{t('founder.product_health_status')}</div>
                  </div>
                </div>
              </button>
              <button className='bg-surface border rounded-lg p-4 text-left hover:bg-founder-soft transition-colors'>
                <div className='flex items-center gap-2'>
                  <div className='w-5 h-5 bg-founder-soft rounded flex items-center justify-center'>
                    <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 24 24'>
                      <path d='M3 5a2 2 0 012-2h14a2 2 0 012-2v14a2 2 0 012-2H5a2 2 0 012-2V5zm14 14h-4v-4h2v-2h-2v-2H5v2h2v2h4v2h-2v-2z'/>
                    </svg>
                  </div>
                  <div>
                    <div className='font-medium text-text'>{t('founder.user_customer_insights')}</div>
                    <div className='text-text-sm text-text-secondary'>{t('founder.engagement_metrics')}</div>
                  </div>
                </div>
              </button>
              <button className='bg-surface border rounded-lg p-4 text-left hover:bg-founder-soft transition-colors'>
                <div className='flex items-center gap-2'>
                  <div className='w-5 h-5 bg-founder-soft rounded flex items-center justify-center'>
                    <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 24 24'>
                      <path d='M19 9l-7 7-7-7'/>
                    </svg>
                  </div>
                  <div>
                    <div className='font-medium text-text'>{t('founder.operations')}</div>
                    {t('founder.operational_tasks')}
                  </div>
                </div>
              </button>
              <button className='bg-surface border rounded-lg p-4 text-left hover:bg-founder-soft transition-colors'>
                <div className='flex items-center gap-2'>
                  <div className='w-5 h-5 bg-founder-soft rounded flex items-center justify-center'>
                    <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 24 24'>
                      <path d='M3 7h18a2 2 0 012-2v2H5a2 2 0 012-2V9zm0 8h18v2H3v-2z'/>
                    </svg>
                  </div>
                  <div>
                    <div className='font-medium text-text'>{t('founder.team_access')}</div>
                    <div className='text-text-sm text-text-secondary'>{t('founder.team_management')}</div>
                  </div>
                </div>
              </button>
              <button className='bg-surface border rounded-lg p-4 text-left hover:bg-founder-soft transition-colors'>
                <div className='flex items-center gap-2'>
                  <div className='w-5 h-5 bg-founder-soft rounded flex items-center justify-center'>
                    <svg className='w-4 h-4' fill='currentColor' viewBox='0 0 24 24'>
                      <path d='M3 11h18a2 2 0 012-2v2H5a2 2 0 012-2V9zm0 8h18v2H3v-2z'/>
                    </svg>
                  </div>
                  <div>
                    {t('founder.finance')}
                    <div className='text-text-sm text-text-secondary'>{t('founder.financial_overview')}</div>
                  </div>
                </div>
              </button>
            </div>
          </section>
        </div>
      </div>
    );
}

