import { useState } from 'react';
import { postJSON } from '../../api/client';
import { useOptimisticToggle } from '../../lib/optimistic';

interface Observation {
  id: string;
  event_type: string;
  occurred_at: string;
  title: string;
  description?: string;
}

interface Perspective {
  id: string;
  observation_id: string;
  perspective_type: string;
  content: string;
  confidence: number;
}

export default function ObservationPromotion() {
  const [observations, setObservations] = useState<Observation[]>([]);
  const [perspectives, setPerspectives] = useState<Perspective[]>([]);
  const [loading, setLoading] = useState(true);

  const { toggle: togglePromotion, toggledPerspectiveIds, loadingPerspectiveIds } = useOptimisticToggle<string>();

  // Load initial data
  // In a real implementation, this would fetch from API
  // For now, using mock data
  const loadInitialData = () => {
    setObservations([
      {
        id: 'obs-1',
        event_type: 'behavior',
        occurred_at: new Date(Date.now() - 2 * 3600000).toISOString(),
        title: 'Increased confusion in evening',
        description: 'Patient showed signs of disorientation around 8 PM'
      },
      {
        id: 'obs-2',
        event_type: 'symptom',
        occurred_at: new Date(Date.now() - 1 * 3600000).toISOString(),
        title: 'Refused evening medication',
        description: 'Patient refused to take prescribed medication at 7 PM'
      }
    ]);

    setPerspectives([
      {
        id: 'persp-1',
        observation_id: 'obs-1',
        perspective_type: 'medical',
        content: 'Possible UTI or medication side effect causing confusion',
        confidence: 0.7
      },
      {
        id: 'persp-2',
        observation_id: 'obs-2',
        perspective_type: 'care',
        content: 'May need alternative medication administration strategy',
        confidence: 0.8
      }
    ]);

    setLoading(false);
  };

  // Simulate component mount
  // In reality, this would be in useEffect
  loadInitialData();

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffHours < 1) return 'Less than 1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handlePromotePerspective = async (perspectiveId: string) => {
    await togglePromotion(perspectiveId, {
      enableFn: async () => {
        // Promote perspective to confirmed observation
        await postJSON(`/perspectives/${perspectiveId}/promote`, {
          promoted_by: 'current-user-id' // In reality, this would come from auth context
        });
        
        // Update local state optimistically (handled by hook)
        // In a real app, we might update the perspective or add a new observation
        setPerspectives(prevPerspectives =>
          prevPerspectives.map(p =>
            p.id === perspectiveId
              ? { ...p, promoted: true }
              : p
          )
        );
      },
      disableFn: async () => {
        // This would be for demoting a perspective
        await postJSON(`/perspectives/${perspectiveId}/demote`, {
          demoted_by: 'current-user-id'
        });
        
        setPerspectives(prevPerspectives =>
          prevPerspectives.map(p =>
            p.id === perspectiveId
              ? { ...p, promoted: false }
              : p
          )
        );
      }
    });
  };

  if (loading) {
    return <div aria-live="polite">Loading observations...</div>;
  }

  return (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
        Promote Perspectives to Observations
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
        Review AI-generated perspectives and promote high-confidence ones to confirmed observations.
      </p>
      
      {perspectives.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          No perspectives available for review.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {perspectives.map(perspective => {
            const observation = observations.find(obs => obs.id === perspective.observation_id);
            if (!observation) return null;
            
            return (
              <div
                key={perspective.id}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '12px',
                  padding: '16px 20px'
                }}
                role="region"
                aria-live="polite"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                      {observation.title}
                    </h3>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      {formatDate(observation.occurred_at)}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: perspective.confidence >= 0.8 ? 'var(--trust-soft)' : 'var(--unknown-soft)',
                    color: perspective.confidence >= 0.8 ? 'var(--trust)' : 'var(--unknown)'
                  }}>
                    {Math.round(perspective.confidence * 100)}% confidence
                  </span>
                </div>
                
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  {observation.description || ''}
                </p>
                
                <div style={{ background: 'var(--trust-soft)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                  <p style={{ margin: '0', fontSize: '13px', color: 'var(--text)' }}>
                    {perspective.content}
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handlePromotePerspective(perspective.id)}
                    disabled={loadingPerspectiveIds.includes(perspective.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--trust)',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: loadingPerspectiveIds.includes(perspective.id) ? 'default' : 'pointer',
                      opacity: loadingPerspectiveIds.includes(perspective.id) ? 0.7 : 1
                    }}
                  >
                    {loadingPerspectiveIds.includes(perspective.id) ? 'Processing...' : 'Promote to Observation'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}