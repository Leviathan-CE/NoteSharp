import React, { useState, useRef } from 'react';
import DraggableWrapper from '../functional/DraggableWrapper';
import ResizableWrapper from '../functional/ResizableWrapper';
import Input from '../common/Input';
import { SafeMarkdown } from '../../lib/markdown';

interface CardProps {
  /** Unique identifier for this card */
  id: string;
  /** Initial position on the canvas */
  initialPosition?: { x: number; y: number };
  /** Initial size */
  initialSize?: { width: number; height: number };
  /** Initial content/value */
  initialValue?: string;
  /** Callback when position changes */
  onPositionChange?: (id: string, position: { x: number; y: number }) => void;
  /** Callback when size changes */
  onSizeChange?: (id: string, size: { width: number; height: number }) => void;
  /** Callback when content changes */
  onContentChange?: (id: string, content: string) => void;
  /** Callback when content editing finishes (on blur) */
  onContentBlur?: (id: string, content: string) => void;
  /** Callback when card is deleted */
  onDelete?: (id: string) => void;
  /** Whether the card is in edit mode */
  isEditing?: boolean;
  /** Callback when card is clicked (for selection) */
  onClick?: () => void;
  /** Whether the card is currently selected */
  isSelected?: boolean;
  /** Callback when mouse down occurs on the card */
  onMouseDown?: (id: string) => void;
  /** Current zoom level (default: 1) - used to scale movement */
  zoom?: number;
}

/**
 * Card Component
 * 
 * A draggable input box that can be freely positioned on a canvas.
 * Similar to Milanote's note card system - can be moved around freely.
 */
export function NoteCard({
  id,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 256, height: 200 },
  initialValue = '',
  onPositionChange,
  onSizeChange,
  onContentChange,
  onContentBlur,
  onDelete,
  isEditing: externalIsEditing,
  onClick,
  isSelected = false,
  onMouseDown,
  zoom = 1,
}: CardProps): React.ReactElement {
  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(externalIsEditing ?? false);
  
  // Track mouse position to distinguish clicks from drags
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const hasMovedRef = useRef(false);
  const isMouseDownRef = useRef(false);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    if (onContentChange) {
      onContentChange(id, newValue);
    }
  };

  const handleFocus = () => {
    setIsEditing(true);
  };

  const handleContentMouseDown = (e: React.MouseEvent) => {
    // Check if clicking on a link or other interactive element in markdown
    const target = e.target as HTMLElement;
    if (target.tagName === 'A' || target.closest('a')) {
      // Let links work normally - don't interfere
      return;
    }
    
    // Track that mouse is down
    isMouseDownRef.current = true;
    
    // Stop propagation to prevent DraggableWrapper from starting drag immediately
    // If item is selected and mouse is already down, allow propagation for dragging
    // if (isSelected || !isMouseDownRef.current) {
    //   e.stopPropagation();
    // }
    
    // Store mouse position to detect if this becomes a drag
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
    hasMovedRef.current = false;
    
    // Track mouse movement to detect drags
    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (mouseDownPosRef.current) {
        const dx = moveEvent.clientX - mouseDownPosRef.current.x;
        const dy = moveEvent.clientY - mouseDownPosRef.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 5) {
          hasMovedRef.current = true;
        }
      }
    };
    
    const handleMouseUp = () => {
      // Only handle click if we didn't drag
      if (!hasMovedRef.current && mouseDownPosRef.current) {
        // This was a click, not a drag
        if (isSelected) {
          // Second click - open edit mode
          handleFocus();
        } else {
          // First click - select the card
          if (onClick) {
            onClick();
            
          }
        }
      }
      
      // Clean up

      isMouseDownRef.current = false;
      mouseDownPosRef.current = null;
      hasMovedRef.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp, { once: true });
  };

  const handleBlur = () => {
    setIsEditing(false);
    if (onContentBlur) {
      onContentBlur(id, value);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (onDelete) {
      onDelete(id);
    }
  };

  const handleSizeChange = (size: { width: number; height: number }) => {
    if (onSizeChange) {
      onSizeChange(id, size);
    }
  };

  return (
    <DraggableWrapper
      id={id}
      initialPosition={initialPosition}
      onPositionChange={onPositionChange}
      onMouseDown={onMouseDown}
      zoom={zoom}
    >
      <ResizableWrapper
        initialSize={initialSize}
        minWidth={150}
        minHeight={120}
        onSizeChange={handleSizeChange}
      >
        <div
          data-card={id}
          className={`bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-all h-full w-full overflow-hidden flex flex-col ${
            isSelected ? 'border-2 border-blue-500' : 'border border-gray-200'
          }`}
          onDoubleClick={handleFocus}
          onClick={(e) => {
            
            // Only trigger onClick if not clicking on delete button, textarea, or the content area
            const target = e.target as HTMLElement;
            if (target.closest('button') || target.tagName === 'TEXTAREA') {
              return;
            }
            
            // If clicking on the content area, let handleContentClick handle it
            // (it will either select the card or open edit mode)
            if (target.closest('.content-area')) {
              return;
            }
            
            // For clicks on other parts of the card (header, borders, etc.), select the card
            e.stopPropagation(); // Prevent canvas click handler from clearing selection
            if (onClick) {
              onClick();
            }
          }}
        >
          {/* Card Header with Delete Button */}
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              {/* <div className="w-2 h-2 rounded-full bg-gray-400"></div>
              <span className="text-xs text-gray-500">card: {id}</span> */}
            </div>
            {/* <button
              onClick={handleDelete}
              className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
              aria-label="Delete card"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button> */}
          </div>

          {/* Input Area */}
          <div className="flex-1 overflow-auto">
            {isEditing ? (
              <textarea
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                onBlur={handleBlur}
                onFocus={handleFocus}
                className="w-full h-full border-none outline-none resize-none text-sm"
                placeholder="Type something..."
                autoFocus
              />
            ) : (
              <div
                onMouseDown={handleContentMouseDown}
                className="content-area w-full h-full text-sm text-gray-700 cursor-text p-2 rounded hover:bg-gray-50 transition-colors"
              >
                <div style={{ pointerEvents: 'none' }}>
                  {value ? (
                    <SafeMarkdown markdown={value} />
                  ) : (
                    <span className="text-gray-400 italic">Click to edit...</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </ResizableWrapper>
    </DraggableWrapper>
  );
}

export default NoteCard;
