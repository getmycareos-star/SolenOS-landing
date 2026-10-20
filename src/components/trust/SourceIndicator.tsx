import { useState } from 'react';
import { AccessibleButton } from '../accessible/AccessibleButton';

interface SourceIndicatorProps {
  sourceType?: 'user-recorded' | 'imported' | 'extracted' | 'ai-generated';
  sourceDate?: string;
  eventDate?: string;
  sourceId?: string;
  description?: string;
  showDetails?: boolean;
}

export default function SourceIndicator({
  sourceType,
  sourceDate,
  eventDate,
  sourceId,
  description,
  showDetails = false
}: SourceIndicatorProps) {
  const [expanded, setExpanded] = useState(showDetails || false);

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return undefined;
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    };
    return new Date(dateStr).toLocaleDateString(undefined, options);
  };

  const getSourceTypeLabel = (): string => {
    switch (sourceType) {
      case 'user-recorded': return 'Recorded by you';
      case 'imported': return 'Imported';
      case 'extracted': return 'Extracted from document';
      case 'ai-generated': return 'AI-generated';
      default: return 'Unknown source';
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '4px',
      fontSize: '12px',
      color: 'var(--text-secondary)'
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
            background: 'var(--surface)',
            border: '1px solid var(--border)'
          }}>
            📎
          </span>
          <span>{getSourceTypeLabel()}</span>
          {sourceDate && (
            <span style={{ 
              fontSize: '10px', 
              color: 'var(--text-secondary)',
              marginLeft: '4px'
            }}>
              {formatDate(sourceDate)}
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
              Source Information
            </span>
            <AccessibleButton
              variant="outline"
              size="small"
              onClick={() => setExpanded(false)}
              children="×"
            />
          </div>
          
          <div style={{ marginBottom: '8px' }}>
            <span style={{ 
              fontSize: '11px', 
              color: 'var(--text-secondary)',
              display: 'block',
              marginBottom: '2px'
            }}>
              Source type:
            </span>
            <span style={{ 
              fontSize: '12px', 
              color: 'var(--text)',
              fontWeight: '500'
            }}>
              {getSourceTypeLabel()}
            </span>
          </div>
          
          {sourceDate && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px'
              }}>
                Recorded on:
              </span>
              <span style={{ 
                fontSize: '12px', 
                color: 'var(--text)',
                fontWeight: '500'
              }}>
                {formatDate(sourceDate)}
              </span>
            </div>
          )}
          
          {eventDate && eventDate !== sourceDate && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px'
              }}>
                Event date:
              </span>
              <span style={{ 
                fontSize: '12px', 
                color: 'var(--text)',
                fontWeight: '500'
              }}>
                {formatDate(eventDate)}
              </span>
            </div>
          )}
          
          {description && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px'
              }}>
                Description:
              </span>
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--text)',
                margin: '0'
              }}>
                {description}
              </p>
            </div>
          )}
          
          {sourceId && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center'
            }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)'
              }}>
                Source ID:
              </span>
              <AccessibleButton
                variant="outline"
                size="small"
                onClick={() => {
                  // In a real app, this would navigate to the source evidence
                  alert(`Viewing source evidence: ${sourceId}`);
                }}
                children="View source"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}