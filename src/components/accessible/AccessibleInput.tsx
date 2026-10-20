import { useRef, useState, useEffect } from 'react';
import { ARIA, Focus } from '../lib/accessibility';

interface AccessibleInputProps {
  /** Input label */
  label: string;
  /** Input type (text, password, email, etc.) */
  type?: string;
  /** Input value */
  value: string;
  /** Input change handler */
  onChange: (value: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether input is required */
  required?: boolean;
  /** Whether input is disabled */
  disabled?: boolean;
  /** Input name attribute */
  name?: string;
  /** ARIA describedby for error messages or additional help */
  'aria-describedby'?: string;
  /** Error message for validation */
  error?: string | null;
  /** Success message for validation */
  success?: string | null;
  /** Whether to show clear button */
  showClearButton?: boolean;
  /** Input autocomplete attribute */
  autoComplete?: string;
  /** Input max length */
  maxLength?: number;
  /** Input min length */
  minLength?: number;
  /** Input pattern for validation */
  pattern?: string;
  /** Input step for number inputs */
  step?: number | string;
  /** Input min value for number/range inputs */
  min?: number | string;
  /** Input max value for number/range inputs */
  max?: number | string;
  /** Input rows for textarea */
  rows?: number | string;
  /** Input cols for textarea */
  cols?: number | string;
  /** Custom CSS class */
  className?: string;
  /** Input variant */
  variant?: 'default' | 'underlined' | 'filled' | 'outlined';
  /** Input size */
  size?: 'small' | 'medium' | 'large';
  /** Whether input is read-only */
  readOnly?: boolean;
  /** Input auto-focus */
  autoFocus?: boolean;
  /** Input direction (ltr/rtl) */
  dir?: 'ltr' | 'rtl';
  /** Input spellcheck */
  spellCheck?: boolean | undefined;
  /** Input inputMode for mobile keyboards */
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
}

/**
 * Accessible Input Component
 * Implements proper accessibility patterns including:
 * - Proper label association
 * - Error state announcements to screen readers
 * - Required field indicators
 * - Valid/invalid states
 * - Clear functionality
 * - Proper focus management
 */
export function AccessibleInput({
  label,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  name,
  'aria-describedby': ariaDescribedby,
  error,
  success,
  showClearButton = false,
  autoComplete,
  maxLength,
  minLength,
  pattern,
  step,
  min,
  max,
  rows,
  cols,
  className = '',
  variant = 'outlined',
  size = 'medium',
  readOnly = false,
  autoFocus = false,
  dir = 'ltr',
  spellCheck,
  inputMode,
}: AccessibleInputProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  
  // Handle value change
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };
  
  // Handle clear button click
  const handleClear = () => {
    onChange('');
    Focus.safeFocus(inputRef.current);
  };
  
  // Focus management
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);
  
  // Determine if we should show error/success states
  const hasError = !!error;
  const hasSuccess = !!success && !error;
  
  // Get input classes based on variant and state
  const getInputClasses = (): string => {
    const baseClasses = 'w-full rounded';
    
    // Variant classes
    const variantClasses = {
      default: 'border border-input bg-background px-3 py-2',
      underlined: 'border-b border-input px-1 py-1',
      filled: 'bg-input/50 px-3 py-2',
      outlined: 'border border-input bg-background px-3 py-2',
    };
    
    // Size classes
    const sizeClasses = {
      small: 'text-sm',
      medium: 'text-base',
      large: 'text-lg',
    };
    
    // State classes
    const stateClasses = {
      error: 'border-destructive bg-destructive/5',
      success: 'border-success bg-success/5',
      focused: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust/50',
      disabled: 'opacity-50 cursor-not-allowed',
    };
    
    return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} 
      ${isFocused ? stateClasses.focused : ''}
      ${hasError ? stateClasses.error : ''}
      ${hasSuccess ? stateClasses.success : ''}
      ${disabled ? stateClasses.disabled : ''}
      ${className}`.trim();
  };
  
  // Generate helper text (error, success, or placeholder)
  const getHelperText = (): string | null => {
    if (error) return error;
    if (success) return success;
    return null;
  };
  
  // Generate required indicator
  const getRequiredIndicator = (): JSX.Element | null => {
    if (required) {
      return (
        <span className="mx-1 text-destructive" aria-hidden="true">
          *
        </span>
      );
    }
    return null;
  };
  
  return (
    <div className="space-y-2">
      <label
        htmlFor={name || undefined}
        className="text-sm font-medium text-muted-foreground"
        {...ARIA.label(label)}
      >
        {label}
        {getRequiredIndicator()}
      </label>
      
      <div className="relative">
        {rows ? (
          <textarea
            ref={inputRef}
            id={name}
            type={type}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            autoComplete={autoComplete}
            maxLength={maxLength}
            minLength={minLength}
            step={step as any}
            min={min as any}
            max={max as any}
            rows={rows}
            cols={cols}
            dir={dir}
            spellCheck={spellCheck}
            inputMode={inputMode}
            aria-describedby={ ( (ariaDescribedby || '') + (getHelperText() ? (name + '-helper') : '') ).trim() }
            aria-invalid={hasError}
            aria-readonly={readOnly}
            aria-required={required}
            className={getInputClasses() + (rows ? ' resize-y w-full' : ' w-full')}
          />
        ) : (
          <input
            ref={inputRef}
            id={name}
            type={type}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            autoComplete={autoComplete}
            maxLength={maxLength}
            minLength={minLength}
            step={step}
            min={min}
            max={max}
            dir={dir}
            spellCheck={spellCheck}
            inputMode={inputMode}
            aria-describedby={(ariaDescribedby || '') + (getHelperText() ? (name + '-helper') : '')}
            aria-invalid={hasError}
            aria-readonly={readOnly}
            aria-required={required}
            className={getInputClasses() + ' w-full'}
          />
        )}
        
        {/* Clear button */}
        {showClearButton && value && !disabled && !readOnly && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50 hover:opacity-100 disabled:opacity-20"
            aria-label="Clear input"
            tabIndex={-1}
          >
            {/* Clear icon (x) */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        {/* Helper text for screen readers */}
        {getHelperText() && (
          <p
            id={`${name}-helper`}
            className="sr-only"
            aria-live="polite"
          >
            {getHelperText()}
          </p>
        )}
      </div>
    </div>
  );
}
