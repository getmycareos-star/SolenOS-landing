import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJSON } from '../api/client';

export default function InvestorDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMetrics() {
      setLoading(true);
      setError(null);
      try {
        const data = await getJSON('/investor/metrics');
        setMetrics(data);
      } catch (err: any) {
        setError(err.message || 'Failed to load metrics');
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, []);

  const handleLogout = () => {
    // Clear any investor-specific session data (if needed)
    // For example, if there's an investor token in localStorage:
    // localStorage.removeItem('solenos_investor_token');
    // Redirect to investor login page
    navigate('/investor/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="bg-error-soft border border-error rounded-lg p-6 text-error">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-trust">Investor Dashboard</h1>
        <button
          onClick={handleLogout}
          className="btn btn-outline"
        >
          Logout
        </button>
      </div>

      {metrics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(metrics).map(([key, value], index) => (
            <div key={index} className="bg-surface border border-border rounded-lg p-6">
              <h2 className="text-sm font-medium text-trust mb-2">
                {key.replace(/_/g, ' ').toUpperCase()}
              </h2>
              <div className="text-2xl font-bold">
                {typeof value === 'number'
                  ? value.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : String(value)
                }
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}