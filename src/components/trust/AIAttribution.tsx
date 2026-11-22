import { useState } from 'react';
import { caregiverSafeAssistantText, caregiverSafeGeneratedText } from '@/lib/caregiver-language';

interface AIAttributionProps {
  isAIGenerated: boolean;
  confidence?: number;
  explanation?: string;
  showDetails?: boolean;
}

export default function AIAttribution({
  isAIGenerated,
  explanation,
  showDetails = false
}: AIAttributionProps) {
  const [expanded, setExpanded] = useState(showDetails || false);
  const safeExplanation = caregiverSafeGeneratedText(explanation);

  if (!isAIGenerated) {
    return null;
  }

  const getConfidenceLabel = (): string => 'Suggested detail — please check';

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
              About this suggestion
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
              How it was made:
            </span>
            <span style={{ 
              fontSize: 'calc(12px * var(--solenos-text-scale, 1))', 
              color: 'var(--text)',
              fontWeight: '500'
            }}>
              Suggested by SolenOS
            </span>
          </div>
          
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
                {safeExplanation || 'This suggestion needs your review.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}