import React, { useEffect, useRef } from 'react';

interface KeyboardShortcutWrapperProps {
  /** Callback when backspace is pressed and item is selected */
  onDelete?: (id: string) => void;
  /** ID of the currently selected item */
  selectedId?: string | null;
  /** Whether keyboard shortcuts should be enabled */
  enabled?: boolean;
  /** Children to wrap */
  children: React.ReactNode;
}

/**
 * KeyboardShortcutWrapper Component
 * 
 * A wrapper that provides keyboard shortcuts for selected items.
 * Currently supports:
 * - Backspace: Delete selected item (when not editing text)
 * 
 * @example
 * ```tsx
 * <KeyboardShortcutWrapper
 *   selectedId={selectedCardId}
 *   onDelete={(id) => handleDelete(id)}
 *   enabled={!isEditing}
 * >
 *   <YourComponent />
 * </KeyboardShortcutWrapper>
 * ```
 */
export function KeyboardShortcutWrapper({
  onDelete,
  selectedId,
  enabled = true,
  children,
}: KeyboardShortcutWrapperProps): React.ReactElement {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !selectedId || !onDelete) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      const isTyping = 
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      if (isTyping) {
        return;
      }

      // Handle backspace to delete selected item
      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        e.stopPropagation();
        onDelete(selectedId);
      }
    };

    // Add event listener to document
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, selectedId, onDelete]);

  return (
    <div ref={wrapperRef} className="keyboard-shortcut-wrapper">
      {children}
    </div>
  );
}

export default KeyboardShortcutWrapper;

