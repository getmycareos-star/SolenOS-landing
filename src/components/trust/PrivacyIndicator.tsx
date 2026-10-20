import { useState } from 'react';
import { AccessibleButton } from '../accessible/AccessibleButton';

interface PrivacyIndicatorProps {
  accessLevel?: 'private' | 'shared' | 'unknown';
  sharedWith?: Array<{
    id: string;
    name: string;
    role: 'viewer' | 'editor';
    status: 'accepted' | 'pending';
  }>;
  showDetails?: boolean;
}

export default function PrivacyIndicator({
  accessLevel,
  sharedWith = [],
  showDetails = false
}: PrivacyIndicatorProps) {
  const [expanded, setExpanded] = useState(showDetails || false);

  const getAccessLevelLabel = (): string => {
    switch (accessLevel) {
      case 'private': return 'Private to you';
      case 'shared': return 'Shared with selected people';
      case 'unknown': return 'Access information unavailable';
      default: return 'Access information unavailable';
    }
  };

  const getAccessLevelColors = () => {
    switch (accessLevel) {
      case 'private': 
        return { 
          bg: 'var(--trust-soft)', 
          color: 'var(--trust)',
          border: 'var(--trust)'
        };
      case 'shared': 
        return { 
          bg: 'var(--accent-soft)', 
          color: 'var(--accent)',
          border: 'var(--accent)'
        };
      case 'unknown': 
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
            background: getAccessLevelColors().bg,
            color: getAccessLevelColors().color,
            border: `1px solid ${getAccessLevelColors().border}`
          }}>
            {accessLevel === 'private' ? '🔒' : 
             accessLevel === 'shared' ? '👥' : 
             '🔒'}
          </span>
          <span>{getAccessLevelLabel()}</span>
        </div>
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
            marginBottom: '8px'
          }}>
            <span style={{ 
              fontWeight: '500',
              color: 'var(--text)'
            }}>
              Who can access this?
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
              Access level:
            </span>
            <span style={{ 
              fontSize: '12px', 
              color: getAccessLevelColors().color,
              fontWeight: '500',
              background: getAccessLevelColors().bg,
              padding: '2px 6px',
              borderRadius: '4px'
            }}>
              {getAccessLevelLabel()}
            </span>
          </div>
          
          {accessLevel === 'shared' && sharedWith.length > 0 && (
            <div style={{ marginBottom: '12px' }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px'
              }}>
                Shared with:
              </span>
              <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '6px'
              }}>
                {sharedWith.map((person, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    padding: '4px 8px',
                    background: 'var(--bg)',
                    borderRadius: '4px'
                  }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px'
                    }}>
                      <span style={{ 
                        fontSize: '11px', 
                        color: 'var(--text)'
                      }}>
                        {person.name}
                      </span>
                      <span style={{ 
                        fontSize: '10px', 
                        padding: '1px 4px', 
                        borderRadius: '3px',
                        background: person.role === 'editor' ? 'var(--warning-soft)' : 'var(--trust-soft)',
                        color: person.role === 'editor' ? 'var(--warning)' : 'var(--trust)'
                      }}>
                        {person.role === 'editor' ? 'Editor' : 'Viewer'}
                      </span>
                    </div>
                    <span style={{ 
                      fontSize: '10px', 
                      color: person.status === 'accepted' ? 'var(--text-secondary)' : 'var(--unknown)'
                    }}>
                      {person.status === 'accepted' ? 'Accepted' : 'Pending'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {(accessLevel === 'shared' && sharedWith.length === 0) || accessLevel === 'unknown' && (
            <div style={{ 
              background: 'var(--unknown-soft)',
              border: '1px solid var(--unknown)',
              borderRadius: '4px',
              padding: '8px 12px'
            }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)',
                display: 'block',
                marginBottom: '2px'
              }}>
                Access details:
              </span>
              <p style={{ 
                fontSize: '12px', 
                color: 'var(--text)',
                margin: '0',
                lineHeight: '1.4'
              }}>
                {accessLevel === 'unknown' 
                  ? 'The system cannot determine who has access to this information at this time.' 
                  : 'This item is marked as shared but no specific recipients have been identified.'}
              </p>
            </div>
          )}
          
          {accessLevel === 'shared' && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center'
            }}>
              <span style={{ 
                fontSize: '11px', 
                color: 'var(--text-secondary)'
              }}>
                Manage access:
              </span>
              <AccessibleButton
                variant="outline"
                size="small"
                onClick={() => {
                  // In a real app, this would navigate to privacy settings
                  alert('Opening access management...');
                }}
                children="Manage"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}