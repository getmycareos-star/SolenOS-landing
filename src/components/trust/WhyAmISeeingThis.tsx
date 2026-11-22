import { useState } from 'react';
import { AccessibleButton } from '../accessible/AccessibleButton';
import { caregiverSafeAssistantText, caregiverSafeGeneratedText } from '@/lib/caregiver-language';

interface WhyAmISeeingThisProps {
  recordSays?: string;
  aiInterpreted?: string;
  whyItMatters?: string;
  remainsUnclear?: string;
  couldClarify?: string;
  supportingSources?: Array<{
    id: string;
    description: string;
    date?: string;
  }>;
  showDetails?: boolean;
}

export default function WhyAmISeeingThis({
  recordSays,
  aiInterpreted,
  whyItMatters,
  remainsUnclear,
  couldClarify,
  supportingSources = [],
  showDetails = false
}: WhyAmISeeingThisProps) {
  const [expanded, setExpanded] = useState(showDetails || false);
  const safeRecordSays = caregiverSafeAssistantText(recordSays);
  const safeAiInterpreted = caregiverSafeGeneratedText(aiInterpreted);
  const safeWhyItMatters = caregiverSafeAssistantText(whyItMatters);
  const safeRemainsUnclear = caregiverSafeAssistantText(remainsUnclear);
  const safeCouldClarify = caregiverSafeAssistantText(couldClarify);

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '4px',
      fontSize: 'calc(12px * var(--solenos-text-scale, 1))',
      color: 'var(--text-secondary)'
    }}>
      {!expanded && (
        <AccessibleButton
          variant="outline"
          size="small"
          onClick={() => setExpanded(true)}
          children="Why am I seeing this?"
        />
      )}
      
      {expanded && (
        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)',
          borderRadius: '8px', 
          padding: '16px 20px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '12px'
          }}>
            <span style={{ 
              fontWeight: '500',
              color: 'var(--text)'
            }}>
              Why am I seeing this?
            </span>
            <AccessibleButton
              variant="outline"
              size="small"
              onClick={() => setExpanded(false)}
              children="×"
            />
          </div>
          
          {safeRecordSays && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                What the record says:
              </span>
              <p style={{ 
                fontSize: 'calc(12px * var(--solenos-text-scale, 1))', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {safeRecordSays}
              </p>
            </div>
          )}
          
          {safeAiInterpreted && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                What this might mean:
              </span>
              <p style={{ 
                fontSize: 'calc(12px * var(--solenos-text-scale, 1))', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {safeAiInterpreted}
              </p>
            </div>
          )}
          
          {safeWhyItMatters && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                Why it may matter:
              </span>
              <p style={{ 
                fontSize: 'calc(12px * var(--solenos-text-scale, 1))', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {safeWhyItMatters}
              </p>
            </div>
          )}
          
          {safeRemainsUnclear && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                What remains unclear:
              </span>
              <p style={{ 
                fontSize: 'calc(12px * var(--solenos-text-scale, 1))', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {safeRemainsUnclear}
              </p>
            </div>
          )}
          
          {safeCouldClarify && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                What could clarify it:
              </span>
              <p style={{ 
                fontSize: 'calc(12px * var(--solenos-text-scale, 1))', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {safeCouldClarify}
              </p>
            </div>
          )}
          
          {supportingSources.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                Related notes and documents:
              </span>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px'
              }}>
                {supportingSources.map((source, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '4px 8px',
                    background: 'var(--bg)',
                    borderRadius: '4px'
                  }}>
                    <span style={{ 
                      fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
                      color: 'var(--text)'
                    }}>
                      {caregiverSafeAssistantText(source.description) || 'Related care information'}
                    </span>
                    {source.date && (
                      <span style={{ 
                        fontSize: 'calc(10px * var(--solenos-text-scale, 1))', 
                        color: 'var(--text-secondary)'
                      }}>
                        {new Date(source.date).toLocaleDateString()}
                      </span>
                    )}

                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}