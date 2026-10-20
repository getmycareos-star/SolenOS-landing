import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { patchJSON } from '../../api/client';
import { useOptimisticMutation } from '../../lib/optimistic';

const languages = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' }
];

export const LanguageSelector = () => {
  const { i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { mutate, loading: mutating, error: mutationError } = useOptimisticMutation<{ success: boolean }, { language: string }>();

  const changeLanguage = async (lng) => {
    setLoading(true);
    setError(null);
    
    try {
      await mutate(
        {
          mutationFn: async (variables) => {
            return await patchJSON(`/preferences/current-user/language`, {
              language: variables.language
            });
          },
          onMutate: async (variables) => {
            // Capture current language for potential rollback
            const snapshot = i18n.language;
            // Optimistically update the language
            i18n.changeLanguage(variables.language);
            return snapshot;
          },
          onSuccess: (data, variables, context) => {
            // Successfully updated
            console.log('Language updated successfully');
          },
          onError: (err, variables, context) => {
            // Rollback language change
            i18n.changeLanguage(context as string);
            setError(`Failed to update language: ${err instanceof Error ? err.message : String(err)}`);
          },
          onSettled: (data, err, variables, context) => {
            setLoading(false);
          },
          retry: true,
          maxRetries: 3
        },
        {
          language: lng
        }
      );
    } catch (err) {
      setLoading(false);
      setError(`Failed to update language: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 bg-surface border border-border rounded hover:bg-trust/5 ${muting ? 'opacity-70' : ''}`}
        disabled={muting}
      >
        <span>{languages.find(l => l.code === i18n.language)?.flag}</span>
        <span>{languages.find(l => l.code === i18n.language)?.name}</span>
        <span className="transition-transform"> {isOpen ? '▲' : '▼'} </span>
      </button>
      
      {error && (
        <div style={{ 
          background: 'var(--unknown-soft)', 
          border: '1px solid var(--unknown)', 
          borderRadius: '8px', 
          padding: '8px 12px', 
          marginTop: '8px'
        }}>
          <p style={{ margin: '0', fontSize: '12px', color: 'var(--unknown)' }}>
            {error}
          </p>
        </div>
      )}
      
      {isOpen && (
        <div className="absolute left-0 mt-1 w-48 bg-surface border border-border rounded-md shadow-lg z-20">
          {languages.map(lang => (
            <button
              key={lang.code}
              onClick={() => changeLanguage(lang.code)}
              className={`flex items-center gap-2 px-3 py-2 text-left ${i18n.language === lang.code ? 'bg-trust/10' : 'hover:bg-trust/5'} ${muting ? 'opacity-70' : ''}`}
              disabled={muting}
            >
              <span>{lang.flag}</span>
              <span>{lang.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};