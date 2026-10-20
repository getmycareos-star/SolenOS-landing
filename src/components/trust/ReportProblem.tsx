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
    { value: 'factually-incorrect', label: 'Factually incorrect' },
    { value: 'missing-context', label: 'Missing important context' },
    { value: 'misleading-interpretation', label: 'Misleading interpretation' },
    { value: 'unsupported-claim', label: 'Unsupported claim' },
    { value: 'privacy-concern', label: 'Privacy or access concern' },
    { value: 'unsafe-output', label: 'Potentially unsafe AI output' },
    { value: 'other', label: 'Other' }
  ];

  const getContentTypeLabel = (): string => {
    switch (contentType) {
      case 'ai-insight': return 'AI insight';
      case 'extracted-info': return 'Extracted information';
      case 'ai-summary': return 'AI summary';
      case 'recommendation': return 'Recommendation';
      default: return 'Content';
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
        setSubmitError('Failed to submit report');
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unknown error');
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
          fontSize: '10px', 
          padding: '2px 6px', 
          borderRadius: '4px',
          background: 'var(--success-soft)',
          color: 'var(--success)'
        }}>
          ✓
        </span>
        <span style={{ 
          fontSize: '10px', 
          color: 'var(--success)',
          fontWeight: '500'
        }}>
          Report submitted
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
          Report a problem with {getContentTypeLabel()}
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
          fontSize: '11px', 
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
                  fontSize: '12px', 
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
          fontSize: '11px', 
          color: 'var(--text-secondary)',
          display: 'block',
          marginBottom: '2px'
        }}>
          Additional details (optional):
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Please describe the issue in more detail..."
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text)',
            fontSize: '12px',
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
            fontSize: '11px', 
            color: 'var(--error)',
            display: 'block',
            marginBottom: '2px'
          }}>
            Error:
          </span>
          <p style={{ 
            fontSize: '12px', 
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
          children={submitting ? 'Submitting...' : 'Submit report'}
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