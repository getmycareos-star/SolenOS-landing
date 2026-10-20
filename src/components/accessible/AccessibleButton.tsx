import { useRef } from 'react';
import { ARIA, Keyboard, Focus } from '../lib/accessibility';

interface AccessibleButtonProps {
  /** Button text content */
  children: React.ReactNode;
  /** Click handler */
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** Button type (submit, button, reset) */
  type?: 'submit' | 'button' | 'reset';
  /** Whether button is disabled */
  disabled?: boolean;
  /** ARIA label for screen readers (overrides children if provided) */
  'aria-label'?: string;
  /** ARIA describedby for additional description */
  'aria-describedby'?: string;
  /** Keyboard shortcut (e.g., "Ctrl+Enter") */
  accessKey?: string;
  /** Custom CSS class */
  className?: string;
  /** Whether button requires confirmation */
  requiresConfirmation?: boolean;
  /** Confirmation message */
  confirmationMessage?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Loading text */
  loadingText?: string;
  /** Icon to show (left of text) */
  iconLeft?: React.ReactNode;
  /** Icon to show (right of text) */
  iconRight?: React.ReactNode;
  /** Button variant (affects styling) */
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'success';
  /** Button size */
  size?: 'small' | 'medium' | 'large';
  /** Whether to use block layout */
  block?: boolean;
}

/**
 * Accessible Button Component
 * Implements proper accessibility patterns including:
 * - Keyboard navigation (Enter/Space to activate)
 * - Focus management
 * - ARIA attributes
 * - Screen reader announcements
 * - Proper disabled state handling
 */
export function AccessibleButton({
  children,
  onClick,
  type = 'button',
  disabled = false,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby,
  accessKey,
  className = '',
  requiresConfirmation = false,
  confirmationMessage = 'Are you sure?',
  isLoading = false,
  loadingText = 'Loading...',
  iconLeft,
  iconRight,
  variant = 'primary',
  size = 'medium',
  block = false,
}: AccessibleButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  // Handle click with confirmation if required
  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return;
    
    if (requiresConfirmation) {
      if (!window.confirm(confirmationMessage)) {
        return;
      }
    }
    
    onClick(event);
  };
  
  // Handle keyboard activation (Enter/Space)
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled || isLoading) return;
    
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); // Prevent form submission on Enter
      handleClick(event);
    }
    
    // Handle accessKey if provided
    if (accessKey) {
      // Simple accessKey handling (in real app, would be more sophisticated)
      if (event.key.toLowerCase() === accessKey.toLowerCase() && 
          (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        handleClick(event);
      }
    }
  };
  
  // Focus management - focus button when mounted if not disabled
  // useEffect(() => {
  //   if (!disabled && buttonRef.current) {
  //     buttonRef.current.focus();
  //   }
  // }, [disabled]);
  
  // Determine button classes based on variant and size
  const getButtonClasses = (): string => {
    const baseClasses = 'inline-flex items-center justify-center gap-2';
    
    // Variant classes
    const variantClasses = {
      primary: 'bg-trust text-white hover:bg-trust/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust/50 disabled:bg-trust/30',
      secondary: 'bg-muted text-muted-foreground hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted/50 disabled:bg-muted/20',
      outline: 'border border-trust hover:bg-trust/5 text-trust hover:text-trust/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-trust/50 disabled:opacity-50',
      danger: 'bg-destructive text-white hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50 disabled:bg-destructive/30',
      success: 'bg-success text-white hover:bg-success/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success/50 disabled:bg-success/30',
    };
    
    // Size classes
    const sizeClasses = {
      small: 'text-sm px-3 py-1.5',
      medium: 'text-base px-4 py-2',
      large: 'text-lg px-5 py-2.5',
    };
    
    // Block class
    const blockClass = block ? 'w-full' : '';
    
    return `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${blockClass} ${className}`.trim();
  };
  
  // Determine aria-label (use explicit aria-label if provided, otherwise use children text)
  const getAriaLabel = (): string | undefined => {
    if (ariaLabel !== undefined) {
      return ariaLabel;
    }
    
    // For buttons with only icons, we need to ensure there's an aria-label
    // This is a simplified check - in practice, you'd want to extract text from children
    if (iconLeft && !iconRight && typeof children === 'string' && !children.trim()) {
      return undefined; // Will need explicit aria-label
    }
    
    return undefined; // Let screen readers use children content
  };
  
  return (
    <button
      ref={buttonRef}
      type={type}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled || isLoading}
      aria-label={getAriaLabel()}
      aria-describedby={ariaDescribedby}
      className={getButtonClasses()}
    >
      {isLoading && (
        <>
          {/* Loading spinner */}
          <span className="inline-block animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
          <span className="sr-only">{loadingText}</span>
        </>
      )}
      {iconLeft && !isLoading && (
        <span className="mr-2 h-4 w-4" aria-hidden="true">
          {iconLeft}
        </span>
      )}
      {!isLoading && children}
      {iconRight && !isLoading && (
        <span className="ml-2 h-4 w-4" aria-hidden="true">
          {iconRight}
        </span>
      )}
    </button>
  );
}

/**
 * Visually hidden but screen reader accessible text
 */
export function SrOnly({ children }: { children: React.ReactNode }) {
  return (
    <span className="sr-only" aria-hidden="false">
      {children}
    </span>
  );
}

/**
 * Visually hidden element that becomes visible on focus (for skip links)
 */
export function SrOnlyFocusable({ children }: { children: React.ReactNode }) {
  return (
    <span 
      className="sr-only focus-not-hidden:not-sr-only"
      tabIndex={0}
      aria-hidden="false"
    >
      {children}
    </span>
  );
}