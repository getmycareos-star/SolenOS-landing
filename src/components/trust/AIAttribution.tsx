import { useState } from 'react';

interface AIAttributionProps {
  isAIGenerated: boolean;
  confidence?: number;
  explanation?: string;
  showDetails?: boolean;
}

export default function AIAttribution({
  isAIGenerated,
  confidence,
  explanation,
  showDetails = false
}: AIAttributionProps) {
  const [expanded, setExpanded] = useState(showDetails || false);

  if (!isAIGenerated) {
    return null;
  }

  const getConfidenceLabel = (): string => 'AI suggestion — please check';

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '4px',
      fontSize: 'calc(12px * var(--solenos-text-scale, 1))',
      color: 'var(--text-secondary)'
    }}>
      {!expanded && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px'
        }}>
          <span style={{ 
            fontSize: 'calc(10px * var(--solenos-text-scale, 1))', 
            padding: '2px 6px', 
            borderRadius: '4px',
            background: 'var(--unknown-soft)',
            color: 'var(--unknown)',
            border: '1px solid var(--unknown)'
          }}>
            🤖
          </span>
          <span>{getConfidenceLabel()}</span>

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
              AI Attribution
            </span>
            <button
              onClick={() => setExpanded(false)}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 'calc(16px * var(--solenos-text-scale, 1))',
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
              fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
              color: 'var(--text-secondary)',
              display: 'block',
              marginBottom: '2px'
            }}>
              Content type:
            </span>
            <span style={{ 
              fontSize: 'calc(12px * var(--solenos-text-scale, 1))', 
              color: 'var(--text)',
              fontWeight: '500'
            }}>
              AI-generated insight
            </span>
          </div>
          
          {confidence !== undefined && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{ 
                fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px'
              }}>
                Confidence level:
              </span>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px'
              }}>
                <span style={{ 
                  fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
                  color: 'var(--text)'
                }}>
                  {Math.round(confidence * 100)}%
                </span>
                <div style={{ 
                  width: '80px', 
                  height: '4px', 
                  background: 'var(--bg)',
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{ 
                    width: `${confidence * 100}%`, 
                    height: '100%', 
                    background: confidence >= 0.8 ? 'var(--trust)' : 
                              confidence >= 0.5 ? 'var(--unknown)' : 
                              'var(--error)'
                  }}></div>
                </div>
              </div>
            </div>
          )}
          
          {explanation && (
            <div style={{ 
              background: 'var(--unknown-soft)',
              border: '1px solid var(--unknown)',
              borderRadius: '4px',
              padding: '8px 12px'
            }}>
              <span style={{ 
                fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px'
              }}>
                Based on:
              </span>
              <p style={{ 
                fontSize: 'calc(12px * var(--solenos-text-scale, 1))', 
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