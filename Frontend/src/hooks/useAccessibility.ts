import { useEffect, useRef } from 'react';

/**
 * Hook to manage focus restoration
 */
export function useFocusRestore() {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    return () => {
      if (previousActiveElementRef.current && previousActiveElementRef.current.focus) {
        previousActiveElementRef.current.focus();
      }
    };
  }, []);
}

/**
 * Hook to trap focus within a modal or dialog
 */
export function useFocusTrap(enabled = true) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = containerRef.current?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;

      if (!focusableElements.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (e.shiftKey) {
        if (activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    containerRef.current.addEventListener('keydown', handleKeyDown);
    return () => containerRef.current?.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  return containerRef;
}

/**
 * Generate unique IDs for accessibility
 */
let idCounter = 0;
export function useId(prefix = 'id'): string {
  const id = useRef(`${prefix}-${++idCounter}`);
  return id.current;
}

/**
 * Announce messages to screen readers
 */
export function announceToScreenReader(message: string, polite = true) {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', polite ? 'polite' : 'assertive');
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  document.body.appendChild(announcement);

  setTimeout(() => announcement.remove(), 1000);
}
