import { useState } from 'react';

interface InformationStatusProps {
  status: 'known' | 'uncertain' | 'missing' | 'needs-clarification';
  explanation?: string;
  showDetails?: boolean;
}

export default function InformationStatus({
  status,
  explanation,
  showDetails = false
}: InformationStatusProps) {
  const [expanded, setExpanded] = useState(showDetails || false);

  const getStatusLabel = (): string => {
    switch (status) {
      case 'known': return 'Known';
      case 'uncertain': return 'Uncertain';
      case 'missing': return 'Missing';
      case 'needs-clarification': return 'Needs clarification';
      default: return 'Unknown';
    }
  };

  const getStatusColors = () => {
    switch (status) {
      case 'known': 
        return { 
          bg: 'var(--trust-soft)', 
          color: 'var(--trust)',
          border: 'var(--trust)'
        };
      case 'uncertain': 
        return { 
          bg: 'var(--unknown-soft)', 
          color: 'var(--unknown)',
          border: 'var(--unknown)'
        };
      case 'missing': 
        return { 
          bg: 'var(--warning-soft)', 
          color: 'var(--warning)',
          border: 'var(--warning)'
        };
      case 'needs-clarification': 
        return { 
          bg: 'var(--unknown-soft)', 
          color: 'var(--unknown)',
          border: 'var(--unknown)'
        };
      default: 
        return { 
          bg: 'var(--surface)', 
          color: 'var(--text-secondary)',
          border: 'var(--border)'
        };
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '4px',
      fontSize: '12px'
    }}>
      {!expanded && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          cursor: 'pointer'
        }}>
          <span style={{ 
            fontSize: '10px', 
            padding: '2px 6px', 
            borderRadius: '4px',
            background: getStatusColors().bg,
            color: getStatusColors().color,
            border: `1px solid ${getStatusColors().border}`
          }}>
            {getStatusLabel()}
          </span>
          {explanation && (
            <span style={{ 
              fontSize: '10px', 
              color: 'var(--text-secondary)',
              marginLeft: '4px',
              fontStyle: 'italic'
            }}>
              {explanation.substring(0, 30)}{explanation.length > 30 ? '...' : ''}
            </span>
          )}
        </div>
      )}
      
      {expanded && (
        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)',
          borderRadius: '8px', 
          padding: '12px 16px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ 
              fontWeight: '500',
              color: 'var(--text)'
            }}>
              Information Status
            </span>
            <button
              onClick={() => setExpanded(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '16px',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0'
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <span style={{ 
              fontSize: '11px', 
              color: 'var(--text-secondary)',
              display: 'block',
              marginBottom: '2px'
            }}>
              Status:
            </span>
            <span style={{ 
              fontSize: '12px', 
              color: getStatusColors().color,
              fontWeight: '500',
              background: getStatusColors().bg,
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              {getStatusLabel()}
            </span>
          </div>
          
          {explanation && (
            <div style={{ 
              background: getStatusColors().bg,
              border: `1px solid ${getStatusColors().border}`,
              borderRadius: '4px',
              padding: '8px 12px',
              marginBottom: '12px'
            }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px'
              }}>
                Why this status:
              </span>
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {explanation}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}