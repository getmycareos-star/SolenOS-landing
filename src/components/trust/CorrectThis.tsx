import { useState } from 'react';
import { caregiverSafeErrorMessage } from '@/lib/caregiver-language';
import { AccessibleButton } from '../accessible/AccessibleButton';

interface CorrectThisProps {
  fieldId: string;
  currentValue: string;
  fieldType: 'original-entry' | 'extracted-info' | 'ai-interpretation' | 'date' | 'source-association';
  onCorrectionSubmit: (correction: string) => Promise<boolean>;
  onCorrectionCancel: () => void;
}

export default function CorrectThis({
  fieldId,
  currentValue,
  fieldType,
  onCorrectionSubmit,
  onCorrectionCancel
}: CorrectThisProps) {
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const [correctionValue, setCorrectionValue] = useState(currentValue);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const getFieldTypeLabel = (): string => {
    switch (fieldType) {
      case 'original-entry': return 'Original entry';
      case 'extracted-info': return 'Details read from a document';
      case 'ai-interpretation': return 'Suggested by SolenOS';
      case 'date': return 'Date';
      case 'source-association': return 'Where this came from';
      default: return 'Field';
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const success = await onCorrectionSubmit(correctionValue);
      if (success) {
        setSubmitSuccess(true);
        setSubmitError(null);
        // Reset form after a short delay
        setTimeout(() => {
          setShowCorrectionForm(false);
          setSubmitSuccess(false);
          setCorrectionValue(currentValue);
        }, 1500);
      } else {
        setSubmitError('Failed to save correction');
      }
    } catch (err) {
      setSubmitError(caregiverSafeErrorMessage());
    } finally {
      setSubmitting(false);
    }
  };

  if (!showCorrectionForm && !submitSuccess) {
    return (
      <AccessibleButton
        variant="outline"
        size="small"
        onClick={() => {
          setShowCorrectionForm(true);
          setCorrectionValue(currentValue);
          setSubmitSuccess(false);
          setSubmitError(null);
        }}
        children="Correct this"
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
          Correction saved
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
          Correct {getFieldTypeLabel()}
        </span>
        <AccessibleButton
          variant="outline"
          size="small"
          onClick={() => {
            setShowCorrectionForm(false);
            onCorrectionCancel();
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
          Current value:
        </span>
        <p style={{ 
          fontSize: 'calc(12px * var(--solenos-text-scale, 1))', 
          color: 'var(--text)',
          margin: '0',
          background: 'var(--bg)',
          padding: '8px 12px',
          borderRadius: '4px'
        }}>
          {currentValue}
        </p>
      </div>
      
      <div style={{ marginBottom: '12px' }}>
        <span style={{ 
          fontSize: 'calc(11px * var(--solenos-text-scale, 1))', 
          color: 'var(--text-secondary)',
          display: 'block',
          marginBottom: '2px'
        }}>
          Your correction:
        </span>
        <textarea
          value={correctionValue}
          onChange={(e) => setCorrectionValue(e.target.value)}
          rows={3}
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
            Error:
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
          disabled={submitting || !correctionValue.trim()}
          isLoading={submitting}
          children={submitting ? 'Saving...' : 'Save correction'}
        />
        
        <AccessibleButton
          variant="outline"
          size="medium"
          onClick={() => {
            setShowCorrectionForm(false);
            onCorrectionCancel();
          }}
          children="Cancel"
        />
      </div>
    </div>
  );
}