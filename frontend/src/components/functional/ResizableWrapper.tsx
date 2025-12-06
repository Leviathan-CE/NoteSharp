import React, { useState, useRef, useEffect } from 'react';

interface Size {
  width: number;
  height: number;
}

interface ResizableWrapperProps {
  /** Initial size */
  initialSize?: Size;
  /** Minimum size constraints */
  minWidth?: number;
  minHeight?: number;
  /** Maximum size constraints */
  maxWidth?: number;
  maxHeight?: number;
  /** Callback when size changes */
  onSizeChange?: (size: Size) => void;
  /** Children to wrap */
  children: React.ReactNode;
  /** Optional className */
  className?: string;
  /** Whether resizing is enabled */
  disabled?: boolean;
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * ResizableWrapper Component
 * 
 * A reusable wrapper that makes any component resizable by dragging its edges/corners.
 * Provides 8 resize handles (4 corners + 4 edges) for precise control.
 * 
 * @example
 * ```tsx
 * <ResizableWrapper 
 *   initialSize={{ width: 200, height: 150 }}
 *   minWidth={100}
 *   minHeight={80}
 *   onSizeChange={(size) => console.log('New size:', size)}
 * >
 *   <YourComponent />
 * </ResizableWrapper>
 * ```
 */
export function ResizableWrapper({
  initialSize = { width: 256, height: 200 },
  minWidth = 100,
  minHeight = 80,
  maxWidth,
  maxHeight,
  onSizeChange,
  children,
  className = '',
  disabled = false,
}: ResizableWrapperProps): React.ReactElement {
  const [size, setSize] = useState<Size>(initialSize);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [startSize, setStartSize] = useState<Size>(initialSize);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Update size when initialSize changes externally
  useEffect(() => {
    setSize(initialSize);
  }, [initialSize.width, initialSize.height]);

  const handleMouseDown = (e: React.MouseEvent, handle: ResizeHandle) => {
    if (disabled) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeHandle(handle);
    setStartPos({ x: e.clientX, y: e.clientY });
    setStartSize(size);
  };

  useEffect(() => {
    if (!isResizing || !resizeHandle) return;

      const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startPos.x;
      const deltaY = e.clientY - startPos.y;
      
      // Only resize from bottom-right corner (southeast)
      // Both width and height increase based on mouse movement
      const newWidth = Math.max(minWidth, Math.min(maxWidth || Infinity, startSize.width + deltaX));
      const newHeight = Math.max(minHeight, Math.min(maxHeight || Infinity, startSize.height + deltaY));

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeHandle(null);
      if (onSizeChange) {
        onSizeChange(size);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeHandle, startPos, startSize, minWidth, minHeight, maxWidth, maxHeight, size, onSizeChange]);

  // Invisible handles that only show on hover of the wrapper
  const handleClasses = 'absolute bg-blue-500/0 hover:bg-blue-500 transition-colors z-20 border-2 border-transparent hover:border-blue-500';
  const edgeHandleClasses = 'absolute bg-transparent hover:bg-blue-500/20 transition-colors z-20';

  return (
    <div
      ref={wrapperRef}
      className={`group relative ${className}`}
      style={{
        width: `${size.width}px`,
        height: `${size.height}px`,
        margin: 0,
        padding: 0,
      }}
    >
      {children}
      
      {!disabled && (
        <>
          {/* Bottom-right corner handle only */}
          <div
            className={`${handleClasses} w-4 h-4 -bottom-2 -right-2 cursor-se-resize rounded-full group-hover:opacity-100 opacity-0`}
            onMouseDown={(e) => handleMouseDown(e, 'se')}
          />
        </>
      )}
    </div>
  );
}

export default ResizableWrapper;

