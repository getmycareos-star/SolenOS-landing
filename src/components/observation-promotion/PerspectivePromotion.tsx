import { useEffect, useState } from 'react';
import { postJSON } from '../../api/client';
import { useOptimisticToggle } from '../../lib/optimistic';

interface Perspective {
  id: string;
  observation_id: string;
  perspective_type: string;
  content: string;
  confidence: number;
  promoted?: boolean;
  promotedToInsight?: boolean;
}

interface Insight {
  id: string;
  title: string;
  description: string;
  insight_type: string;
  confidence: number;
}

export default function PerspectivePromotion() {
  const [perspectives, setPerspectives] = useState<Perspective[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const { toggle: togglePromotion, loadingPerspectiveIds } = useOptimisticToggle<string>();

  // Load initial data
  // In a real implementation, this would fetch from API
  // For now, using mock data
  const loadInitialData = () => {
    setPerspectives([
      {
        id: 'persp-1',
        observation_id: 'obs-1',
        perspective_type: 'medical',
        content: 'Possible UTI or medication side effect causing confusion',
        confidence: 0.75,
        promoted: true
      },
      {
        id: 'persp-2',
        observation_id: 'obs-2',
        perspective_type: 'care',
        content: 'May need alternative medication administration strategy',
        confidence: 0.82
      },
      {
        id: 'persp-3',
        observation_id: 'obs-1',
        perspective_type: 'environmental',
        content: 'Evening lighting may be contributing to confusion',
        confidence: 0.65
      }
    ]);

    setInsights([
      {
        id: 'insight-1',
        title: 'Medication timing adjustment needed',
        description: 'Consider shifting medication schedule to reduce evening confusion',
        insight_type: 'recommendation',
        confidence: 0.78
      }
    ]);

    setLoading(false);
  };

  // Load mock data once; never update component state during render.
  useEffect(() => {
    loadInitialData();
  }, []);

  const formatConfidence = (confidence: number) => {
    return `${Math.round(confidence * 100)}%`;
  };

  const handlePromoteToInsight = async (perspectiveId: string) => {
    await togglePromotion(perspectiveId, {
      enableFn: async () => {
        // Promote perspective to insight
        await postJSON(`/perspectives/${perspectiveId}/promote-to-insight`, {
          promoted_by: 'current-user-id' // In reality, this would come from auth context
        });
        
        // Update local state optimistically (handled by hook)
        // In a real app, we might add a new insight or update existing ones
        const perspective = perspectives.find(p => p.id === perspectiveId);
        if (perspective) {
          setInsights(prevInsights => [
            ...prevInsights,
            {
              id: `insight-${Date.now()}`,
              title: `Insight from ${perspective.perspective_type} perspective`,
              description: perspective.content,
              insight_type: 'derived',
              confidence: perspective.confidence
            }
          ]);
        }
        
        setPerspectives(prevPerspectives =>
          prevPerspectives.map(p =>
            p.id === perspectiveId
              ? { ...p, promotedToInsight: true }
              : p
          )
        );
      },
      disableFn: async () => {
        // This would be for demoting an insight back to perspective
        await postJSON(`/insights/${perspectiveId}/demote-to-perspective`, {
          demoted_by: 'current-user-id'
        });
        
        // Update local state
        setInsights(prevInsights => prevInsights.filter(i => i.id !== perspectiveId));
        
        setPerspectives(prevPerspectives =>
          prevPerspectives.map(p =>
            p.id === perspectiveId
              ? { ...p, promotedToInsight: false }
              : p
          )
        );
      }
    });
  };

  const eligiblePerspectives = perspectives.filter(p => p.promoted && !p.promotedToInsight);

  if (loading) {
    return <div aria-live="polite">Loading perspectives...</div>;
  }

  return (
    <div>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
        Promote Perspectives to Insights
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
        Transform clinical perspectives into actionable care insights.
      </p>
      
            {eligiblePerspectives.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          No perspectives ready for promotion to insights.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {eligiblePerspectives.map(perspective => {
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
                      Perspective: {perspective.perspective_type}
                    </h3>
                    <p style={{ margin: '0 0 4px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                      Confidence: {formatConfidence(perspective.confidence)}
                    </p>
                  </div>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'var(--accent-soft)',
                    color: 'var(--accent)'
                  }}>
                    To Insight
                  </span>
                </div>
                
                <div style={{ background: 'var(--trust-soft)', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                  <p style={{ margin: '0', fontSize: '13px', color: 'var(--text)' }}>
                    {perspective.content}
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handlePromoteToInsight(perspective.id)}
                    disabled={loadingPerspectiveIds.includes(perspective.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'var(--accent)',
                      color: 'white',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: loadingPerspectiveIds.includes(perspective.id) ? 'default' : 'pointer',
                      opacity: loadingPerspectiveIds.includes(perspective.id) ? 0.7 : 1
                    }}
                  >
                    {loadingPerspectiveIds.includes(perspective.id) ? 'Processing...' : 'Promote to Insight'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      
      {/* Show existing insights */}
      {insights.length > 0 && (
        <>
          <div style={{ marginTop: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Generated Insights
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {insights.map(insight => (
                <div
                  key={insight.id}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '16px 20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500 }}>{insight.title}</span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '999px',
                      background: insight.confidence >= 0.8 ? 'var(--trust-soft)' : 'var(--unknown-soft)',
                      color: insight.confidence >= 0.8 ? 'var(--trust)' : 'var(--unknown)'
                    }}>
                      {formatConfidence(insight.confidence)} confidence
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{insight.description}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}