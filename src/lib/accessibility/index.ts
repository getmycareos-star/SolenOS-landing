import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for managing focus trap within an element
 * Useful for modals, dropdowns, and other interactive elements
 */
export function useFocusTrap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if (!isEnabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (firstFocusable) {
      firstFocusable.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnabled, containerRef]);

  return {
    containerRef,
    setIsEnabled: (enabled: boolean) => setIsEnabled(enabled),
  };
}

/**
 * Custom hook for announcing updates to screen readers
 * Uses aria-live regions for dynamic content updates
 */
export function useScreenReaderAnnouncer() {
  const [announce, setAnnounce] = useState<string | null>(null);
  const announcerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!announcerRef.current) return;

    // Create announcer element if it doesn't exist
    if (!announcerRef.current) {
      const announcer = document.createElement('div');
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.position = 'absolute';
      announcer.style.width = '1px';
      announcer.style.height = '1px';
      announcer.style.overflow = 'hidden';
      announcer.style.clip = 'rect(0 0 0 0)';
      announcer.style.whiteSpace = 'nowrap';
      document.body.appendChild(announcer);
      announcerRef.current = announcer;
    }

    // Update the announcer content
    if (announce) {
      announcerRef.current.textContent = announce;
      
      // Clear after a short delay to allow for repeated announcements
      const timeoutId = setTimeout(() => {
        setAnnounce(null);
      }, 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [announce]);

  return {
    announcerRef,
    announce: (message: string) => setAnnounce(message),
  };
}

/**
 * Utility function to check if an element is visible to screen readers
 */
export function isElementVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    style.opacity !== '0'
  );
}

/**
 * Utility function to trap focus within an element
 */
export function trapFocus(element: HTMLElement) {
  const focusableElements = element.querySelectorAll<
    HTMLElement
  >('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  if (!firstFocusable) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstFocusable) {
        e.preventDefault();
        lastFocusable?.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastFocusable) {
        e.preventDefault();
        firstFocusable?.focus();
      }
    }
  };

  element.addEventListener('keydown', handleKeyDown);
  
  // Return cleanup function
  return () => {
    element.removeEventListener('keydown', handleKeyDown);
  };
}

/**
 * Utility function to skip to main content
 */
export function skipToContent() {
  const mainContent = document.querySelector('main, #main, [role="main"]');
  if (mainContent) {
    mainContent.focus();
  }
}

/**
 * ARIA label builder utility
 */
export class ARIA {
  static label(label: string): Record<string, string> {
    return { 'aria-label': label };
  }

  static labelledBy(id: string): Record<string, string> {
    return { 'aria-labelledby': id };
  }

  static describedBy(id: string): Record<string, string> {
    return { 'aria-describedby': id };
  }

  static hidden(hidden: boolean = true): Record<string, string> {
    return hidden ? { 'aria-hidden': 'true' } : {};
  }

  static disabled(disabled: boolean = true): Record<string, string> {
    return disabled ? { 'aria-disabled': 'true' } : {};
  }

  static expanded(expanded: boolean): Record<string, string> {
    return { 'aria-expanded': String(expanded) };
  }

  static selected(selected: boolean): Record<string, string> {
    return { 'aria-selected': String(selected) };
  }

  static checked(checked: boolean): Record<string, string> {
    return { 'aria-checked': String(checked) };
  }

  static busy(busy: boolean = true): Record<string, string> {
    return busy ? { 'aria-busy': 'true' } : {};
  }

  static live(polite: 'polite' | 'assertive' = 'polite'): Record<string, string> {
    return { 'aria-live': polite };
  }

  static atomic(atomic: boolean = true): Record<string, string> {
    return { 'aria-atomic': String(atomic) };
  }

  static controls(controlId: string): Record<string, string> {
    return { 'aria-controls': controlId };
  }

  static owns(ownedId: string): Record<string, string> {
    return { 'aria-owns': ownedId };
  }

  static role(role: string): Record<string, string> {
    return { role };
  }

  static placeholder(placeholder: string): Record<string, string> {
    return { 'aria-placeholder': placeholder };
  }

  static invalid(invalid: boolean = true): Record<string, string> {
    return invalid ? { 'aria-invalid': 'true' } : {};
  }

  static required(required: boolean = true): Record<string, string> {
    return required ? { 'aria-required': 'true' } : {};
  }

  static multiline(multiline: boolean = true): Record<string, string> {
    return multiline ? { 'aria-multiline': 'true' } : {};
  }

  static readonly(readonly: boolean = true): Record<string, string> {
    return readonly ? { 'aria-readonly': 'true' } : {};
  }

  static modal(modal: boolean = true): Record<string, string> {
    return modal ? { 'aria-modal': 'true' } : {};
  }

  static keyshortcuts(keys: string): Record<string, string> {
    return { 'aria-keyshortcuts': keys };
  }

  static roledescription(description: string): Record<string, string> {
    return { 'aria-roledescription': description };
  }
}

/**
 * Keyboard utility functions
 */
export const Keyboard = {
  /**
   * Check if a key combination matches
   */
  isKeyCombination: (e: KeyboardEvent, key: string, modifiers: {
    shift?: boolean;
    ctrl?: boolean;
    alt?: boolean;
    meta?: boolean;
  } = {}): boolean => {
    if (e.key.toLowerCase() !== key.toLowerCase()) return false;
    
    return (
      (!modifiers.shift || e.shiftKey) &&
      (!modifiers.ctrl || e.ctrlKey) &&
      (!modifiers.alt || e.altKey) &&
      (!modifiers.meta || e.metaKey)
    );
  },

  /**
   * Get keyboard modifier state
   */
  getModifierState: (e: KeyboardEvent) => ({
    shift: e.shiftKey,
    ctrl: e.ctrlKey,
    alt: e.altKey,
    meta: e.metaKey,
    capsLock: e.getModifierState?.('CapsLock') || false,
    numLock: e.getModifierState?.('NumLock') || false,
  }),

  /**
   * Prevent default and stop propagation
   */
  killEvent: (e: KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
  },
};

/**
 * Focus utility functions
 */
export const Focus = {
  /**
   * Safely focus an element
   */
  safeFocus: (element: HTMLElement | null) => {
    if (element && typeof element.focus === 'function') {
      try {
        element.focus();
      } catch (e) {
        // Ignore focus errors (element might be detached or hidden)
      }
    }
  },

  /**
   * Focus the first focusable element in a container
   */
  focusFirst: (container: HTMLElement) => {
    const focusable = container.querySelector<
      HTMLElement
    >('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    Focus.safeFocus(focusable);
  },

  /**
   * Focus the last focusable element in a container
   */
  focusLast: (container: HTMLElement) => {
    const focusable = container.querySelectorAll<
      HTMLElement
    >('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const last = focusable[focusable.length - 1];
    Focus.safeFocus(last);
  },

  /**
   * Check if element is currently focused
   */
  isFocused: (element: HTMLElement): boolean => {
    return document.activeElement === element;
  },

  /**
   * Get currently focused element
   */
  getFocused: (): HTMLElement | null => {
    return document.activeElement as HTMLElement || null;
  },
};