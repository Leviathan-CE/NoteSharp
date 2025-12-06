import { Method } from '@testing-library/dom';
import { doc } from 'firebase/firestore';
import { LucideMove, Mouse, SplinePointer } from 'lucide-react';
import { userInfo } from 'os';
import { list } from 'postcss';
import React, { useState, useRef, useEffect } from 'react';
import { Vector2, fvec2 } from './Vector2';


interface MouseState {
  down: boolean
  up: boolean

}

interface DraggableWrapperProps {
  /** Unique identifier for this draggable item */
  id: string;
  /** Initial position */
  initialPosition?: Vector2;
  /** Callback when position changes */
  onPositionChange?: (id: string, position: Vector2, mousePosition?: { x: number; y: number }) => void;
  /** Children to wrap */
  children: React.ReactNode;
  /** Optional className */
  className?: string;
  /** Whether dragging is enabled */
  disabled?: boolean;
  /** Optional callback when mouse down occurs */
  onMouseDown?: (id: string) => void;
  onMouseUp?: (id: string, e:MouseEvent) => void;
  /** Current zoom level (default: 1) - used to scale movement */
  zoom?: number;
}

/**
 * DraggableWrapper Component
 * 
 * A reusable wrapper that makes any component draggable with free positioning.
 * Uses mouse events for precise control and absolute positioning for free movement.
 * 
 * Adapted from: https://stackoverflow.com/a (Jared Forsyth, CC BY-SA 4.0)
 * Modernized to use React hooks and TypeScript.
 * 
 * @example
 * ```tsx
 * <DraggableWrapper id="card-1" initialPosition={{ x: 100, y: 100 }}>
 *   <YourComponent />
 * </DraggableWrapper>
 * ```
 */
export function DraggableWrapper({
  id,
  initialPosition = { x: 0, y: 0 },
  onPositionChange,
  children,
  className = '',
  disabled = false,
  onMouseDown: onMouseDownCallback,
  onMouseUp: onMouseUpCallback,
  zoom = 1,
}: DraggableWrapperProps): React.ReactElement {
  const [position, setPosition] = useState<Vector2>(initialPosition);
  const isDragging = useRef(false);
  const [isInForbiddenArea, setIsInForbiddenArea] = useState(false);
  const currentPostion = useRef<Vector2>({ ...initialPosition }); // position relative to the cursor
  const offestPosRef = useRef<Vector2>(initialPosition); // offset from click location
  const endPos = useRef<Vector2>({ x: 0, y: 0 }); // Accumulated movement during drag
  const startPositionRef = useRef<Vector2>(initialPosition); // Position when drag started
  const mouseStateRef = useRef<MouseState>({ down: false, up: false }); // explicitly typed MouseState ref
  const elementRef = useRef<HTMLDivElement>(null);
  const prevMousePosRef = useRef<Vector2>({ x: 0, y: 0 });
  const mouseDelta = useRef<Vector2>({ x: 0, y: 0 });

  // Cleanup document listener on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mouseup', handleDocumentMouseUp);
      document.removeEventListener('mousemove', handleDocumentMove);
      document.body.style.cursor = '';
    };
  }, []);

  /**
   * Check if mouse is outside the canvas area (forbidden area)
   * Includes: header, sidebar, browser chrome, etc.
   */
  const checkIfInForbiddenArea = (clientX: number, clientY: number): boolean => {
    // Get the canvas element - this is the valid area where items can be dragged
    const canvas = document.querySelector('[data-canvas="true"]') as HTMLElement;
    
    if (!canvas) {
      // If canvas doesn't exist, consider everything forbidden
      return true;
    }
    
    // Get canvas bounding rectangle
    const canvasRect = canvas.getBoundingClientRect();
    
    // Check if mouse is INSIDE the canvas area
    const isInsideCanvas = clientX >= canvasRect.left && 
                           clientX <= canvasRect.right &&
                           clientY >= canvasRect.top && 
                           clientY <= canvasRect.bottom;
    
    // If mouse is NOT inside canvas, it's a forbidden area
    // This includes: header, sidebar, Chrome UI, browser chrome, etc.
    return !isInsideCanvas;
  };

  /**
   * Get the mouse direction using delta tranformation
   * @param e mouse event
   * @returns detlta vector2
   */
  const mouseDetla = (e: MouseEvent): Vector2 => {
    // Get previous mouse position (store in ref)
    const prevX = prevMousePosRef.current.x;
    const prevY = prevMousePosRef.current.y;

    // Calculate delta in pixels
    const deltaX = e.clientX - prevX;
    const deltaY = e.clientY - prevY;

    // Normalize to -1 to 1 based on viewport size
    const normalizedDeltaX = (deltaX / window.innerWidth) * 2; // *2 to get range -1 to 1
    const normalizedDeltaY = (deltaY / window.innerHeight) * 2;

    // Clamp to -1 to 1
    let clampedX = Math.max(-1, Math.min(1, normalizedDeltaX));
    let clampedY = Math.max(-1, Math.min(1, normalizedDeltaY));

    // Update previous position
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    mouseDelta.current = { x: clampedX, y: clampedY }
    return { x: clampedX, y: clampedY }
  }

  /**
   * Change the cursor icon based on whether we're in forbidden area
   * Updates cursor immediately during drag, but doesn't update state
   */
  const ChangeIcon = (e: MouseEvent) => {
    const inForbidden = checkIfInForbiddenArea(e.clientX, e.clientY);
    
    // Update cursor immediately (visual feedback)
    if (inForbidden) {
      document.body.style.cursor = 'not-allowed';
    } else {
      document.body.style.cursor = 'grabbing';
    }
    
    // Don't update position while in forbidden area
    return inForbidden;
  }

  /**
   * Clamps position to be within canvas bounds, with 200 unit padding from top and left edges
   * Only checks top and left bounds (canvas can expand right and down)
   * If position is out of bounds, moves it 200 units within bounds
   */
  const clampPositionToBounds = (pos: Vector2): Vector2 => {
    const canvas = document.querySelector('[data-canvas="true"]') as HTMLElement;
    
    if (!canvas) {
      // If no canvas, return position as-is
      return pos;
    }
    
    const padding = 200; // 200 units padding from top and left edges
    
    // Only enforce minimum bounds (top and left)
    // Canvas can expand right and down, so no max bounds
    const minX = padding;
    const minY = padding;
    
    // Clamp position to minimum bounds only (top and left)
    const adjustedX = Math.max(minX, pos.x);
    const adjustedY = Math.max(minY, pos.y);
    
    return { x: adjustedX, y: adjustedY };
  }

  /**
   * mouse event that handles when the item selects initliaze drag varables
   * @param e mouse event
   * @returns self
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled || e.button !== 0) return; // Only handle left mouse button
    
    console.log('[DraggableWrapper] handleMouseDown', { id });
    
    // Call the onMouseDown callback if provided (this is handleItemMouseDown from useSelection)
    if (onMouseDownCallback) {
      console.log('[DraggableWrapper] Calling onMouseDownCallback', { id });
      onMouseDownCallback(id);
    }

    // Capture starting position when drag begins
    startPositionRef.current = { ...position };

    // Calculate offset from click location (relative to element position)
    const mouseX = e.clientX / zoom;
    const mouseY = e.clientY / zoom;
    offestPosRef.current = {
      x: mouseX - position.x,
      y: mouseY - position.y,
    };

    // Initialize previous mouse position with current mouse position
    prevMousePosRef.current = { x: e.clientX, y: e.clientY };
    mouseDelta.current = { x: 0, y: 0 }; // Reset delta on new drag
    endPos.current = { x: 0, y: 0 }; // Reset accumulated movement
    mouseStateRef.current = { down: true, up: false }
    // Add document listener for mouse up outside
    document.addEventListener('mouseup', handleDocumentMouseUp);
    document.addEventListener('mousemove', handleDocumentMove);

  
    return handleMouseDown;
  };

  /**
   * handles checking the entire document for mouse up event ends drag event
   * and resets DOM and sync State
   * @param e mouse event
   */
  const handleDocumentMouseUp = (e: MouseEvent) => {
    if (!mouseStateRef.current.down) return;

    // Restore cursor
    document.body.style.cursor = '';

    // Check if mouse is in forbidden area on mouse up - UPDATE STATE HERE
    const inForbidden = checkIfInForbiddenArea(e.clientX, e.clientY);
    setIsInForbiddenArea(inForbidden);

    // Finalize drag
    mouseStateRef.current = { down: false, up: true };
    isDragging.current = false;

    // Calculate final position: starting position + accumulated movement
    let finalPosition = fvec2.add(startPositionRef.current, endPos.current);
    
    // Clamp position to bounds (200 units within bounds)
    finalPosition = clampPositionToBounds(finalPosition);
    
    // Check if position was adjusted (out of bounds)
    const wasOutOfBounds = finalPosition.x !== startPositionRef.current.x + endPos.current.x ||
                          finalPosition.y !== startPositionRef.current.y + endPos.current.y;
    
    if (wasOutOfBounds) {
      console.log('Position was out of bounds - adjusted to:', finalPosition);
    }
    
    // Update React state FIRST so it's ready for the next render
    setPosition(finalPosition);

    // Then update DOM directly to ensure it stays in place
    if (elementRef.current) {
      // Reset transform and use left/top for final position
      elementRef.current.style.transform = 'translate(0, 0)';
      elementRef.current.style.transition = 'none'; // Disable transition temporarily
      elementRef.current.style.left = `${finalPosition.x}px`;
      elementRef.current.style.top = `${finalPosition.y}px`;
      
      // Re-enable transition after a brief moment
      setTimeout(() => {
        if (elementRef.current) {
          elementRef.current.style.transition = '';
        }
      }, 0);
    }

    // Call onPositionChange with final position (no mousePosition = drag ended)
    // This signals the parent to save to database
    if (onPositionChange) {
      onPositionChange(id, finalPosition);
    }

    // Remove document listener
    document.removeEventListener('mouseup', handleDocumentMouseUp);
    document.removeEventListener('mousemove', handleDocumentMove);
  }


  /**
   * detects mouse movent across entire cavnas 
   * @param e mouse evetn
   * @returns nothing
   */
  const handleDocumentMove = (e: MouseEvent) => {
    if (!mouseStateRef.current.down) return;

    // Check forbidden area and change cursor icon (but don't update state)
    const inForbidden = ChangeIcon(e);
    
    // Don't update position while in forbidden area - keep it where it is
    if (inForbidden) {
      return;
    }

    // Ensure currentPostion is initialized
    if (!currentPostion.current) {
      currentPostion.current = { x: 0, y: 0 };
    }
    const speed = 700/zoom 
    isDragging.current = true;
    mouseDetla(e);

    // Calculate movement values
    const moveX = Math.round(mouseDelta.current.x * speed);
    const moveY = Math.round(mouseDelta.current.y * speed);

    endPos.current.x += moveX;
    endPos.current.y += moveY;

    if (elementRef.current) {
      elementRef.current.style.transform = `translate(${endPos.current.x}px, ${endPos.current.y}px)`;
    }
  }



  return (
    <div
      ref={elementRef}
      onMouseDown={handleMouseDown}
      className={`absolute select-none ${isDragging.current
        ? (isInForbiddenArea ? 'cursor-not-allowed z-50 opacity-90' : 'cursor-grabbing z-50 opacity-90')
        : 'cursor-grab z-10'
        } ${disabled ? 'cursor-default' : ''} ${className}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        userSelect: 'none',
        margin: 0,
        padding: 0,
        display: 'inline-block',
        // Smooth transition when not dragging
        transition: isDragging.current ? 'left 1.5s ease-out, top 1.5s ease-out' : 'left 1.2s ease-out, top 1.2s ease-out',
      }}
    >
      {children}
    </div>
  );
}

export default DraggableWrapper;



