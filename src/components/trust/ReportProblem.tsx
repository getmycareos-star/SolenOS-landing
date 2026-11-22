import { useState } from 'react';
import { AccessibleButton } from '../accessible/AccessibleButton';

interface ReportProblemProps {
  contentId: string;
  contentType: 'ai-insight' | 'extracted-info' | 'ai-summary' | 'recommendation';
  onReportSubmit: (report: {
    category: string;
    description?: string;
  }) => Promise<boolean>;
}

export default function ReportProblem({
  contentId,
  contentType,
  onReportSubmit
}: ReportProblemProps) {
  const [showReportForm, setShowReportForm] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const categories = [
    { value: 'factually-incorrect', label: 'This is not correct' },
    { value: 'missing-context', label: 'Important details are missing' },
    { value: 'misleading-interpretation', label: 'This does not reflect what happened' },
    { value: 'unsupported-claim', label: 'This is not supported by the saved information' },
    { value: 'privacy-concern', label: 'Privacy or sharing concern' },
    { value: 'unsafe-output', label: 'Something here could be unsafe' },
    { value: 'other', label: 'Other' }
  ];

  const getContentTypeLabel = (): string => {
    switch (contentType) {
      case 'ai-insight': return 'suggested detail';
      case 'extracted-info': return 'information from a document';
      case 'ai-summary': return 'summary';
      case 'recommendation': return 'Recommendation';
      default: return 'information';
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory) return;
    
    setSubmitting(true);
    setSubmitError(null);
    try {
      const success = await onReportSubmit({
        category: selectedCategory,
        description: description.trim() || undefined
      });
      
      if (success) {
        setSubmitSuccess(true);
        setSubmitError(null);
        // Reset form after a short delay
        setTimeout(() => {
          setShowReportForm(false);
          setSubmitSuccess(false);
          setSelectedCategory('');
          setDescription('');
        }, 1500);
      } else {
        setSubmitError('We couldn’t send your report. Please try again.');
      }
    } catch (err) {
      setSubmitError('We couldn’t send your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!showReportForm && !submitSuccess) {
    return (
      <AccessibleButton
        variant="outline"
        size="small"
        onClick={() => {
          setShowReportForm(true);
          setSelectedCategory('');
          setDescription('');
          setSubmitSuccess(false);
          setSubmitError(null);
        }}
        children="Report a problem"
      />
    );
  }

  if (submitSuccess) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px'
      }}>
        <span style={{ 
          fontSize: 'calc(10px * var(--solenos-text-scale, 1))', 
          padding: '2px 6px', 
          borderRadius: '4px',
          background: 'var(--success-soft)',
          color: 'var(--success)'
        }}>
          ✓
        </span>
        <span style={{ 
          fontSize: 'calc(10px * var(--solenos-text-scale, 1))', 
          color: 'var(--success)',
          fontWeight: '500'
        }}>
          Thanks. Your report was sent.
        </span>
      </div>
    );
  }

  return (
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
          Report a problem with this {getContentTypeLabel()}
        </span>
        <AccessibleButton
          variant="outline"
          size="small"
          onClick={() => {
            setShowReportForm(false);
            setSelectedCategory('');
            setDescription('');
          }}
          children="×"
        />
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <span style={{ 
          fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
          color: 'var(--text-secondary)',
          display: 'block',
          marginBottom: '2px'
        }}>
          What's the issue?
        </span>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '4px'
        }}>
          {categories.map(category => (
            <div key={category.value} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px'
            }}>
              <input
                type="radio"
                id={`report-category-${category.value}`}
                value={category.value}
                checked={selectedCategory === category.value}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{ 
                  width: '12px', 
                  height: '12px'
                }}
              />
              <label
                htmlFor={`report-category-${category.value}`}
                style={{ 
                  fontSize: 'calc(12px * var(--solenos-text-scale, 1))', 
                  color: 'var(--text)',
                  cursor: 'pointer'
                }}
              >
                {category.label}
              </label>
            </div>
          ))}
        </div>
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <span style={{ 
          fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
          color: 'var(--text-secondary)',
          display: 'block',
          marginBottom: '2px'
        }}>
          Anything else we should know? (optional)
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Tell us what went wrong..."
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: 'calc(12px * var(--solenos-text-scale, 1))',
            resize: 'vertical'
          }}
          disabled={submitting}
        />
      </div>
      
      {submitError && (
        <div style={{ 
          background: 'var(--error-soft)', 
          border: '1px solid var(--error)',
          borderRadius: '4px',
          padding: '8px 12px',
          marginBottom: '12px'
        }}>
          <span style={{ 
            fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
            color: 'var(--error)',
            display: 'block',
            marginBottom: '2px'
          }}>
            We couldn’t send your report:
          </span>
          <p style={{ 
            fontSize: 'calc(12px * var(--solenos-text-scale, 1))', 
            color: 'var(--text)',
            margin: '0'
          }}>
            {submitError}
          </p>
        </div>
      )}
      
      <div style={{ 
        display: 'flex', 
        gap: '8px'
      }}>
        <AccessibleButton
          variant="outline"
          size="medium"
          onClick={handleSubmit}
          disabled={submitting || !selectedCategory}
          isLoading={submitting}
          children={submitting ? 'Sending...' : 'Send report'}
        />
        
        <AccessibleButton
          variant="outline"
          size="medium"
          onClick={() => {
            setShowReportForm(false);
            setSelectedCategory('');
            setDescription('');
          }}
          children="Cancel"
        />
      </div>
    </div>
  );
}