import React, { useState, useRef } from 'react';

interface ComponentSpawnButtonProps {
  /** Callback when component should be created at a position */
  onSpawnComponent?: (position: { x: number; y: number }) => void;
  /** Button label */
  label?: string;
  /** Optional className */
  className?: string;
  /** Optional icon or preview element to show in the ghost */
  preview?: React.ReactNode;
}

/**
 * ComponentSpawnButton (formerly CardSpawnButton)
 * 
 * A generic button that can be clicked and dragged onto the canvas to spawn any component.
 * The component should be wrapped in DraggableWrapper (and optionally ResizableWrapper).
 * Similar to drag-to-create functionality in design tools.
 * 
 * @example
 * ```tsx
 * <ComponentSpawnButton
 *   label="+ Card"
 *   onSpawnComponent={(position) => {
 *     // Create your component here
 *     const newComponent = <Card id="1" initialPosition={position} />;
 *     // Add to your state/rendering
 *   }}
 * />
 * ```
 */
export function ComponentSpawnButton({
  onSpawnComponent,
  label = '+ Component',
  className = '',
  preview,
}: ComponentSpawnButtonProps): React.ReactElement {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    // Create a ghost element that follows the cursor
    const ghost = document.createElement('div');
    ghost.className = 'fixed pointer-events-none z-50 bg-blue-500 text-white px-4 py-2 rounded-lg shadow-lg opacity-75';
    if (preview) {
      // If preview is provided, we'd need to render React element to DOM
      // For now, just use the label
      ghost.textContent = label;
    } else {
      ghost.textContent = label;
    }
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
    ghost.id = 'component-spawn-ghost';
    document.body.appendChild(ghost);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      ghost.style.left = `${moveEvent.clientX}px`;
      ghost.style.top = `${moveEvent.clientY}px`;
      setDragPosition({ x: moveEvent.clientX, y: moveEvent.clientY });
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      setIsDragging(false);
      setDragPosition(null);
      
      // Remove ghost element
      const ghostElement = document.getElementById('component-spawn-ghost');
      if (ghostElement) {
        ghostElement.remove();
      }

      // Get the canvas element to calculate relative position
      const canvas = document.querySelector('[data-canvas="true"]') as HTMLElement;
      if (canvas && onSpawnComponent) {
        const canvasRect = canvas.getBoundingClientRect();
        const relativeX = upEvent.clientX - canvasRect.left + canvas.scrollLeft;
        const relativeY = upEvent.clientY - canvasRect.top + canvas.scrollTop;
        
        onSpawnComponent({ x: relativeX, y: relativeY });
      }

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <button
      ref={buttonRef}
      onMouseDown={handleMouseDown}
      className={`px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      } ${className}`}
    >
      {label}
    </button>
  );
}

export default ComponentSpawnButton;

