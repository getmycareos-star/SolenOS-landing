import { useState } from 'react';
import { patchJSON } from '../../api/client';
import { useOptimisticMutation } from '../../lib/optimistic';

interface PreferenceUpdate {
  userId: string;
  preferenceKey: string;
  preferenceValue: any;
}

interface PreferenceResponse {
  success: boolean;
  updatedAt: string;
}

export default function PreferenceDemo() {
  const [preferences, setPreferences] = useState({
    notificationsEnabled: true,
    privacyLevel: 'standard',
    language: 'en',
    theme: 'light'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mutate, loading: mutating, error: mutationError } = useOptimisticMutation<PreferenceResponse, PreferenceUpdate>();

  const handlePreferenceChange = async (key: keyof typeof preferences, value: any) => {
    setLoading(true);
    setError(null);
    
    try {
      await mutate(
        {
          mutationFn: async (variables) => {
            return await patchJSON(`/preferences/${variables.userId}`, {
              [variables.preferenceKey]: variables.preferenceValue
            });
          },
          onMutate: async (variables) => {
            // Capture snapshot
            const snapshot = preferences;
            // Optimistically update the state
            setPreferences(prev => ({
              ...prev,
              [variables.preferenceKey]: variables.preferenceValue
            }));
            return snapshot;
          },
          onSuccess: (data, variables, context) => {
            // Mutation succeeded, no further action needed
            console.log('Preference updated successfully:', data);
          },
          onError: (err, variables, context) => {
            // Rollback to snapshot
            setPreferences(context as any);
            setError(`Failed to update preference: ${err instanceof Error ? err.message : String(err)}`);
          },
          onSettled: (data, err, variables, context) => {
            setLoading(false);
          },
        },
        {
          userId: 'current-user-id', // In reality, this would come from auth context
          preferenceKey: key,
          preferenceValue: value
        }
      );
    } catch (err) {
      setLoading(false);
      setError(`Failed to update preference: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>
        Preference Management (Optimistic Updates)
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
        Experience immediate feedback when changing system preferences.
      </p>
      
      {error && (
        <div style={{ 
          background: 'var(--unknown-soft)', 
          border: '1px solid var(--unknown)', 
          borderRadius: '8px', 
          padding: '12px 16px', 
          marginBottom: '16px'
        }}>
          <p style={{ margin: '0', fontSize: '13px', color: 'var(--unknown)' }}>
            {error}
          </p>
        </div>
      )}
      
      <div style={{ display: 'grid', gap: '16px' }}>
        {/* Notifications Toggle */}
        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: '12px', 
          padding: '16px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                Notifications
              </h3>
              <p style={{ margin: '0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Enable or disable system notifications
              </p>
            </div>
            <label style={{ 
              position: 'relative', 
              display: 'inline-block', 
              width: '48px', 
              height: '24px'
            }}>
              <input
                type="checkbox"
                checked={preferences.notificationsEnabled}
                onChange={(e) => handlePreferenceChange('notificationsEnabled', e.target.checked)}
                disabled={mutating}
                style={{
                  opacity: 0,
                  width: 0,
                  height: 0
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: preferences.notificationsEnabled ? 'var(--trust)' : 'var(--border)',
                  borderRadius: '999px',
                  transition: 'background-color 0.2s'
                }}
                aria-label="Notifications toggle"
              ></span>
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  left: preferences.notificationsEnabled ? '24px' : '2px',
                  width: '20px',
                  height: '20px',
                  backgroundColor: 'white',
                  borderRadius: '50%',
                  transition: 'transform 0.2s',
                  transform: preferences.notificationsEnabled ? 'translateX(0)' : 'translateX(-24px)'
                }}
                aria-hidden="true"
              ></span>
            </label>
          </div>
        </div>
        
        {/* Privacy Level Selector */}
        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: '12px', 
          padding: '16px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                Privacy Level
              </h3>
              <p style={{ margin: '0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Control how much data is shared for improvement
              </p>
            </div>
            <select
              value={preferences.privacyLevel}
              onChange={(e) => handlePreferenceChange('privacyLevel', e.target.value)}
              disabled={mutating}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '13px',
                cursor: mutating ? 'default' : 'pointer',
                opacity: mutating ? 0.7 : 1
              }}
            >
              <option value="minimum">Minimum</option>
              <option value="standard">Standard</option>
              <option value="full">Full</option>
            </select>
          </div>
        </div>
        
        {/* Language Selector */}
        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: '12px', 
          padding: '16px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                Language
              </h3>
              <p style={{ margin: '0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Select interface language
              </p>
            </div>
            <select
              value={preferences.language}
              onChange={(e) => handlePreferenceChange('language', e.target.value)}
              disabled={mutating}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '13px',
                cursor: mutating ? 'default' : 'pointer',
                opacity: mutating ? 0.7 : 1
              }}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </div>
        
        {/* Theme Selector */}
        <div style={{ 
          background: 'var(--surface)', 
          border: '1px solid var(--border)', 
          borderRadius: '12px', 
          padding: '16px 20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 600 }}>
                Theme
              </h3>
              <p style={{ margin: '0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                Choose light or dark mode
              </p>
            </div>
            <select
              value={preferences.theme}
              onChange={(e) => handlePreferenceChange('theme', e.target.value)}
              disabled={mutating}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                color: 'var(--text)',
                fontSize: '13px',
                cursor: mutating ? 'default' : 'pointer',
                opacity: mutating ? 0.7 : 1
              }}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Current preferences display */}
      <div style={{ 
        background: 'var(--trust-soft)', 
        border: '1px solid var(--trust)', 
        borderRadius: '8px', 
        padding: '12px 16px', 
        marginTop: '24px'
      }}>
        <p style={{ margin: '0 0 4px 0', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--trust)' }}>
          Current Preferences
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span>Notifications:</span>
            <span>{preferences.notificationsEnabled ? 'Enabled' : 'Disabled'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span>Privacy Level:</span>
            <span>{preferences.privacyLevel}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span>Language:</span>
            <span>
              {preferences.language === 'en' ? 'English' :
               preferences.language === 'es' ? 'Español' :
               preferences.language === 'fr' ? 'Français' :
               preferences.language}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span>Theme:</span>
            <span>{preferences.theme}</span>
          </div>
        </div>
      </div>
    </div>
  );
}