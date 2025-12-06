import React from 'react';

interface SelectionBoxProps {
  start: { x: number; y: number } | null;
  end: { x: number; y: number } | null;
  zoom: number;
}

/**
 * SelectionBox Component
 * 
 * Renders a selection rectangle when dragging on the canvas.
 * Used for multi-selecting items by dragging a box around them.
 */
export function SelectionBox({ start, end, zoom }: SelectionBoxProps): React.ReactElement | null {
  if (!start || !end) return null;

  const OFFESTX = 0;
  const OFFESTY = 0;
  // Calculate box dimensions
  const left = Math.min(start.x, end.x)+OFFESTX;
  const top = Math.min(start.y, end.y)+OFFESTY;
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  // Only show if box has meaningful size
  if (width < 5 || height < 5) return null;

  return (
    <div
      data-selection-box
      className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-20 pointer-events-none z-50"
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
        height: `${height}px`,
        transform: `scale(${zoom})`,
        transformOrigin: 'top left',
        willChange: 'left, top, width, height', // Hint to browser for optimization
      }}
    />
  );
}

export default SelectionBox;

