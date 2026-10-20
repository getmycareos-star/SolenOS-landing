import { useState } from 'react';
import { AccessibleButton } from '../accessible/AccessibleButton';

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

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '4px',
      fontSize: '12px',
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
          
          {recordSays && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                What the record says:
              </span>
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {recordSays}
              </p>
            </div>
          )}
          
          {aiInterpreted && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                What SolenOS interpreted:
              </span>
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {aiInterpreted}
              </p>
            </div>
          )}
          
          {whyItMatters && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                Why it may matter:
              </span>
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {whyItMatters}
              </p>
            </div>
          )}
          
          {remainsUnclear && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                What remains unclear:
              </span>
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {remainsUnclear}
              </p>
            </div>
          )}
          
          {couldClarify && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                What could clarify it:
              </span>
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {couldClarify}
              </p>
            </div>
          )}
          
          {supportingSources.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px',
                fontWeight: '500'
              }}>
                Supporting sources:
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
                      fontSize: '11px', 
                      color: 'var(--text)'
                    }}>
                      {source.description}
                    </span>
                    {source.date && (
                      <span style={{ 
                        fontSize: '10px', 
                        color: 'var(--text-secondary)'
                      }}>
                        {new Date(source.date).toLocaleDateString()}
                      </span>
                    )}
                    <AccessibleButton
                      variant="outline"
                      size="small"
                      onClick={() => {
                        // In a real app, this would navigate to the source evidence
                        alert(`Viewing source: ${source.id}`);
                      }}
                      children="View"
                    />
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